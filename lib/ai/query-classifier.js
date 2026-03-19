/**
 * Deterministic Query Classifier - Rule-based domain + entity type mapping.
 * Uses normalization layer, synonym expansion, keyword clusters, secondary fallback.
 * No LLM. Maps user question to domain and entityType.
 */

const { normalize } = require('./query-normalizer');

const REFERENTIAL_PHRASES = [
  'peki ne kadar', 'peki borcu', 'peki ne', 'peki son', 'peki o', 'peki bu',
  'ne kadar borcu', 'son randevusu', 'son ödemesi', 'son işlem', 'son hareket',
  'randevuların kaçı', 'bu randevuların', 'o planın', 'bu planın', 'bunun tüm', 'bu cari ile', 'bu hesabın', 'o hesabın', 'onun borcu',
  'tedavi kalemlerini', 'planın detaylarını', 'plandaki tedavi', 'bu cari',
];

const PATIENT_POSSESSIVE = /^(.+?)[''](?:nın|nin|nun|nün|ın|in|un|ün)\s/i;
const CURRENT_ACCOUNT_PATTERNS = [
  /(.+?)\s+firmas?(?:ına|aya|ı)\s/i,
  /(.+?)\s+cari\s+hesab(?:ı|ının)\s/i,
  /(.+?)\s+tedarikçi(?:ye|sine)?\s/i,
  /(.+?)\s+laboratuvar(?:ına|a)?\s/i,
  /(.+?)\s+medikal(?:\s|e|a|i)/i,
];
const TREATMENT_PLAN_PATTERNS = [
  /(.+?)\s+adlı\s+plan/i,
  /(.+?)\s+plan(?:ı|ındaki|daki)\s/i,
  /plan(?:ı|ındaki)\s+(.+?)(?:\s|$)/i,
];
const DOCTOR_PATTERNS = [
  /Dr\.?\s*(.+?)[''](?:ın|in|ün|un)\s/i,
  /Dr\.?\s+(.+?)[''](?:ın|in)\s+(?:bugünkü\s+)?program/i,
  /doktor\s+(.+?)(?:\s|$)/i,
  /Dr\.?\s+(.+?)(?=\s|$)/i,
];

const DOMAINS = {
  patient_balance: 'patient_balance',
  patient_last_payment: 'patient_last_payment',
  patient_summary: 'patient_summary',
  patient_appointments: 'patient_appointments',
  patient_treatment_plans: 'patient_treatment_plans',
  patient_treatment_plan_details: 'patient_treatment_plan_details',
  doctor_schedule: 'doctor_schedule',
  monthly_finance_summary: 'monthly_finance_summary',
  today_collection_summary: 'today_collection_summary',
  today_appointment_count: 'today_appointment_count',
  today_patient_count: 'today_patient_count',
  monthly_appointment_count: 'monthly_appointment_count',
  monthly_appointment_count_for_doctor: 'monthly_appointment_count_for_doctor',
  today_appointment_count_for_doctor: 'today_appointment_count_for_doctor',
  overdue_installment_patients: 'overdue_installment_patients',
  patient_treatment_progress: 'patient_treatment_progress',
  doctor_treatment_performance: 'doctor_treatment_performance',
  current_account_balance: 'current_account_balance',
  current_account_transactions: 'current_account_transactions',
  low_stock_products: 'low_stock_products',
  clinic_overview: 'clinic_overview',
  unsupported_query: 'unsupported_query',
};

const ENTITY_TYPES = {
  patient: 'patient',
  current_account: 'current_account',
  doctor: 'doctor',
  inventory_product: 'inventory_product',
  treatment_plan: 'treatment_plan',
  none: 'none',
};

// Keyword clusters for secondary fallback (domain -> keywords that suggest it)
const FALLBACK_KEYWORD_CLUSTERS = {
  [DOMAINS.today_appointment_count]: ['bugün', 'randevu', 'kaç', 'sayı', 'ne kadar', 'today', 'appointment'],
  [DOMAINS.today_collection_summary]: ['bugün', 'tahsilat', 'ödeme', 'ciro', 'gelir', 'today', 'collection', 'payment'],
  [DOMAINS.monthly_finance_summary]: ['bu ay', 'aylık', 'ciro', 'tahsilat', 'gelir', 'ödeme', 'month', 'revenue'],
  [DOMAINS.low_stock_products]: ['düşük', 'stok', 'ürün', 'minimum', 'azalan', 'low', 'stock'],
  [DOMAINS.clinic_overview]: ['bugün', 'randevu', 'günün', 'listele', 'göster', 'today', 'appointment'],
};

