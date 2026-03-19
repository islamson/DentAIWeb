/**
 * AI planning layer - unified planner with mode selection.
 * DETERMINISTIC FIRST for speed. LLM only when needed (ambiguous/complex).
 * - auto: try deterministic first, use LLM only if no match or needs context.
 * - llm: force LLM only (for complex phrasing).
 * - fallback: deterministic planner only.
 */

const { plan } = require('./planner');
const { planWithLlm } = require('./llm-planner');
const { isAvailable, getConfig } = require('./ollama');

const AI_MODE = (process.env.AI_MODE || 'auto').toLowerCase();

/** Error thrown when LLM is required but unavailable (AI_MODE=llm) */
function createLlmUnavailableError(innerMessage) {
  const model = getConfig().model;
  const err = new Error(
    `Ollama LLM kullanılamıyor: ${innerMessage || 'Bağlantı hatası'}. ` +
    `Ollama çalışıyor mu? (ollama serve) Model yüklü mü? (ollama pull ${model})`
  );
  err.code = 'AI_LLM_UNAVAILABLE';
  return err;
}

/**
 * Plan using the configured mode.
 * Deterministic first for speed; LLM only when needed.
 * @param {string} message
 * @param {Object} opts - { history?, memory? }
 */
async function planWithMode(message, opts = {}) {
  const { history = [], memory = null } = opts;

  if (AI_MODE === 'fallback') {
    const result = plan(message, { history, memory });
    return { ...result, plannerMode: 'fallback' };
  }

  // Try deterministic first (fast path)
  const detResult = plan(message, { history, memory });
  const hasDeterministicMatch = !detResult.clarification_needed && !detResult.direct_answer && detResult.tool;

  if (AI_MODE === 'llm') {
    const available = await isAvailable();
    if (!available) throw createLlmUnavailableError('Ollama erişilemiyor (isAvailable=false)');
    try {
      const result = await planWithLlm(message, { history, memory });
      return { ...result, plannerMode: 'llm', modelUsed: getConfig().model };
    } catch (err) {
      if (err.code === 'AI_LLM_UNAVAILABLE') throw err;
      throw createLlmUnavailableError(err.message);
    }
  }

  // auto: deterministic first. If we get a tool match, use it (fast).
  if (hasDeterministicMatch) {
    return { ...detResult, plannerMode: 'fallback' };
  }

  const available = await isAvailable();
  if (!available) {
    return { ...detResult, plannerMode: 'fallback', fallbackReason: 'ollama_unavailable' };
  }

  try {
    const result = await planWithLlm(message, { history, memory });
    return { ...result, plannerMode: 'llm', modelUsed: getConfig().model };
  } catch (err) {
    return { ...detResult, plannerMode: 'fallback', fallbackReason: 'llm_failed' };
  }
}

module.exports = { planWithMode, AI_MODE };
