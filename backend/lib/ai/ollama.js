/**
 * Ollama adapter - local LLM integration.
 * Configurable base URL, model, timeout. Safe error handling.
 * Model-agnostic: use OLLAMA_MODEL env var.
 *
 * Env vars:
 *   OLLAMA_BASE_URL - e.g. http://127.0.0.1:11434
 *   OLLAMA_MODEL    - e.g. llama3.1:8b-instruct-q4_K_M (passed as-is to Ollama)
 *   OLLAMA_TIMEOUT_MS - timeout in ms (default 60000)
 *   OLLAMA_TEMPERATURE - 0..1 (default 0.2)
 */

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL || 'deepseek-r1:14b').trim();
const OLLAMA_TIMEOUT_MS = Math.max(5000, parseInt(process.env.OLLAMA_TIMEOUT_MS || '180000', 10));
const OLLAMA_TEMPERATURE = Math.min(1, Math.max(0, parseFloat(process.env.OLLAMA_TEMPERATURE || '0.1') || 0.1));
const OLLAMA_NUM_CTX = parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10) || 8192;
const OLLAMA_NUM_PREDICT = parseInt(process.env.OLLAMA_NUM_PREDICT || '4096', 10) || 4096;

/**
 * Call Ollama chat API.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<{ content: string }>}
 */
async function chat(messages) {
  const url = `${OLLAMA_BASE_URL}/api/chat`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: OLLAMA_TEMPERATURE,
          num_ctx: OLLAMA_NUM_CTX,
          num_predict: OLLAMA_NUM_PREDICT,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Ollama returned invalid JSON');
    }

    const content = data?.message?.content;
    if (content == null) {
      throw new Error('Ollama returned empty or invalid response');
    }
    return { content: String(content).trim() };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Ollama timeout after ${OLLAMA_TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

/**
 * Check if Ollama is available.
 * @returns {Promise<boolean>}
 */
async function isAvailable() {
  try {
    const url = `${OLLAMA_BASE_URL}/api/tags`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Verify configured model exists in Ollama.
 * Calls GET /api/tags and checks model list.
 * Logs warning if model not found.
 * @returns {Promise<boolean>} true if model exists or Ollama unavailable
 */
async function checkOllamaModel() {
  try {
    const url = `${OLLAMA_BASE_URL}/api/tags`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Ollama] LLM model ${OLLAMA_MODEL} not available (Ollama returned ${res.status})`);
      return false;
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn(`[Ollama] LLM model ${OLLAMA_MODEL} not available (invalid tags response)`);
      return false;
    }

    const models = data?.models || [];
    const names = models.map((m) => m?.name || '').filter(Boolean);
    const found = names.some((n) => n === OLLAMA_MODEL || n.startsWith(OLLAMA_MODEL + ':'));
    if (!found) {
      console.warn(`[Ollama] LLM model ${OLLAMA_MODEL} not available. Run: ollama pull ${OLLAMA_MODEL}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[Ollama] LLM model ${OLLAMA_MODEL} not available (${err.message || 'connection failed'})`);
    return false;
  }
}

function getConfig() {
  return {
    baseUrl: OLLAMA_BASE_URL,
    model: OLLAMA_MODEL,
    timeoutMs: OLLAMA_TIMEOUT_MS,
    temperature: OLLAMA_TEMPERATURE,
    numCtx: OLLAMA_NUM_CTX,
    numPredict: OLLAMA_NUM_PREDICT,
  };
}

module.exports = {
  chat,
  isAvailable,
  checkOllamaModel,
  getConfig,
};