function extractPatientName(msg) {
  const t = (msg || '').trim();
  const m = t.match(PATIENT_POSSESSIVE);
  if (m) return m[1].trim();
  const isimli = t.match(/(.+?)\s+isimli\s+hastanın/i);
  if (isimli) return isimli[1].trim();
  const icin = t.match(/(.+?)\s+(?:için|hastası|hastasının|hasta\s+özet)/i);
  if (icin) return icin[1].trim();
  return null;
}

function extractCurrentAccountName(msg) {
  const t = (msg || '').trim();
  for (const p of CURRENT_ACCOUNT_PATTERNS) {
    const m = t.match(p);
    if (m && m[1]?.trim()) return m[1].trim();
  }
  return null;
}

function extractTreatmentPlanName(msg) {
  const t = (msg || '').trim();
  for (const p of TREATMENT_PLAN_PATTERNS) {
    const m = t.match(p);
    if (m && m[1]?.trim()) return m[1].trim();
  }
  return null;
}

function extractDoctorName(msg) {
  const t = (msg || '').trim();
  for (const p of DOCTOR_PATTERNS) {
    const m = t.match(p);
    if (m && m[1]?.trim()) return m[1].trim();
  }
  return null;
}

function isReferential(msg, memory) {
  const n = (msg || '').trim().toLowerCase();
  const hasRef = REFERENTIAL_PHRASES.some((p) => n.includes(p));
  const hasExplicit = !!(
    extractPatientName(msg) ||
    extractCurrentAccountName(msg) ||
    extractDoctorName(msg) ||
    extractTreatmentPlanName(msg)
  );
  return hasRef && !hasExplicit && memory;
}

/**
 * Secondary fallback: score domains by keyword overlap.
 * Returns best domain if score >= 2, else null.
 */
