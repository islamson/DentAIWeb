/**
 * SQL Generator — LLM-based SQL generation from semantic read plan + schema slice.
 *
 * Generates SELECT-only SQL for the given schema slice.
 * The generated SQL must NOT include "organizationId"/"branchId" filters —
 * those are injected server-side by scope-injector.js.
 *
 * CRITICAL: Column names are camelCase and MUST be double-quoted in SQL.
 * The LLM must ONLY use identifiers present in the provided schema.
 */

'use strict';

const { chat, isAvailable } = require('../ollama');
const { createLlmUnavailableError } = require('../llm-query-planner');
const { getMetricDefinition, APPOINTMENT_STATUS_VALUES } = require('./metric-definitions');

/**
 * Extract SQL from LLM response. Handles markdown code fences.
 */
function extractSql(raw) {
  if (!raw) return null;

  let s = String(raw).trim();

  // YENİ: DeepSeek / reasoning block temizliği (Yarıda kesilme korumalı)
  s = s.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

  // Prefix temizliği
  s = s.replace(/^(Final SQL|SQL|Query|Sorgu)\s*:\s*/i, '').trim();

  // Markdown fence temizliği (Arayüz çökmesin diye \x60 kullanıldı)
  s = s.replace(/\x60\x60\x60(?:sql|postgresql|pgsql|psql)?/gi, '\x60\x60\x60').trim();

  // 1) Önce fenced block içinden al (Arayüz çökmesin diye \x60 kullanıldı)
  const fenceMatches = [...s.matchAll(/\x60\x60\x60([\s\S]*?)\x60\x60\x60/g)];
  if (fenceMatches.length > 0) {
    for (let i = fenceMatches.length - 1; i >= 0; i--) {
      const candidate = fenceMatches[i][1].trim();
      if (/^\s*(WITH|SELECT)\b/i.test(candidate)) {
        return candidate.replace(/;\s*$/, '').trim();
      }
    }
  }

  // 2) JSON parse
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed.sql === 'string' && /^\s*(WITH|SELECT)\b/i.test(parsed.sql.trim())) {
      return parsed.sql.replace(/;\s*$/, '').trim();
    }
  } catch (_) {}

  // 3) JSON benzeri sql field
  const jsonMatch = s.match(/"sql"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
  if (jsonMatch) {
    const candidate = jsonMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .trim();

    if (/^\s*(WITH|SELECT)\b/i.test(candidate)) {
      return candidate.replace(/;\s*$/, '').trim();
    }
  }

  // 4) Ham text içinde ilk WITH/SELECT bloğunu al
  const startIdx = s.search(/\b(WITH|SELECT)\b/i);
  if (startIdx >= 0) {
    let candidate = s.slice(startIdx).trim();

    // Kapanmamış stray markdown fence/backtick temizliği
    candidate = candidate.replace(/\x60+/g, '').trim();

    if (/^\s*(WITH|SELECT)\b/i.test(candidate)) {
      return candidate.replace(/;\s*$/, '').trim();
    }
  }

  return null;
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Build time range SQL conditions based on timeScope.
 * Uses real camelCase timestamp column names.
 */
function buildTimeConditionHint(filters) {
  const timeScope = filters?.timeScope;
  if (!timeScope || timeScope === 'none') return '';

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const fmt = (d) => formatLocalDate(d);

  const ranges = {
    today: { from: fmt(today), to: fmt(new Date(year, month, today.getDate() + 1)) },
    yesterday: { from: fmt(new Date(year, month, today.getDate() - 1)), to: fmt(today) },
    this_week: (() => {
      const day = today.getDay() || 7;
      const start = new Date(today);
      start.setDate(today.getDate() - day + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { from: fmt(start), to: fmt(end) };
    })(),
    last_week: (() => {
      const day = today.getDay() || 7;
      const endOfLastWeek = new Date(today);
      endOfLastWeek.setDate(today.getDate() - day);
      const startOfLastWeek = new Date(endOfLastWeek);
      startOfLastWeek.setDate(endOfLastWeek.getDate() - 6);
      return { from: fmt(startOfLastWeek), to: fmt(new Date(endOfLastWeek.getTime() + 86400000)) };
    })(),
    this_month: { from: fmt(new Date(year, month, 1)), to: fmt(new Date(year, month + 1, 1)) },
    last_month: { from: fmt(new Date(year, month - 1, 1)), to: fmt(new Date(year, month, 1)) },
    this_quarter: (() => {
      const qStart = Math.floor(month / 3) * 3;
      return { from: fmt(new Date(year, qStart, 1)), to: fmt(new Date(year, qStart + 3, 1)) };
    })(),
    last_quarter: (() => {
      const qStart = Math.floor(month / 3) * 3 - 3;
      const y = qStart < 0 ? year - 1 : year;
      const q = qStart < 0 ? qStart + 12 : qStart;
      return { from: fmt(new Date(y, q, 1)), to: fmt(new Date(y, q + 3, 1)) };
    })(),
    this_year: { from: fmt(new Date(year, 0, 1)), to: fmt(new Date(year + 1, 0, 1)) },
    last_year: { from: fmt(new Date(year - 1, 0, 1)), to: fmt(new Date(year, 0, 1)) },
    custom: (() => {
      const m = (filters.month || month + 1) - 1;
      const y = filters.year || year;
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 1)) };
    })(),
  };

  const range = ranges[timeScope];
  if (!range) return '';
  return `Zaman aralığı: '${range.from}' ile '${range.to}' arası. WHERE koşulunda "startAt" veya "createdAt" veya "paidAt" veya "occurredAt" sütununa >= ve < karşılaştırması ile kullan.`;
}

