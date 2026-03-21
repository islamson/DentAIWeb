/**
 * Semantic Read Planner — Produces a structured read plan BEFORE SQL generation.
 *
 * Uses the Ollama LLM to analyze the user's question and produce a plan that
 * determines: query type, analysis mode, target entities, fields, metrics,
 * filters, grouping, ordering, and which schema domain(s) are relevant.
 *
 * The plan is NOT SQL — it is a structured intermediate representation that
 * guides the SQL generator and schema slicer.
 */

'use strict';

const { chat, isAvailable } = require('../ollama');
const { createLlmUnavailableError } = require('../llm-query-planner');
const { APPOINTMENT_STATUS_VALUES, TREATMENT_ITEM_STATUS_VALUES } = require('./metric-definitions');

/**
 * Extract JSON from LLM response (may include markdown fences or prose).
 */
function extractJson(raw) {
  let s = String(raw || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    if (s[i] === '}') {
      depth--;
      if (depth === 0) {
        let candidate = s.slice(start, i + 1);
        candidate = candidate.replace(/,\s*([}\]])/g, '$1');
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Build the system prompt for the semantic read planner.
 */
function buildPlannerSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    'Sen DentAI diş kliniği ERP sistemi için bir semantik okuma planlayıcısısın.',
    'Görevin, kullanıcının Türkçe sorusunu analiz edip yapılandırılmış bir okuma planı üretmek.',
    'Bu plan, SQL üretici tarafından kullanılacak. Sen SQL üretmiyorsun.',
    '',
    `Bugünün tarihi: ${today}`,
    '',
    'Veritabanı alanları (domains):',
    '- appointments: randevular, hasta-doktor randevu ilişkileri',
    '- patients: hastalar, hasta bilgileri',
    '- finance: faturalar, ödemeler, tahsilat, ciro, alacak, borç, taksitler',
    '- treatment: tedavi planları, tedavi kalemleri, seanslar',
    '- inventory: stok, malzeme, son kullanma tarihi',
    '- lab: laboratuvar işleri, lab malzemeleri',
    '- doctors: doktor performans, randevu, tedavi, gelir',
    '- operational: operasyonel metrikler, doluluk',
    '',
    'Sorgu türleri (queryType):',
    '- count: sayı sorgusu (kaç tane)',
    '- amount: tutar sorgusu (ne kadar, TL)',
    '- list: listeleme (listele, göster, sırala)',
    '- ratio: oran/yüzde (yüzde kaç, oran)',
    '- comparison: karşılaştırma (geçen aya göre, arttı mı)',
    '- distribution: dağılım (hangi saatlerde, hangi kategoride)',
    '- trend: zaman trendi (aylar bazında, hafta bazında)',
    '- summary: özet bilgi',
    '',
    'Analiz modları (analysisMode):',
    '- simple: tek metrik, tek dönem',
    '- comparison: iki dönem karşılaştırma',
    '- grouped: grup bazlı analiz (doktora göre, saate göre)',
    '- filtered: filtrelenmiş veri (sadece kadın, sadece iptal)',
    '- ranked: sıralama (en çok, en az)',
    '',
    'Zaman filtreleri:',
    '- "bu ay" → timeScope: "this_month"',
    '- "geçen ay" → timeScope: "last_month"',
    '- "bugün" → timeScope: "today"',
    '- "dün" → timeScope: "yesterday"',
    '- "bu hafta" → timeScope: "this_week"',
    '- "bu yıl" → timeScope: "this_year"',
    '- "Ocak 2026" → timeScope: "custom", month: 1, year: 2026',
    '- belirtilmemişse → timeScope: "this_month" (varsayılan)',
    '',
    'Kurallar:',
    '1. Sadece JSON döndür, açıklama yazma.',
    '2. Soru anlaşılmıyorsa needsClarification: true yap.',
    '3. Birden fazla domain gerekebilir (ör. doktor gelir → doctors + finance).',
    '4. Takip soruları (bunları listele, geçen aya göre) için önceki bağlamı kullan.',
    '5. "Hangi" soruları genelde distribution veya ranked queryType alır.',
    '6. Türkçe tıbbi/finans terimlerini doğru anla:',
    '   - tahsilat = collection (ödemeler)',
    '   - ciro = revenue (fatura toplamı)',
    '   - bekleyen tahsilat = pending collection',
    '   - randevu iptali = appointment cancellation',
    '   - no-show / gelmeme = NOSHOW status',
    '',
    'ÖNEMLİ: filters.status için SADECE şu değerleri kullan:',
    '  Randevular: SCHEDULED, CONFIRMED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED, NOSHOW',
    '  ACTIVE diye bir randevu durumu YOK. Randevu sayısı için status verme veya COMPLETED/CANCELLED kullan.',
    '',
    'JSON şeması:',
    '{',
    '  "queryType": "count|amount|list|ratio|comparison|distribution|trend|summary",',
    '  "analysisMode": "simple|comparison|grouped|filtered|ranked",',
    '  "targetEntities": ["appointments"],',
    '  "requestedFields": ["patient_name", "doctor_name"],',
    '  "requestedMetrics": ["count"],',
    '  "filters": {',
    '    "timeScope": "this_month",',
    '    "month": null,',
    '    "year": null,',
    '    "status": null,',
    '    "gender": null,',
    '    "entityName": null,',
    '    "entityType": null',
    '  },',
    '  "groupBy": [],',
    '  "orderBy": [{"field": "count", "direction": "DESC"}],',
    '  "limit": null,',
    '  "needsClarification": false,',
    '  "clarificationQuestion": null,',
    '  "domains": ["appointments"]',
    '}',
    '',
    'Örnekler:',
    '',
    'Soru: "Bu ay kaç randevu vardı?"',
    '{"queryType":"count","analysisMode":"simple","targetEntities":["appointments"],"requestedFields":[],"requestedMetrics":["count"],"filters":{"timeScope":"this_month"},"groupBy":[],"orderBy":[],"limit":null,"needsClarification":false,"clarificationQuestion":null,"domains":["appointments"]}',
    '',
    'Soru: "Bu ay tahsilat ne kadar?"',
    '{"queryType":"amount","analysisMode":"simple","targetEntities":["payments"],"requestedFields":[],"requestedMetrics":["sum_amount"],"filters":{"timeScope":"this_month"},"groupBy":[],"orderBy":[],"limit":null,"needsClarification":false,"clarificationQuestion":null,"domains":["finance"]}',
    '',
    'Soru: "Randevu iptalleri hangi saatlerde yoğunlaşıyor?"',
    '{"queryType":"distribution","analysisMode":"grouped","targetEntities":["appointments"],"requestedFields":["hour","count"],"requestedMetrics":["count"],"filters":{"timeScope":"this_month","status":"CANCELLED"},"groupBy":["hour"],"orderBy":[{"field":"count","direction":"DESC"}],"limit":24,"needsClarification":false,"clarificationQuestion":null,"domains":["appointments"]}',
    '',
    'Soru: "Hangi doktorun verimi düştü?"',
    '{"queryType":"comparison","analysisMode":"grouped","targetEntities":["treatment_items","users"],"requestedFields":["doctor_name","current_count","previous_count","change"],"requestedMetrics":["count"],"filters":{"timeScope":"this_month","status":"COMPLETED","comparePrevious":true},"groupBy":["doctor_name"],"orderBy":[{"field":"change","direction":"ASC"}],"limit":10,"needsClarification":false,"clarificationQuestion":null,"domains":["doctors","treatment"]}',
    '',
    'Soru: "Ayşe hocanın bu ay tamamladığı tedavi sayısı kaç?"',
    '{"queryType":"count","analysisMode":"filtered","targetEntities":["treatment_items"],"requestedFields":[],"requestedMetrics":["count"],"filters":{"timeScope":"this_month","entityName":"Ayşe","entityType":"doctor"},"groupBy":[],"orderBy":[],"limit":null,"needsClarification":false,"clarificationQuestion":null,"domains":["treatment","doctors"]}',
    '',
    'Soru: "Bu ay gelen hastalardan yüzde kaçı kadın?"',
    '{"queryType":"ratio","analysisMode":"filtered","targetEntities":["appointments","patients"],"requestedFields":["gender_ratio"],"requestedMetrics":["percentage"],"filters":{"timeScope":"this_month","gender":"female"},"groupBy":["gender"],"orderBy":[],"limit":null,"needsClarification":false,"clarificationQuestion":null,"domains":["appointments","patients"]}',
  ].join('\n');
}