function secondaryFallbackMatch(norm) {
  let bestDomain = null;
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(FALLBACK_KEYWORD_CLUSTERS)) {
    const score = keywords.filter((kw) => norm.includes(kw)).length;
    if (score >= 2 && score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain ? { domain: bestDomain, score: bestScore } : null;
}

/**
 * Classify message into domain + entityType.
 * @param {string} message
 * @param {Object} memory - Conversation memory
 * @returns {Object} { domain, entityType, confidence, needsClarification, clarificationReason, extractedParams, rawQuery, normalizedQuery, matchedRule, matchedKeywords, fallbackStage }
 */
function classify(message, memory = null) {
  const { normalized: norm, raw: rawQuery } = normalize(message || '');
  const meta = { rawQuery, normalizedQuery: norm, matchedRule: null, matchedKeywords: [], fallbackStage: false };

  if (!norm) {
    return {
      domain: DOMAINS.unsupported_query,
      entityType: ENTITY_TYPES.none,
      confidence: 0,
      needsClarification: true,
      clarificationReason: 'Lütfen bir soru veya istek yazın.',
      extractedParams: {},
      ...meta,
    };
  }

  const patientName = extractPatientName(rawQuery);
  const currentAccountName = extractCurrentAccountName(rawQuery);
  const treatmentPlanName = extractTreatmentPlanName(rawQuery);
  const doctorName = extractDoctorName(rawQuery);
  const isRef = isReferential(rawQuery, memory);

  // ---- TODAY-SCOPED (check before monthly - order matters) ----
  // Today appointment count: "bugün kaç randevu", "bugün ne kadar randevu vardı", "randevuları göster", "today appointment count"
  if (/\bbugün\b/.test(norm) && /randevu/.test(norm)) {
    meta.matchedRule = 'today+randevu';
    meta.matchedKeywords = ['bugün', 'randevu'];
    return {
      domain: DOMAINS.today_appointment_count,
      entityType: ENTITY_TYPES.none,
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: {},
      ...meta,
    };
  }

  // Today collection: "bugünkü tahsilat", "bugün tahsilat ne kadar", "bugün ödeme"
  if (/\bbugün\b/.test(norm) && /\b(tahsilat|ödeme|ciro|gelir)\b/.test(norm)) {
    meta.matchedRule = 'today+finance';
    meta.matchedKeywords = ['bugün', 'tahsilat|ödeme|ciro|gelir'];
    return {
      domain: DOMAINS.today_collection_summary,
      entityType: ENTITY_TYPES.none,
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: {},
      ...meta,
    };
  }

  // Today patient count: "bugün kaç hasta geldi", "bugün kaç hasta"
  if (/\bbugün\b/.test(norm) && /\bhasta\b/.test(norm)) {
    meta.matchedRule = 'today+hasta';
    meta.matchedKeywords = ['bugün', 'hasta'];
    return {
      domain: DOMAINS.today_patient_count,
      entityType: ENTITY_TYPES.none,
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: {},
      ...meta,
    };
  }

  // ---- PATIENT TREATMENT PROGRESS ----
  if (patientName && /tedavisinin\s+(yüzde\s+)?kaçı\s+tamamlandı|tedavisinin\s+kaç\s+tl|kaç\s+tl['']?lik\s+kısmı\s+tamamlandı|tedavisinin\s+yüzde\s+kaçı/.test(norm)) {
    meta.matchedRule = 'patient_treatment_progress';
    return {
      domain: DOMAINS.patient_treatment_progress,
      entityType: ENTITY_TYPES.patient,
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: { patientQuery: patientName, patientId: memory?.lastResolvedPatient?.id || null },
      ...meta,
    };
  }

  // ---- DOCTOR-SCOPED APPOINTMENT (before generic monthly - order matters) ----
  // "Peki bu randevuların kaçı Dr. Ayşe Demir'indı?" - follow-up with doctor filter
  if ((doctorName || (isRef && memory?.lastResolvedDoctor)) && /randevuların\s+kaçı|randevuların\s+kaç\s+tanesi/.test(norm)) {
    const now = new Date();
    meta.matchedRule = 'monthly_appointment_for_doctor_followup';
    return {
      domain: DOMAINS.monthly_appointment_count_for_doctor,
      entityType: ENTITY_TYPES.doctor,
      confidence: 0.95,
      needsClarification: !doctorName && !memory?.lastResolvedDoctor?.id,
      clarificationReason: 'Hangi doktoru kastediyorsunuz?',
      extractedParams: {
        doctorQuery: doctorName || null,
        doctorId: memory?.lastResolvedDoctor?.id || null,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
      ...meta,
    };
  }
  if (doctorName && /randevu/.test(norm)) {
    if (/\bbugün\b/.test(norm)) {
      meta.matchedRule = 'today_appointment_for_doctor';
      return {
        domain: DOMAINS.today_appointment_count_for_doctor,
        entityType: ENTITY_TYPES.doctor,
        confidence: 0.95,
        needsClarification: false,
        clarificationReason: null,
        extractedParams: {
          doctorQuery: doctorName,
          doctorId: memory?.lastResolvedDoctor?.id || null,
          date: new Date().toISOString().slice(0, 10),
        },
        ...meta,
      };
    }
    if (/\bbu ay\b/.test(norm) || /\b(mart|ocak|şubat|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+ayı?\b/.test(norm)) {
      const now = new Date();
      const monthMap = { ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6, temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12 };
      const monthMatch = norm.match(/\b(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+ayı?\b/);
      const month = monthMatch ? (monthMap[monthMatch[1].toLowerCase()] ?? now.getMonth() + 1) : now.getMonth() + 1;
      const year = now.getFullYear();
      meta.matchedRule = 'monthly_appointment_for_doctor';
      return {
        domain: DOMAINS.monthly_appointment_count_for_doctor,
        entityType: ENTITY_TYPES.doctor,
        confidence: 0.95,
        needsClarification: false,
        clarificationReason: null,
        extractedParams: {
          doctorQuery: doctorName,
          doctorId: memory?.lastResolvedDoctor?.id || null,
          month,
          year,
        },
        ...meta,
      };
    }
  }

  // ---- DOCTOR TREATMENT PERFORMANCE ----
  if (doctorName && /tamamladığı\s+tedavi\s+kalem|tedavi\s+kalemi\s+sayısı|bu ay\s+tamamladı/.test(norm)) {
    const now = new Date();
    meta.matchedRule = 'doctor_treatment_performance';
    return {
      domain: DOMAINS.doctor_treatment_performance,
      entityType: ENTITY_TYPES.doctor,
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: {
        doctorQuery: doctorName,
        doctorId: memory?.lastResolvedDoctor?.id || null,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
      ...meta,
    };
  }

  // ---- MONTHLY APPOINTMENT COUNT ----
  const monthlyAppointmentMatch = !/\bbugün\b/.test(norm) && /randevu/.test(norm) && !/tahsilat|ciro|gelir|ödeme\b/.test(norm) &&
    (/\bbu ay\b/.test(norm) || /\b(mart|ocak|şubat|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+ayı?\b/.test(norm));
  if (monthlyAppointmentMatch) {
    const now = new Date();
    const monthMap = { ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6, temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12 };
    const monthMatch = norm.match(/\b(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+ayı?\b/);
    const month = monthMatch ? (monthMap[monthMatch[1].toLowerCase()] ?? now.getMonth() + 1) : now.getMonth() + 1;
    const year = now.getFullYear();
    meta.matchedRule = 'monthly_appointment';
    return {
      domain: DOMAINS.monthly_appointment_count,
      entityType: ENTITY_TYPES.none,
      confidence: 0.9,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: { month, year },
      ...meta,
    };
  }

  // ---- MONTHLY / CLINIC (no today) ----
  // Monthly finance - must NOT be today-scoped
  if (!/\bbugün\b/.test(norm) && /\b(bu ay|ayki|aylık|tahsilat|ciro|gelir|ödeme aldık)\b/.test(norm)) {
    const now = new Date();
    const monthMap = { ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6, temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12 };
    const monthMatch = norm.match(/\b(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+ayı?\b/);
    const month = monthMatch ? (monthMap[monthMatch[1].toLowerCase()] ?? now.getMonth() + 1) : now.getMonth() + 1;
    const year = now.getFullYear();
    meta.matchedRule = 'monthly_finance';
    meta.matchedKeywords = ['bu ay|ciro|tahsilat|gelir'];
    return {
      domain: DOMAINS.monthly_finance_summary,
      entityType: ENTITY_TYPES.none,
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: { month, year },
      ...meta,
    };
  }

  // Clinic overview / today appointments (generic "bugünkü randevuları göster" - already caught above, but catch "günün randevu" without "bugün")
  if (/\b(bugünkü randevu|günün randevu|randevuları göster|randevu listesi)\b/.test(norm)) {
    meta.matchedRule = 'clinic_overview';
    meta.matchedKeywords = ['randevu'];
    return {
      domain: DOMAINS.clinic_overview,
      entityType: ENTITY_TYPES.none,
      confidence: 0.9,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: {},
      ...meta,
    };
  }

  // ---- OVERDUE INSTALLMENT / RECEIVABLES ----
  if (/\b(gecikmiş|gecikmis|vadesi geçmiş|vadesi geçen|overdue)\s+(taksit|ödeme|installment)\b/.test(norm) ||
      /\b(tahsil edilmemiş|tahsil edilmemis)\s+(gecikmiş|gecikmis)?\s*(taksit|ödeme)?\b/.test(norm) ||
      /\bgecikmiş taksit\b/.test(norm) ||
      /\bvadesi geçmiş ödemesi olan hastalar\b/.test(norm) ||
      (/\btaksit\b/.test(norm) && /\b(gecikmiş|gecikmis|vadesi geçmiş|var mı|hasta)\b/.test(norm))) {
    meta.matchedRule = 'overdue_installment';
    return {
      domain: DOMAINS.overdue_installment_patients,
      entityType: ENTITY_TYPES.none,
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: {},
      ...meta,
    };
  }

  // ---- LOW STOCK (broad patterns) ----
  if (/\b(düşük stok|stokta.*ürün|stoktaki ürün|azalan stok|minimum stok|düşük stokta|hangi ürünler)\b/.test(norm) || (/\bstok\b/.test(norm) && /\b(düşük|azalan|ürün)\b/.test(norm))) {
    meta.matchedRule = 'low_stock';
    meta.matchedKeywords = ['stok', 'düşük|ürün'];
    return {
      domain: DOMAINS.low_stock_products,
      entityType: ENTITY_TYPES.inventory_product,
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: {},
      ...meta,
    };
  }

  // ---- ENTITY-SCOPED (current account, treatment plan, patient, doctor) ----
  if (currentAccountName || (isRef && memory?.lastResolvedCurrentAccount)) {
    if (/\b(borcumuz|borcu ne|bakiyesi|cari bakiye|ne kadar borc|firmasına|firmaya|tedarikçi|şirket)\b/.test(norm)) {
      meta.matchedRule = 'current_account_balance';
      return {
        domain: DOMAINS.current_account_balance,
        entityType: ENTITY_TYPES.current_account,
        confidence: 0.95,
        needsClarification: !currentAccountName && !memory?.lastResolvedCurrentAccount?.id,
        clarificationReason: 'Hangi cari hesabı kastediyorsunuz?',
        extractedParams: {
          currentAccountQuery: currentAccountName || null,
          currentAccountId: memory?.lastResolvedCurrentAccount?.id || null,
        },
        ...meta,
      };
    }
    if (/\b(tüm işlem|işlemleri özetle|işlemleri listele|finansal işlem|son işlem|hareketler)\b/.test(norm)) {
      meta.matchedRule = 'current_account_transactions';
      return {
        domain: DOMAINS.current_account_transactions,
        entityType: ENTITY_TYPES.current_account,
        confidence: 0.95,
        needsClarification: !currentAccountName && !memory?.lastResolvedCurrentAccount?.id,
        clarificationReason: 'Hangi cari hesabı kastediyorsunuz?',
        extractedParams: {
          currentAccountQuery: currentAccountName || null,
          currentAccountId: memory?.lastResolvedCurrentAccount?.id || null,
        },
        ...meta,
      };
    }
  }

  if (treatmentPlanName || (isRef && memory?.lastResolvedTreatmentPlan)) {
    if (/\b(tedavi kalem|plan.*detay|tamamlanma|fiyat|plandaki)\b/.test(norm)) {
      meta.matchedRule = 'treatment_plan_details';
      return {
        domain: DOMAINS.patient_treatment_plan_details,
        entityType: ENTITY_TYPES.treatment_plan,
        confidence: 0.95,
        needsClarification:
          !treatmentPlanName &&
          !memory?.lastResolvedTreatmentPlan?.id &&
          !memory?.lastResolvedPatient?.id,
        clarificationReason: memory?.lastResolvedPatient?.id
          ? 'Hangi tedavi planını kastediyorsunuz?'
          : 'Hangi hastanın tedavi planını kastediyorsunuz?',
        extractedParams: {
          treatmentPlanQuery: treatmentPlanName || null,
          treatmentPlanId: memory?.lastResolvedTreatmentPlan?.id || null,
          patientId: memory?.lastResolvedPatient?.id || null,
        },
        ...meta,
      };
    }
  }

  if (patientName || (isRef && memory?.lastResolvedPatient)) {
    if (/\b(tedavi planlarını|tedavi planları|planlarını listele)\b/.test(norm)) {
      meta.matchedRule = 'patient_treatment_plans';
      return {
        domain: DOMAINS.patient_treatment_plans,
        entityType: ENTITY_TYPES.patient,
        confidence: 0.95,
        needsClarification: !patientName && !memory?.lastResolvedPatient?.id,
        clarificationReason: 'Hangi hastayı kastediyorsunuz?',
        extractedParams: {
          patientQuery: patientName || null,
          patientId: memory?.lastResolvedPatient?.id || null,
        },
        ...meta,
      };
    }
    if (/\b(ne kadar borcu|borcu var|kalan borç|kalan bakiye|bakiyesi ne|borç durumu)\b/.test(norm)) {
      meta.matchedRule = 'patient_balance';
      return {
        domain: DOMAINS.patient_balance,
        entityType: ENTITY_TYPES.patient,
        confidence: 0.95,
        needsClarification: !patientName && !memory?.lastResolvedPatient?.id,
        clarificationReason: 'Hangi hastayı kastediyorsunuz?',
        extractedParams: {
          patientQuery: patientName || null,
          patientId: memory?.lastResolvedPatient?.id || null,
        },
        ...meta,
      };
    }
    if (/\b(son ödemesi|son ödeme|ne zaman ödedi|ödeme tarihi|son tahsilat)\b/.test(norm)) {
      meta.matchedRule = 'patient_last_payment';
      return {
        domain: DOMAINS.patient_last_payment,
        entityType: ENTITY_TYPES.patient,
        confidence: 0.95,
        needsClarification: !patientName && !memory?.lastResolvedPatient?.id,
        clarificationReason: 'Hangi hastayı kastediyorsunuz?',
        extractedParams: {
          patientQuery: patientName || null,
          patientId: memory?.lastResolvedPatient?.id || null,
        },
        ...meta,
      };
    }
    if (/\b(son randevusu|son randevu|özeti|özetini|bilgisi|detayı|hasta özet)\b/.test(norm)) {
      if (/\bson randevu\b/.test(norm)) {
        meta.matchedRule = 'patient_appointments';
        return {
          domain: DOMAINS.patient_appointments,
          entityType: ENTITY_TYPES.patient,
          confidence: 0.9,
          needsClarification: !patientName && !memory?.lastResolvedPatient?.id,
          clarificationReason: 'Hangi hastayı kastediyorsunuz?',
          extractedParams: {
            patientQuery: patientName || null,
            patientId: memory?.lastResolvedPatient?.id || null,
          },
          ...meta,
        };
      }
      meta.matchedRule = 'patient_summary';
      return {
        domain: DOMAINS.patient_summary,
        entityType: ENTITY_TYPES.patient,
        confidence: 0.9,
        needsClarification: !patientName && !memory?.lastResolvedPatient?.id,
        clarificationReason: 'Hangi hastayı kastediyorsunuz?',
        extractedParams: {
          patientQuery: patientName || null,
          patientId: memory?.lastResolvedPatient?.id || null,
        },
        ...meta,
      };
    }
  }

  if (currentAccountName) {
    if (/\b(borcumuz|borcu|bakiye|cari)\b/.test(norm)) {
      meta.matchedRule = 'current_account_balance_explicit';
      return {
        domain: DOMAINS.current_account_balance,
        entityType: ENTITY_TYPES.current_account,
        confidence: 0.95,
        needsClarification: false,
        clarificationReason: null,
        extractedParams: { currentAccountQuery: currentAccountName },
        ...meta,
      };
    }
    if (/\b(işlem|hareket|özetle)\b/.test(norm)) {
      meta.matchedRule = 'current_account_transactions_explicit';
      return {
        domain: DOMAINS.current_account_transactions,
        entityType: ENTITY_TYPES.current_account,
        confidence: 0.95,
        needsClarification: false,
        clarificationReason: null,
        extractedParams: { currentAccountQuery: currentAccountName },
        ...meta,
      };
    }
  }

  if (doctorName || (isRef && memory?.lastResolvedDoctor)) {
    if (/\b(program|takvim|randevu|bugünkü)\b/.test(norm)) {
      meta.matchedRule = 'doctor_schedule';
      return {
        domain: DOMAINS.doctor_schedule,
        entityType: ENTITY_TYPES.doctor,
        confidence: 0.9,
        needsClarification: !doctorName && !memory?.lastResolvedDoctor?.id,
        clarificationReason: 'Hangi doktoru kastediyorsunuz?',
        extractedParams: {
          doctorQuery: doctorName || null,
          doctorId: memory?.lastResolvedDoctor?.id || null,
          date: new Date().toISOString().slice(0, 10),
        },
        ...meta,
      };
    }
  }

  // ---- SECONDARY FALLBACK ----
  const fallback = secondaryFallbackMatch(norm);
  if (fallback) {
    meta.fallbackStage = true;
    meta.matchedRule = `fallback:${fallback.domain}`;
    return {
      domain: fallback.domain,
      entityType: ENTITY_TYPES.none,
      confidence: 0.7,
      needsClarification: false,
      clarificationReason: null,
      extractedParams: {},
      ...meta,
    };
  }

  // ---- UNSUPPORTED ----
  return {
    domain: DOMAINS.unsupported_query,
    entityType: ENTITY_TYPES.none,
    confidence: 0,
    needsClarification: true,
    clarificationReason: 'Bu soruyu şu an anlayamadım. Randevu, tahsilat, stok veya hasta bilgisi sorabilirsiniz.',
    extractedParams: {},
    ...meta,
  };
}

module.exports = {
  classify,
  DOMAINS,
  ENTITY_TYPES,
  extractPatientName,
  extractCurrentAccountName,
  extractTreatmentPlanName,
  extractDoctorName,
  secondaryFallbackMatch,
};
