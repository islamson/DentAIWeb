/**
 * Conversational failure/clarification layer.
 * Produces natural, user-friendly responses for non-success cases.
 * Never exposes internal terms (metric, intent, executor, Prisma, etc.).
 */

const { chat, isAvailable } = require('./ollama');
const { createLlmUnavailableError } = require('./llm-query-planner');

const USE_LLM_FOR_CLARIFICATION = process.env.USE_LLM_CLARIFICATION !== 'false';

const CLARIFICATION_TEMPLATES = {
  missing_patient: {
    base: 'Hangi hastayı kastediyorsunuz?',
    withCandidates: 'Birden fazla hasta eşleşti. Hangisini kastediyorsunuz?',
  },
  missing_doctor: {
    base: 'Hangi doktoru kastediyorsunuz?',
    withCandidates: 'Birden fazla doktor eşleşti. Hangisini kastediyorsunuz?',
  },
  missing_current_account: {
    base: 'Hangi firma veya cari hesabı kastediyorsunuz?',
    withCandidates: 'Birden fazla cari hesap eşleşti. Hangisini kastediyorsunuz?',
  },
  missing_time_scope: {
    base: 'Bu ayı mı, geçen ayı mı soruyorsunuz? Belirli bir dönem söyleyebilir misiniz?',
  },
  missing_time_scope_finance: {
    base: 'Bu finans bilgisi için hangi dönemi istediğinizi belirtir misiniz? Örneğin bu ay, geçen ay veya belirli bir tarih aralığı.',
  },
  missing_custom_range: {
    base: 'Özel dönem için ay ve yıl veya tarih aralığı belirtir misiniz?',
  },
  missing_metric: {
    base: 'Tam olarak neyi öğrenmek istiyorsunuz? Örneğin toplam tahsilat, bekleyen tahsilat veya vadesi geçmiş alacak.',
  },
  patient_not_found: 'Belirttiğiniz hasta bulunamadı.',
  doctor_not_found: 'Belirttiğiniz doktor bulunamadı.',
  account_not_found: 'Belirttiğiniz cari hesap bulunamadı.',
  generic: 'Lütfen sorunuzu biraz daha netleştirir misiniz?',
};

const UNSUPPORTED_TEMPLATES = {
  intent_unknown: 'Bu tür soru henüz desteklenmiyor. İsterseniz hasta bakiyesi, tahsilat özeti veya randevu bilgisi gibi konularda yardımcı olabilirim.',
  intent_metric_mismatch: 'Bu soru türü için gerekli bilgi henüz mevcut değil. Şu anda hasta sayısı, tahsilat özeti, randevu sayısı gibi konularda yardımcı olabilirim.',
  finance_metric_unknown: 'Bu finans bilgisi türü henüz desteklenmiyor. Toplam tahsilat, bekleyen tahsilat veya vadesi geçmiş alacak gibi konularda destek veriyorum.',
  time_scope_unsupported: 'Bu dönem için henüz desteklenmiyor. Bu ay, geçen ay veya belirli bir ay/yıl seçebilirsiniz.',
  comparison_unsupported: 'Bu karşılaştırma henüz desteklenmiyor. Şu anda tek dönem bazlı sorguları yanıtlayabiliyorum.',
  retrieval_not_found: 'Bu sorgu türü henüz desteklenmiyor. Hasta, doktor, tahsilat veya randevu bilgileri için yardımcı olabilirim.',
  generic: 'Bu özellik şu an desteklenmiyor. İsterseniz başka bir konuda yardımcı olabilirim.',
};

const SEMANTIC_MISMATCH_TEMPLATES = {
  finance_metric: 'Sorunuzun işaret ettiği bilgi ile anladığım uyuşmuyor. Yanlış cevap vermemek için lütfen netleştirir misiniz? Örneğin "toplam tahsilat", "bekleyen tahsilat" veya "vadesi geçmiş alacak" diyebilirsiniz.',
  generic: 'Tam olarak neyi sorduğunuzu anlayamadım. Lütfen biraz daha net ifade eder misiniz?',
};