/**
 * Build context messages for follow-up / memory inheritance.
 */
function buildMemoryContext(memory) {
  if (!memory) return null;
  const parts = [];
  if (memory.lastReadPlan) {
    parts.push(`Önceki sorgu planı: ${JSON.stringify(memory.lastReadPlan)}`);
  }
  if (memory.lastQueryState) {
    parts.push(`Önceki sorgu durumu: intent=${memory.lastQueryState.intent}, metric=${memory.lastQueryState.metric}, timeScope=${memory.lastQueryState.timeScope}`);
  }
  if (memory.lastResolvedDoctor?.name) {
    parts.push(`Son çözümlenen doktor: ${memory.lastResolvedDoctor.name}`);
  }
  if (memory.lastResolvedPatient?.name) {
    parts.push(`Son çözümlenen hasta: ${memory.lastResolvedPatient.name}`);
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

function applyDeterministicReadPlanOverrides(message, plan) {
  const q = String(message || '').toLocaleLowerCase('tr-TR');

  // 1) Ambiguous finance wording -> clarification
  if (q.includes('ödeme performansı')) {
    return {
      ...plan,
      queryType: 'summary',
      analysisMode: 'simple',
      targetEntities: ['payments', 'invoices'],
      requestedFields: [],
      requestedMetrics: [],
      filters: {
        ...(plan.filters || {}),
        timeScope: plan.filters?.timeScope || 'this_month',
      },
      groupBy: [],
      orderBy: [],
      limit: null,
      needsClarification: true,
      clarificationQuestion:
        '“Ödeme performansı” ile neyi kastettiğinizi netleştirebilir misiniz? Örneğin: toplam tahsilat, bekleyen tahsilat, açık bakiye, hasta bazlı ödeme düzeni veya gecikmiş ödeme oranı.',
      domains: ['finance'],
    };
  }

  // 2) Doctor efficiency comparison -> force canonical metric
  if (
    q.includes('hangi doktorun verimi azaldı') ||
    q.includes('hangi doktorun verimi düştü') ||
    q.includes('doktorun verimi azaldı') ||
    q.includes('doktorun verimi düştü')
  ) {
    return {
      ...plan,
      queryType: 'comparison',
      analysisMode: 'grouped',
      targetEntities: ['treatment_items', 'users'],
      requestedFields: ['doctor_name', 'current_efficiency', 'previous_efficiency', 'change'],
      requestedMetrics: ['doctor_efficiency'],
      filters: {
        ...(plan.filters || {}),
        timeScope: plan.filters?.timeScope || 'this_month',
        status: 'COMPLETED',
        comparePrevious: true,
      },
      groupBy: ['doctor_name'],
      orderBy: [{ field: 'change', direction: 'ASC' }],
      limit: 10,
      needsClarification: false,
      clarificationQuestion: null,
      domains: ['doctors', 'treatment'],
    };
  }

  return plan;
}

/**
 * Generate a semantic read plan from a user message.
 *
 * @param {string} message - user message
 * @param {Object} opts
 * @param {Object[]} opts.history - chat history
 * @param {Object} opts.memory - conversation memory
 * @param {Object} opts.semanticContext - from business-ontology analysis
 * @returns {Promise<{ plan: Object, modelUsed: string }>}
 */
async function generateReadPlan(message, opts = {}) {
  const { history = [], memory = null, semanticContext = null } = opts;

  const available = await isAvailable();
  if (!available) {
    throw createLlmUnavailableError('Semantic planner: Ollama erişilemiyor');
  }

  const messages = [{ role: 'system', content: buildPlannerSystemPrompt() }];

  // Add memory context
  const memCtx = buildMemoryContext(memory);
  if (memCtx) {
    messages.push({
      role: 'system',
      content: `Konuşma bağlamı (takip soruları için kullan):\n${memCtx}`,
    });
  }

  // Add semantic hints from business ontology
  if (semanticContext) {
    const hints = {
      normalizedQuery: semanticContext.normalizedQuery,
      primaryMetricHint: semanticContext.primaryMetricHint || null,
      timeScopeHint: semanticContext.timeScopeHint || null,
      compareToPrevious: semanticContext.compareToPrevious || false,
      inheritanceHint: semanticContext.inheritanceHint || false,
      listIntent: semanticContext.listIntent || false,
    };
    messages.push({
      role: 'system',
      content: `Backend semantic ipuçları: ${JSON.stringify(hints)}`,
    });
  }

  // Add recent history
  const recent = (history || []).slice(-6);
  for (const item of recent) {
    if (item?.role === 'user' || item?.role === 'assistant') {
      messages.push({
        role: item.role,
        content: String(item.content || '').slice(0, 1000),
      });
    }
  }

  messages.push({ role: 'user', content: String(message || '').trim() });

  let content;
  try {
    ({ content } = await chat(messages));
  } catch (err) {
    throw createLlmUnavailableError(err.message);
  }

  let plan = extractJson(content);

  // Retry once if parse failed
  if (!plan) {
    try {
      ({ content } = await chat(messages));
      plan = extractJson(content);
    } catch {
      // ignore retry failure
    }
  }

  if (!plan) {
    // Return a safe default plan
    return {
      plan: {
        queryType: 'summary',
        analysisMode: 'simple',
        targetEntities: ['appointments'],
        requestedFields: [],
        requestedMetrics: ['count'],
        filters: { timeScope: 'this_month' },
        groupBy: [],
        orderBy: [],
        limit: null,
        needsClarification: true,
        clarificationQuestion: 'Sorunuzu anlayamadım. Lütfen tekrar ifade eder misiniz?',
        domains: ['appointments'],
      },
      modelUsed: null,
    };
  }

  // Sanitize and default fields
  plan.queryType = plan.queryType || 'summary';
  plan.analysisMode = plan.analysisMode || 'simple';
  plan.targetEntities = plan.targetEntities || [];
  plan.requestedFields = plan.requestedFields || [];
  plan.requestedMetrics = plan.requestedMetrics || [];
  plan.filters = plan.filters || {};
  plan.groupBy = plan.groupBy || [];
  plan.orderBy = plan.orderBy || [];
  plan.limit = plan.limit || null;
  plan.needsClarification = !!plan.needsClarification;
  plan.clarificationQuestion = plan.clarificationQuestion || null;
  plan.domains = plan.domains || ['appointments'];

  // Apply default timeScope if missing
  if (!plan.filters.timeScope || plan.filters.timeScope === 'none') {
    plan.filters.timeScope = 'this_month';
  }

  // Sanitize filters: strip invalid enum values (planner must not invent ACTIVE etc.)
  if (plan.filters.status) {
    const s = String(plan.filters.status).toUpperCase();
    const validAppointment = APPOINTMENT_STATUS_VALUES.includes(s);
    const validTreatment = TREATMENT_ITEM_STATUS_VALUES.includes(s);
    if (!validAppointment && !validTreatment) {
      delete plan.filters.status;
    } else if (plan.targetEntities?.some((e) => String(e).toLowerCase().includes('treatment'))) {
      plan.filters.status = validTreatment ? s : null;
      if (!validTreatment) delete plan.filters.status;
    } else {
      plan.filters.status = validAppointment ? s : null;
      if (!validAppointment) delete plan.filters.status;
    }
  }

  plan = applyDeterministicReadPlanOverrides(message, plan);

  return {
    plan,
    modelUsed: 'ollama',
  };
}

module.exports = {
  generateReadPlan,
  buildPlannerSystemPrompt,
  extractJson,
  applyDeterministicReadPlanOverrides,
};