function getDateRange(filters = {}) {
  const timeScope = filters?.timeScope || 'this_month';

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const fmt = (d) => formatLocalDate(d);

  const ranges = {
    today: { from: fmt(today), to: fmt(new Date(year, month, today.getDate() + 1)) },
    yesterday: { from: fmt(new Date(year, month, today.getDate() - 1)), to: fmt(today) },
    this_week: (() => {
      const day = today.getDay() || 7;
      const start = new Date(today);
      start.setDate(today.getDate() - day + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { from: fmt(start), to: fmt(end) };
    })(),
    last_week: (() => {
      const day = today.getDay() || 7;
      const endOfLastWeek = new Date(today);
      endOfLastWeek.setDate(today.getDate() - day);
      const startOfLastWeek = new Date(endOfLastWeek);
      startOfLastWeek.setDate(endOfLastWeek.getDate() - 6);
      return { from: fmt(startOfLastWeek), to: fmt(new Date(endOfLastWeek.getTime() + 86400000)) };
    })(),
    this_month: { from: fmt(new Date(year, month, 1)), to: fmt(new Date(year, month + 1, 1)) },
    last_month: { from: fmt(new Date(year, month - 1, 1)), to: fmt(new Date(year, month, 1)) },
    this_quarter: (() => {
      const qStart = Math.floor(month / 3) * 3;
      return { from: fmt(new Date(year, qStart, 1)), to: fmt(new Date(year, qStart + 3, 1)) };
    })(),
    last_quarter: (() => {
      const qStart = Math.floor(month / 3) * 3 - 3;
      const y = qStart < 0 ? year - 1 : year;
      const q = qStart < 0 ? qStart + 12 : qStart;
      return { from: fmt(new Date(y, q, 1)), to: fmt(new Date(y, q + 3, 1)) };
    })(),
    this_year: { from: fmt(new Date(year, 0, 1)), to: fmt(new Date(year + 1, 0, 1)) },
    last_year: { from: fmt(new Date(year - 1, 0, 1)), to: fmt(new Date(year, 0, 1)) },
    custom: (() => {
      const m = (filters.month || month + 1) - 1;
      const y = filters.year || year;
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 1)) };
    })(),
  };

  return ranges[timeScope] || ranges.this_month;
}

function buildDeterministicMetricSql(readPlan) {
  const metric = readPlan?.requestedMetrics?.[0];
  const range = getDateRange(readPlan?.filters);

  if (metric === 'collection_amount') {
    return [
      'SELECT',
      '  COALESCE(SUM(payments."amount"), 0) AS "collectionAmount"',
      'FROM payments',
      'WHERE payments."deletedAt" IS NULL',
      '  AND COALESCE(payments."isRefund", false) = false',
      `  AND payments."paidAt" >= '${range.from}'`,
      `  AND payments."paidAt" < '${range.to}'`,
    ].join('\n');
  }

  if (metric === 'pending_collection_amount') {
    return [
      'WITH payment_totals AS (',
      '  SELECT',
      '    payments."invoiceId" AS "invoiceId",',
      '    SUM(payments."amount") AS "paidAmount"',
      '  FROM payments',
      '  WHERE payments."deletedAt" IS NULL',
      '  GROUP BY payments."invoiceId"',
      ')',
      'SELECT',
      '  COALESCE(',
      '    SUM(',
      '      GREATEST(',
      '        invoices."netTotal" - COALESCE(payment_totals."paidAmount", 0),',
      '        0',
      '      )',
      '    ),',
      '    0',
      '  ) AS "pendingCollectionAmount"',
      'FROM invoices',
      'LEFT JOIN payment_totals ON payment_totals."invoiceId" = invoices."id"',
      'WHERE invoices."status" IN (\'OPEN\', \'PARTIAL\')',
      `  AND COALESCE(invoices."dueDate", invoices."createdAt") >= '${range.from}'`,
      `  AND COALESCE(invoices."dueDate", invoices."createdAt") < '${range.to}'`,
    ].join('\n');
  }

  return null;
}