function mapClarificationToTemplate(question, candidates, plan) {
  const q = (question || '').toLowerCase();
  if (candidates?.length) {
    if (q.includes('hasta')) return CLARIFICATION_TEMPLATES.missing_patient.withCandidates;
    if (q.includes('doktor')) return CLARIFICATION_TEMPLATES.missing_doctor.withCandidates;
    if (q.includes('cari') || q.includes('firma')) return CLARIFICATION_TEMPLATES.missing_current_account.withCandidates;
  }
  if (q.includes('hasta') && q.includes('bulunamadı')) return CLARIFICATION_TEMPLATES.patient_not_found;
  if (q.includes('doktor') && q.includes('bulunamadı')) return CLARIFICATION_TEMPLATES.doctor_not_found;
  if (q.includes('cari') && q.includes('bulunamadı')) return CLARIFICATION_TEMPLATES.account_not_found;
  if (q.includes('dönem') || q.includes('hangi dönem')) return CLARIFICATION_TEMPLATES.missing_time_scope.base;
  if (q.includes('finans') && q.includes('dönem')) return CLARIFICATION_TEMPLATES.missing_time_scope_finance.base;
  if (q.includes('özel') && q.includes('ay')) return CLARIFICATION_TEMPLATES.missing_custom_range.base;
  if (q.includes('metrik') || q.includes('neyi')) return CLARIFICATION_TEMPLATES.missing_metric.base;
  if (plan?.entityType === 'patient') return CLARIFICATION_TEMPLATES.missing_patient.base;
  if (plan?.entityType === 'doctor') return CLARIFICATION_TEMPLATES.missing_doctor.base;
  if (plan?.entityType === 'current_account') return CLARIFICATION_TEMPLATES.missing_current_account.base;
  return question || CLARIFICATION_TEMPLATES.generic;
}

function mapUnsupportedToTemplate(reasonCode, rawMessage) {
  const m = (rawMessage || '').toLowerCase();
  if (reasonCode === 'intent_unknown' || m.includes('sorgu türü')) return UNSUPPORTED_TEMPLATES.intent_unknown;
  if (reasonCode === 'intent_metric_mismatch' || m.includes('kombinasyon')) return UNSUPPORTED_TEMPLATES.intent_metric_mismatch;
  if (reasonCode === 'finance_metric_unknown' || m.includes('finans metriği')) return UNSUPPORTED_TEMPLATES.finance_metric_unknown;
  if (reasonCode === 'time_scope_unsupported' || m.includes('zaman kapsamı') || m.includes('dönem')) return UNSUPPORTED_TEMPLATES.time_scope_unsupported;
  if (reasonCode === 'comparison_unsupported' || m.includes('karşılaştırma')) return UNSUPPORTED_TEMPLATES.comparison_unsupported;
  if (reasonCode === 'retrieval_not_found') return UNSUPPORTED_TEMPLATES.retrieval_not_found;
  return UNSUPPORTED_TEMPLATES.generic;
}

function inferReasonCode(rawMessage, plan) {
  const m = (rawMessage || '').toLowerCase();
  if (m.includes('sorgu türü')) return 'intent_unknown';
  if (m.includes('kombinasyon') || m.includes('metric')) return 'intent_metric_mismatch';
  if (m.includes('finans metriği')) return 'finance_metric_unknown';
  if (m.includes('zaman kapsamı') || m.includes('dönem')) return 'time_scope_unsupported';
  if (m.includes('karşılaştırma')) return 'comparison_unsupported';
  if (m.includes('desteklenmiyor')) return 'retrieval_not_found';
  return 'generic';
}

function buildClarificationWithCandidates(template, candidates) {
  if (!candidates?.length) return template;
  const list = candidates.map((c) => `• ${c.name}`).join('\n');
  return `${template}\n\nSeçenekler:\n${list}`;
}

