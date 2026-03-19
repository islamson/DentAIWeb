const { chat, isAvailable, getConfig } = require('./ollama');
const { createLlmUnavailableError } = require('./llm-query-planner');
const { checkGrounding, handleGroundingFailure } = require('./grounding-guard');
const { renderStructured, preferStructuredRender } = require('./structured-renderers');

function buildSystemPrompt() {
  return [
    'Sen DentAI adlı diş kliniği ERP asistanısın.',
    'Kullanıcıya Türkçe, doğal ama kısa ve net bir yanıt ver.',
    'Sadece verilen yapılandırılmış bağlamdaki bilgilere dayan.',
    'Verilmeyen sayı, isim, tutar, tarih veya oran uydurma.',
    'Bağlamda sadece count/period varsa liste (hasta adı, doktor adı, tarih) uydurma.',
    'Kullanıcı sayısal bir soru sorduysa cevabı kesin sayı/tutar ile başlat.',
    'Doktor/hasta/firma kapsamı varsa bunu açıkça koru. Klinik geneli veriyi doktor verisi gibi gösterme.',
    'İç sistem, JSON, tool, retrieval, filter, ID, Prisma, veritabanı gibi teknik terimler kullanma.',
    'Bağlamda bilgi yoksa bunu net söyle; ama yeni veri uydurma.',
  ].join('\n');
}

async function synthesizeAnswer({ question, plan, structuredContext }) {
  if (structuredContext?.error) return structuredContext.error;

  const grounding = checkGrounding({ question, plan, structuredContext });
  if (!grounding.pass) {
    return handleGroundingFailure({
      question,
      plan,
      userMessage: question,
      reason: grounding.reason,
    });
  }

  if (preferStructuredRender(plan, structuredContext)) {
    const rendered = renderStructured(plan, structuredContext);
    if (rendered) return rendered;
  }

  const available = await isAvailable();
  if (!available) {
    const fallback = renderStructured(plan, structuredContext);
    if (fallback) return fallback;
    throw createLlmUnavailableError('Final answer synthesis için Ollama erişilemiyor');
  }

  const contextPayload = {
    intent: plan.intent,
    metric: plan.metric,
    entityType: plan.entityType,
    entityName: plan.entityName,
    timeScope: plan.timeScope,
    filters: plan.filters,
    data: structuredContext,
  };

  let content;
  try {
    ({ content } = await chat([
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: [
          `Kullanıcı sorusu: ${question}`,
          '',
          'Doğrulanmış ve yetkili bağlam:',
          JSON.stringify(contextPayload).slice(0, 12000),
          '',
          'Bu bağlama dayanarak kullanıcıya yanıt ver. Bağlamda olmayan veri ekleme.',
        ].join('\n'),
      },
    ]));
  } catch (err) {
    const fallback = renderStructured(plan, structuredContext);
    if (fallback) return fallback;
    throw createLlmUnavailableError(err.message);
  }

  const answer = String(content || '').trim();
  if (!answer) {
    const fallback = renderStructured(plan, structuredContext);
    if (fallback) return fallback;
    const err = new Error('LLM empty final answer');
    err.code = 'AI_LLM_UNAVAILABLE';
    throw err;
  }

  return answer;
}

module.exports = {
  synthesizeAnswer,
};