/**
 * Build the SQL generation system prompt.
 */
function buildSqlSystemPrompt(schemaSlice, readPlan) {
  const timeHint = buildTimeConditionHint(readPlan.filters);

  return [
    'Sen bir PostgreSQL SQL sorgusu üreten yapay zekasın.',
    'Sadece SELECT sorgusu üret. INSERT, UPDATE, DELETE, DDL yazma.',
    '',
    '=== KRİTİK KURALLAR ===',
    '1. Sadece SELECT kullan.',
    '2. SELECT * kullanma, sütunları açıkça belirt.',
    '3. Satır döndüren sorgularda LIMIT ekle (varsayılan 50, maksimum 100).',
    '4. Tabloları uygun JOIN ile bağla.',
    '5. Para tutarları kuruş cinsindendir (100 ile böl → TL).',
    '6. Tarih filtreleri için timestamp karşılaştırması kullan.',
    '6.1 Saat formatlama gerekiyorsa PostgreSQL to_char içinde dakika için MM değil MI kullan. Örn: to_char(ts, \'YYYY-MM-DD HH24:MI\').',
    '7. NULL kontrolü gereken yerlerde COALESCE kullan.',
    '8. Silinen kayıtları hariç tut: "payments" tablosunda "deletedAt" IS NULL kontrolü yap.',    
    '9. Enum değerleri tek tırnak içinde yaz (ör. \'COMPLETED\', \'CANCELLED\'). Randevu durumu ACTIVE YOK.',
    '10. BEKLEYEN TAHSİLAT FORMÜLÜ (ÇOK ÖNEMLİ): Fatura (invoices) ile Ödeme (payments) tablolarını "invoiceId" üzerinden JOIN et. Geriye kalan bakiyeyi bulmak için KESİNLİKLE SUM("invoices"."netTotal" - COALESCE("payments"."amount", 0)) kullan. ASLA SUM(SUM(...)) veya alt sorgu içinde SUM kullanma.',
    '11. Sadece SQL döndür, açıklama yazma. Markdown kod bloğu kullanma.',
    '12. SOYUT METRİKLER VE MATEMATİK: Eğer kullanıcı "verim", "hız", "risk" gibi tablolarda doğrudan bulunmayan soyut metrikler isterse, mantıklı bir matematiksel formül (Örn: ortalama tamamlanma süresi) üretebilirsin.',
    '13. KRİTİK POSTGRESQL ZAMAN MATEMATİĞİ: PostgreSQL\'de iki TIMESTAMP farkı INTERVAL döner. Interval ile doğrudan matematiksel bölme/çarpma YAPILAMAZ! Tarih farklarını sayısal olarak (örneğin saniye veya dakika cinsinden) hesaplamak için KESİNLİKLE EXTRACT(EPOCH FROM (bitis - baslangic)) kullan. (Örn: Ortalama dakika için -> AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 60) )',
    '14. Her zaman kullandığın tablonun FROM veya JOIN cümlesinde olduğuna emin ol.',
    '15. KRİTİK POSTGRESQL ALIAS KURALI: SELECT içinde AS ile isimlendirdiğin bir sütunu (Örn: AS "current_efficiency"), AYNI SELECT içindeki başka bir matematiksel işlemde (Örn: "current_efficiency" - "previous") KESİNLİKLE KULLANAMAZSIN! PostgreSQL bunu desteklemez. Matematik yapacaksan ya formülü tekrar uzun uzun yaz ya da CTE (WITH) yapısını kullan.',
    '16. KRİTİK ALIAS KURALI: Çıktı sütunlarına veya hesaplamalara (COUNT, SUM vb.) takma ad verirken KESİNLİKLE "AS" kelimesini kullan (Örn: COUNT(*) AS "toplam", users.name AS "doctorName"). "AS" kullanmadan takma ad verme.',
    '17. KRİTİK ALIAS KURALI: Çıktı sütunlarına takma ad verirken KESİNLİKLE "AS" kelimesini kullan (Örn: COUNT(*) AS "toplam"). AS kullanmadan takma ad verme.',
    '18. TYPE CASTING (ENUM) YASAĞI: Prisma veritabanında Enum tipleri kullanılıyor (ItemStatus, AppointmentStatus vb.). Sorgu yazarken ASLA "::text", "::uuid" gibi tip dönüştürme (cast) işlemleri YAPMA. Enum değerlerini SADECE düz string olarak yaz (Örn: status = \'COMPLETED\').',
    '19. SUBQUERY/CTE KURALI: İç içe sorgularda (Subquery) veya CTE (WITH) yapılarında, dış sorguda SADECE iç sorgunun dışarıya döndürdüğü sütun isimlerini (alias) kullanabilirsin. İç sorguda kullandığın tablo harflerini (Örn: p."firstName") dış sorguda ASLA KULLANAMAZSIN.',
    '',
    '=== SÜTUN İSİMLENDİRME KURALLARI (ÇOK ÖNEMLİ) ===',
    'Veritabanında sütun isimleri camelCase biçimindedir (snake_case DEĞİL).',
    'Her camelCase sütun adını çift tırnak içinde yaz.',
    '',
    'DOĞRU örnekler:',
    '  appointments."patientId"',
    '  appointments."doctorUserId"',
    '  appointments."startAt"',
    '  appointments."organizationId"',
    '  patients."firstName"',
    '  patients."lastName"',
    '  patients."birthDate"',
    '  patients."createdAt"',
    '  payments."paidAt"',
    '  payments."deletedAt"',
    '  payments."treatmentPlanId"',
    '  treatment_items."assignedDoctorId"',
    '  treatment_items."treatmentPlanId"',
    '  treatment_items."completedAt"',
    '  financial_movements."occurredAt"',
    '  financial_movements."sourceType"',
    '',
    'KRİTİK - users tablosu:',
    '  users tablosunda "id" var, "userId" YOK. Doktor aramak için: users.id veya users."id" kullan.',
    '  appointments."doctorUserId" = users.id ile JOIN yap.',
    '',
    'YANLIŞ (bunları ASLA kullanma):',
    '  patient_id → YANLIŞ, "patientId" kullan',
    '  doctor_user_id → YANLIŞ, "doctorUserId" kullan',
    '  users."userId" → YANLIŞ, users.id kullan',
    '  start_at → YANLIŞ, "startAt" kullan',
    '  organization_id → YANLIŞ, "organizationId" kullan',
    '  first_name → YANLIŞ, "firstName" kullan',
    '  last_name → YANLIŞ, "lastName" kullan',
    '  created_at → YANLIŞ, "createdAt" kullan',
    '  birth_date → YANLIŞ, "birthDate" kullan',
    '',
    'Tablo isimleri snake_case: appointments, patients, users, payments, treatment_items vs.',
    'Sadece aşağıdaki şemada verilen sütun isimlerini kullan. Başka isim UYDURMA.',
    '',
    '!!! ÇOK KRİTİK: Sorgunun WHERE koşuluna ASLA "organizationId" veya "branchId" ile ilgili HİÇBİR ŞEY YAZMA. Bunları backend otomatik ekleyecek. "branchId" = \'organizationId\' gibi uydurma değerler KESİNLİKLE YASAKTIR.',
    '!!! LIMIT KURALI: Toplam/Sayım yapmıyorsan, listeleme sorgularının sonuna KESİNLİKLE LIMIT 50 ekle.',
    '',
    schemaSlice.promptText,
    '',
    timeHint ? `\n${timeHint}\n` : '',
    '',
    'Sorgu planı:',
    JSON.stringify(readPlan, null, 2),
  ].join('\n');
}