/**
 * Produce a template-based conversational response for clarification.
 */
function synthesizeClarificationTemplate({ question, candidates, plan }) {
  const template = mapClarificationToTemplate(question, candidates, plan);
  return buildClarificationWithCandidates(template, candidates);
}

/**
 * Produce a template-based conversational response for unsupported.
 */
function synthesizeUnsupportedTemplate({ reasonCode, rawMessage, plan }) {
  const code = reasonCode || inferReasonCode(rawMessage, plan);
  return mapUnsupportedToTemplate(code, rawMessage);
}

/**
 * Produce a template-based conversational response for semantic mismatch.
 */
function synthesizeSemanticMismatchTemplate({ expectedHints }) {
  if (expectedHints?.finance) return SEMANTIC_MISMATCH_TEMPLATES.finance_metric;
  return SEMANTIC_MISMATCH_TEMPLATES.generic;
}

/**
 * Produce a conversational response for data/execution errors.
 */
function synthesizeDataErrorTemplate({ errorMessage }) {
  const m = (errorMessage || '').toLowerCase();
  if (m.includes('bulunamadı')) return errorMessage;
  if (m.includes('hasta')) return 'Bu hasta ile ilgili bilgi alınamadı. Lütfen hasta adını kontrol edip tekrar deneyin.';
  if (m.includes('doktor')) return 'Bu doktor ile ilgili bilgi alınamadı. Lütfen doktor adını kontrol edip tekrar deneyin.';
  return 'Bu bilgiyi şu an getiremedim. Lütfen biraz farklı bir şekilde sorabilir misiniz?';
}

/**
 * LLM-based conversational synthesis for non-success cases.
 * Falls back to template if LLM unavailable.
 */
async function synthesizeConversationalResponse({ type, question, userMessage, candidates, reasonCode, rawMessage, expectedHints, errorMessage, plan }) {
  const template = (() => {
    if (type === 'clarification') {
      return synthesizeClarificationTemplate({ question, candidates, plan });
    }
    if (type === 'unsupported') {
      return synthesizeUnsupportedTemplate({ reasonCode, rawMessage, plan });
    }
    if (type === 'semantic_mismatch') {
      return synthesizeSemanticMismatchTemplate({ expectedHints });
    }
    if (type === 'data_error') {
      return synthesizeDataErrorTemplate({ errorMessage });
    }
    return 'Lütfen sorunuzu biraz daha netleştirir misiniz?';
  })();

  if (!USE_LLM_FOR_CLARIFICATION) {
    return template;
  }

  const available = await isAvailable();
  if (!available) {
    return template;
  }

  const systemPrompt = [
    'Sen DentAI diş kliniği asistanısın. Kullanıcıya yardımcı ve samimi bir şekilde yanıt ver.',
    'Sadece verilen yanıt taslağını kullan. Teknik terim (metric, intent, retrieval, Prisma, veritabanı) kullanma.',
    'Yanıtı kısa tut (1-3 cümle). Doğal Türkçe kullan.',
  ].join('\n');

  const context = {
    userMessage,
    responseType: type,
    suggestedResponse: template,
  };

  try {
    const { content } = await chat([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          `Kullanıcı sorusu: ${userMessage}`,
          '',
          'Yanıt taslağı (bunu doğal ve kısa bir şekilde ifade et):',
          template,
          '',
          'Bu taslağa dayanarak kullanıcıya yanıt ver. Teknik terim kullanma. Kısa ve samimi ol.',
        ].join('\n'),
      },
    ]);
    const answer = String(content || '').trim();
    return answer.length > 0 ? answer : template;
  } catch {
    return template;
  }
}

module.exports = {
  synthesizeConversationalResponse,
  synthesizeClarificationTemplate,
  synthesizeUnsupportedTemplate,
  synthesizeSemanticMismatchTemplate,
  synthesizeDataErrorTemplate,
};