/**
 * Generate SQL from a semantic read plan and schema slice.
 *
 * @param {Object} readPlan - from semantic-read-planner.js
 * @param {Object} schemaSlice - from schema-slicer.js
 * @returns {Promise<{ sql: string, modelUsed: string }>}
 */
async function generateSql(readPlan, schemaSlice) {
  const deterministicSql = buildDeterministicMetricSql(readPlan);
  if (deterministicSql) {
    return {
      sql: deterministicSql,
      modelUsed: 'deterministic',
    };
  }

  const available = await isAvailable();
  if (!available) {
    throw createLlmUnavailableError('SQL generator: Ollama erişilemiyor');
  }

  const systemPrompt = buildSqlSystemPrompt(schemaSlice, readPlan);

  // Build user message from plan
  const userParts = ['Bu plan için uygun PostgreSQL SELECT sorgusu üret:'];

  if (readPlan.queryType) userParts.push(`Sorgu türü: ${readPlan.queryType}`);
  if (readPlan.analysisMode) userParts.push(`Analiz modu: ${readPlan.analysisMode}`);
  if (readPlan.targetEntities?.length) userParts.push(`Hedef tablolar: ${readPlan.targetEntities.join(', ')}`);
  if (readPlan.requestedMetrics?.length) userParts.push(`İstenen metrikler: ${readPlan.requestedMetrics.join(', ')}`);
  if (readPlan.requestedFields?.length) userParts.push(`İstenen alanlar: ${readPlan.requestedFields.join(', ')}`);
  if (readPlan.filters?.status) {
    userParts.push(`Durum filtresi: ${readPlan.filters.status} (geçerli randevu: ${APPOINTMENT_STATUS_VALUES.join(', ')})`);
  }
  if (readPlan.filters?.gender) userParts.push(`Cinsiyet filtresi: ${readPlan.filters.gender}`);
  if (readPlan.filters?.entityName) {
    userParts.push(`Varlık adı: ${readPlan.filters.entityName} (${readPlan.filters.entityType || 'bilinmiyor'})`);
    userParts.push('Doktor aramak için: users tablosunda name ile ara, users.id kullan. users.userId YOK.');
  }
  if (readPlan.groupBy?.length) userParts.push(`Gruplama: ${readPlan.groupBy.join(', ')}`);
  if (readPlan.orderBy?.length) userParts.push(`Sıralama: ${readPlan.orderBy.map(o => `${o.field} ${o.direction}`).join(', ')}`);
  if (readPlan.limit) userParts.push(`Limit: ${readPlan.limit}`);
  if (readPlan.filters?.comparePrevious) userParts.push('Önceki dönemle karşılaştırma gerekiyor.');

  const metricDef = getMetricDefinition(readPlan.requestedMetrics?.[0]);
  if (metricDef?.semanticNote) {
    userParts.push(`ÖNEMLİ metrik notu: ${metricDef.semanticNote}`);
  }

  userParts.push('');
  userParts.push('ÖNEMLİ: Sütun isimlerini çift tırnak içinde camelCase yaz. snake_case KULLANMA.');

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userParts.join('\n') },
  ];

  let content;
  try {
    ({ content } = await chat(messages));
  } catch (err) {
    throw createLlmUnavailableError(err.message);
  }

  let sql = extractSql(content);

  // Retry once if extraction failed
  if (!sql) {
    try {
      ({ content } = await chat(messages));
      sql = extractSql(content);
    } catch {
      // ignore
    }
  }

  if (!sql) {
    const err = new Error('SQL generator returned invalid output');
    err.code = 'AI_SQL_GENERATION_FAILED';
    throw err;
  }

  // 1. SQL içindeki tüm inline (--) ve block (/* */) yorumları temizle
  sql = sql.replace(/--.*$/gm, ''); // -- ile başlayan satır sonuna kadar sil
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, ''); // /* */ arasındaki her şeyi sil
  
  // Clean up
  sql = sql.replace(/;\s*$/, '').trim();

  // Post-process: fix common LLM mistakes — snake_case → camelCase
  sql = postProcessSnakeToCamel(sql);

  // ZORUNLU KONTROL: Eğer LLM payments.paidAt gibi bir şey yazdıysa ve çift tırnak koymadıysa, biz koyalım.
  // Bu regex, tabloAdı.camelCaseSütun formatında olup çift tırnak İÇERMEYEN ifadeleri bulup tırnak içine alır.
  sql = sql.replace(/(\b[a-zA-Z_]+)\.([a-z]+[A-Z][a-zA-Z0-9_]*)\b/g, '$1."$2"');

  // Fix users.userId → users.id (users table has id, not userId)
  sql = sql.replace(/\busers\.["']?userId["']?/gi, 'users.id');
  sql = sql.replace(/\busers\.["']?user_id["']?/gi, 'users.id');

  return {
    sql,
    modelUsed: 'ollama',
  };
}

/**
 * Post-process SQL to fix common LLM snake_case mistakes.
 * Converts known snake_case column names to their camelCase equivalents.
 */
function postProcessSnakeToCamel(sql) {
  const snakeToCamel = {
    // Identifiers that LLMs frequently hallucinate as snake_case
    'organization_id': 'organizationId',
    'branch_id': 'branchId',
    'patient_id': 'patientId',
    'doctor_user_id': 'doctorUserId',
    'doctor_id': 'doctorId',
    'start_at': 'startAt',
    'end_at': 'endAt',
    'created_at': 'createdAt',
    'updated_at': 'updatedAt',
    'first_name': 'firstName',
    'last_name': 'lastName',
    'birth_date': 'birthDate',
    'national_id': 'nationalId',
    'room_resource': 'roomResource',
    'duration_minutes': 'durationMinutes',
    'appointment_type': 'appointmentType',
    'is_urgent': 'isUrgent',
    'guest_first_name': 'guestFirstName',
    'guest_last_name': 'guestLastName',
    'guest_phone': 'guestPhone',
    'reminder_sent': 'reminderSent',
    'send_sms': 'sendSms',
    'no_show_risk': 'noShowRisk',
    'paid_at': 'paidAt',
    'deleted_at': 'deletedAt',
    'deleted_by': 'deletedBy',
    'void_reason': 'voidReason',
    'vat_rate': 'vatRate',
    'is_refund': 'isRefund',
    'invoice_id': 'invoiceId',
    'treatment_plan_id': 'treatmentPlanId',
    'net_total': 'netTotal',
    'due_date': 'dueDate',
    'total_price': 'totalPrice',
    'planned_total': 'plannedTotal',
    'completed_total': 'completedTotal',
    'approved_at': 'approvedAt',
    'approved_by': 'approvedBy',
    'is_active': 'isActive',
    'catalog_service_id': 'catalogServiceId',
    'assigned_doctor_id': 'assignedDoctorId',
    'completed_at': 'completedAt',
    'parent_item_id': 'parentItemId',
    'session_id': 'sessionId',
    'treatment_item_id': 'treatmentItemId',
    'tooth_code': 'toothCode',
    'session_date': 'sessionDate',
    'default_price': 'defaultPrice',
    'requires_lab': 'requiresLab',
    'source_type': 'sourceType',
    'source_id': 'sourceId',
    'current_account_id': 'currentAccountId',
    'bank_account_id': 'bankAccountId',
    'payment_method': 'paymentMethod',
    'occurred_at': 'occurredAt',
    'contact_name': 'contactName',
    'tax_office': 'taxOffice',
    'tax_number': 'taxNumber',
    'transaction_type': 'transactionType',
    'related_entity_type': 'relatedEntityType',
    'related_entity_id': 'relatedEntityId',
    'category_id': 'categoryId',
    'min_level': 'minLevel',
    'current_stock': 'currentStock',
    'inventory_item_id': 'inventoryItemId',
    'output_direction_id': 'outputDirectionId',
    'total_price': 'totalPrice',
    'total_amount': 'totalAmount',
    'created_by': 'createdBy',
    'expiry_date': 'expiryDate',
    'payment_plan_id': 'paymentPlanId',
    'lab_supplier_id': 'labSupplierId',
    'unit_price': 'unitPrice',
    'lab_material_id': 'labMaterialId',
    'responsible_user_id': 'responsibleUserId',
    'completion_rate': 'completionRate',
    'completion_price_rate': 'completionPriceRate',
    'bank_name': 'bankName',
    'account_number': 'accountNumber',
    'current_balance': 'currentBalance',
    'is_default': 'isDefault',
    'is_active': 'isActive',
    'user_id': 'userId',
    'primary_doctor_id': 'primaryDoctorId',
  };

  let result = sql;

  // Replace patterns like: table.snake_case or "snake_case" or .snake_case
  for (const [snake, camel] of Object.entries(snakeToCamel)) {
    // Pattern: word_boundary snake_case after a dot (qualified column ref)
    const dotPattern = new RegExp(`(\\w+)\\.${snake}\\b`, 'g');
    result = result.replace(dotPattern, `$1."${camel}"`);

    // Pattern: "snake_case" (already quoted but wrong)
    const quotedPattern = new RegExp(`"${snake}"`, 'g');
    result = result.replace(quotedPattern, `"${camel}"`);
  }

  return result;
}

module.exports = {
  generateSql,
  extractSql,
  buildTimeConditionHint,
  postProcessSnakeToCamel,
};
