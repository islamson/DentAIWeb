/**
 * LLM planner - uses Ollama to decide direct_answer or tool_request.
 * Structured output format. Validates tool names and params.
 * Never trusts raw LLM output blindly.
 * Model-agnostic: works with DeepSeek-R1, Llama, Mistral, etc.
 */

const { chat } = require('./ollama');
const { getAll, get } = require('./tool-registry');

function extractJsonObject(str) {
  const start = str.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === '{') depth++;
    if (str[i] === '}') {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

const ALLOWED_TOOLS = [
  'search_patient',
  'get_patient_summary',
  'get_patient_last_payment',
  'get_patient_balance',
  'get_today_appointments',
  'get_doctor_schedule',
  'get_debtors_summary',
  'get_low_stock_products',
  'get_monthly_finance_summary',
  'search_current_account',
  'get_current_account_balance',
  'get_current_account_last_payment',
  'get_current_account_summary',
  'get_current_account_last_transaction',
  'get_current_account_transaction_summary',
  'get_current_account_transactions',
  'get_current_account_monthly_summary',
];

const TOOL_LIST_STR = ALLOWED_TOOLS.join(', ');

function buildSystemPrompt(memory = null) {
  const tools = getAll();
  const toolList = tools
    .filter((t) => ALLOWED_TOOLS.includes(t.name))
    .map((t) => `- ${t.name}: ${t.description}`)
    .join('\n');

  const today = new Date().toISOString().slice(0, 10);

  return `Sen bir diş kliniği ERP/CRM asistanısın. Tüm yanıtların Türkçe olmalı.

ÖNEMLİ KURALLAR:
1. Sadece aşağıdaki araç isimlerini kullan. Başka araç uydurma.
2. Hasta, doktor veya firma/cari hesap ismi belirtilmemişse, tool_request kullanma; clarification ile sor.
3. patientId, doctorId veya currentAccountId asla uydurma. Sadece patientQuery, doctorQuery veya currentAccountQuery kullan.
4. Yanıtın MUTLAKA "direct_answer" veya "tool_request" ile başlamalı.
5. Bugünün tarihi: ${today}. Program/randevu sorularında bu tarihi kullan.

İZİN VERİLEN ARAÇLAR (sadece bunlar):
${TOOL_LIST_STR}

YANIT FORMATLARI:

A) Doğrudan cevap (selamlama, teşekkür, genel sorular):
direct_answer
Cevap: <Türkçe cevabın>

B) Veri gerektiren soru - araç kullan:
tool_request
TOOL: <yukarıdaki araçlardan biri, tam olarak>
PARAMS: <geçerli JSON>

PARAM KURALLARI:
- search_patient: {"query": "arama terimi", "limit": 10}  (query zorunlu, min 2 karakter)
- get_patient_summary: {"patientQuery": "Ad Soyad"}  (patientQuery zorunlu)
- get_patient_last_payment: {"patientQuery": "Ad Soyad"}  (patientQuery zorunlu)
- get_patient_balance: {"patientQuery": "Ad Soyad"}  (hasta bakiyesi: uygulanan tedavi - ödenen)
- get_today_appointments: {}
- get_doctor_schedule: {"doctorQuery": "Doktor adı", "date": "YYYY-MM-DD"}  (doctorQuery zorunlu, date bugün ${today})
- get_debtors_summary: {}
- get_low_stock_products: {}
- get_monthly_finance_summary: {}  (bu ay toplam tahsilat/ciro)
- search_current_account: {"query": "firma adı", "limit": 10}
- get_current_account_balance: {"currentAccountQuery": "Firma Adı"}  (cari hesap bakiyesi - hasta DEĞİL)
- get_current_account_last_payment: {"currentAccountQuery": "Firma Adı"}  (firmaya yapılan son ödeme - hasta DEĞİL)
- get_current_account_summary: {"currentAccountQuery": "Firma Adı"}  (cari özet)
- get_current_account_last_transaction: {"currentAccountQuery": "Firma Adı"}  (son işlem - borç veya alacak)
- get_current_account_transaction_summary: {"currentAccountQuery": "Firma Adı"}  (işlem özeti)
- get_current_account_transactions: {"currentAccountQuery": "Firma Adı", "limit": 20}
- get_current_account_monthly_summary: {"currentAccountQuery": "Firma Adı"}  (aylık özet)

TÜRKÇE SORU ÖRNEKLERİ (bunlara benzer sorularda doğru aracı seç):
- "Bugünkü randevuları göster" -> get_today_appointments, PARAMS: {}
- "Ahmet Yılmaz'ın son ödemesi ne zaman?" -> get_patient_last_payment, PARAMS: {"patientQuery": "Ahmet Yılmaz"}
- "Ahmet Yılmaz'ın özetini göster" -> get_patient_summary, PARAMS: {"patientQuery": "Ahmet Yılmaz"}
- "Dr. Ayşe Demir'in bugünkü programı nedir?" -> get_doctor_schedule, PARAMS: {"doctorQuery": "Ayşe Demir", "date": "${today}"}
- "Borçlu hastaları özetle" -> get_debtors_summary, PARAMS: {}
- "Düşük stoktaki ürünleri listele" -> get_low_stock_products, PARAMS: {}
- "Ne kadar borcu var?" (önceki mesajda hasta varsa) -> get_patient_balance, PARAMS: {"patientQuery": "önceki hasta adı"}
- "Bu ay toplam ne kadar ödeme aldık?" -> get_monthly_finance_summary, PARAMS: {}
- "Kliniğin bu ayki toplam cirosu ne kadar?" -> get_monthly_finance_summary, PARAMS: {}
- "ABS Medikal firmasına yapılan son ödeme ne zaman?" -> get_current_account_last_payment, PARAMS: {"currentAccountQuery": "ABS Medikal"}
- "ABS Medikal firmasına ne kadar borcumuz var?" -> get_current_account_balance, PARAMS: {"currentAccountQuery": "ABS Medikal"}
- "Peki borcu ne kadar?" (önceki mesajda cari varsa) -> get_current_account_balance, PARAMS: {"currentAccountId": "önceki cari id"} veya currentAccountQuery
- "Son işlem ne?" (önceki mesajda cari varsa) -> get_current_account_last_transaction
- "Bu cari ile yapılan tüm işlemleri özetle" -> get_current_account_transaction_summary

Hasta/doktor/firma ismi soruda yoksa: clarification döndür, tool_request kullanma.
Firma, tedarikçi, laboratuvar, cari hesap sorularında get_current_account_* kullan; get_patient_* KULLANMA.
Yanıtı "direct_answer" veya "tool_request" ile başlat.`;
}

/**
 * Sanitize params to prevent malformed data from breaking tools.
 */
function sanitizeParams(tool, params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') out[k] = String(v).trim();
    else if (typeof v === 'number' && !Number.isNaN(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  }
  if (tool === 'search_patient' && 'limit' in out) {
    const n = parseInt(out.limit, 10);
    out.limit = Number.isNaN(n) ? 10 : Math.min(Math.max(n, 1), 50);
  }
  if (tool === 'get_doctor_schedule' && !out.date) {
    out.date = new Date().toISOString().slice(0, 10);
  }
  if (tool === 'get_monthly_finance_summary') {
    // No params needed
  }
  return out;
}

/**
 * Parse LLM response into structured format.
 * @returns {{ type: 'direct_answer', answer: string } | { type: 'tool_request', tool: string, params: Object } | null}
 */
function parseLlmResponse(content) {
  const trimmed = (content || '').trim();
  if (!trimmed) return null;

  const directMatch = trimmed.match(/direct_answer\s*\n\s*Cevap:\s*(.+)/is);
  if (directMatch) {
    const answer = directMatch[1].trim();
    if (answer.length > 0) {
      return { type: 'direct_answer', answer };
    }
  }

  // Allow flexible spacing/newlines; tool name may have underscores; PARAMS can be multiline JSON
  const toolMatch = trimmed.match(/tool_request\s*[\r\n]+\s*TOOL:\s*([a-z0-9_]+)\s*[\r\n]+\s*PARAMS:\s*([\s\S]+)/i);
  if (toolMatch) {
    const toolName = toolMatch[1].trim().toLowerCase();
    if (!ALLOWED_TOOLS.includes(toolName)) return null;

    let params = {};
    try {
      const paramsStr = extractJsonObject(toolMatch[2].trim());
      if (!paramsStr) return null;
      params = JSON.parse(paramsStr);
      if (typeof params !== 'object' || params === null || Array.isArray(params)) {
        return null;
      }
    } catch {
      return null;
    }

    return { type: 'tool_request', tool: toolName, params: sanitizeParams(toolName, params) };
  }

  return null;
}

/**
 * Validate tool params - return clarification if incomplete.
 */
function validateToolParams(tool, params) {
  const toolDef = get(tool);
  if (!toolDef) return { valid: false, clarification: 'Bilinmeyen araç.' };

  if (tool === 'search_patient') {
    if (!params.query || String(params.query).trim().length < 2) {
      return { valid: false, clarification: 'Hangi hasta veya arama terimini kullanmak istiyorsunuz?' };
    }
  }
  if (tool === 'get_patient_summary' || tool === 'get_patient_last_payment' || tool === 'get_patient_balance') {
    if (!params.patientQuery && !params.patientId) {
      return { valid: false, clarification: 'Hangi hastayı kastettiğinizi belirtir misiniz?' };
    }
    if (params.patientQuery && String(params.patientQuery).trim().length < 2) {
      return { valid: false, clarification: 'Hasta adı en az 2 karakter olmalı.' };
    }
  }
  if (tool === 'get_doctor_schedule') {
    if (!params.doctorQuery && !params.doctorId) {
      return { valid: false, clarification: 'Hangi doktor için programı görmek istiyorsunuz?' };
    }
  }
  const currentAccountTools = [
    'get_current_account_balance', 'get_current_account_last_payment', 'get_current_account_summary',
    'get_current_account_last_transaction', 'get_current_account_transaction_summary',
    'get_current_account_transactions', 'get_current_account_monthly_summary',
  ];
  if (currentAccountTools.includes(tool)) {
    if (!params.currentAccountQuery && !params.currentAccountId) {
      return { valid: false, clarification: 'Hangi cari hesap veya firma için bilgi istiyorsunuz?' };
    }
    if (params.currentAccountQuery && String(params.currentAccountQuery).trim().length < 2) {
      return { valid: false, clarification: 'Firma adı en az 2 karakter olmalı.' };
    }
  }

  return { valid: true };
}

/**
 * Plan using LLM.
 * @param {string} message
 * @param {Object} opts - { history?, memory? }
 */
async function planWithLlm(message, opts = {}) {
  const { history = [], memory = null } = opts;
  const trimmed = (message || '').trim();
  if (!trimmed) {
    return { clarification_needed: true, message: 'Lütfen bir soru veya istek yazın.' };
  }

  const systemPrompt = buildSystemPrompt(memory);
  const messages = [{ role: 'system', content: systemPrompt }];
  const recentHistory = (history || []).slice(-6);
  for (const h of recentHistory) {
    if (h.role === 'user' || h.role === 'assistant') {
      messages.push({ role: h.role, content: String(h.content || '').slice(0, 1500) });
    }
  }
  messages.push({ role: 'user', content: trimmed });

  const { content } = await chat(messages);
  const parsed = parseLlmResponse(content);

  if (!parsed) {
    return {
      clarification_needed: true,
      message: 'Bu soruyu şu an anlayamadım, lütfen biraz daha açık yazar mısınız?',
    };
  }

  if (parsed.type === 'direct_answer') {
    return {
      clarification_needed: false,
      direct_answer: parsed.answer,
    };
  }

  let params = parsed.params;
  const currentAccountTools = [
    'get_current_account_balance', 'get_current_account_last_payment', 'get_current_account_summary',
    'get_current_account_last_transaction', 'get_current_account_transaction_summary',
    'get_current_account_transactions', 'get_current_account_monthly_summary',
  ];
  if (currentAccountTools.includes(parsed.tool) && !params.currentAccountQuery && !params.currentAccountId && memory?.lastReferencedCurrentAccountId) {
    params = { ...params, currentAccountId: memory.lastReferencedCurrentAccountId };
  }

  const validation = validateToolParams(parsed.tool, params);
  if (!validation.valid) {
    return { clarification_needed: true, message: validation.clarification };
  }

  return {
    intent: `llm_${parsed.tool}`,
    tool: parsed.tool,
    params,
    memoryUsed: !!params.currentAccountId && !!memory?.lastReferencedCurrentAccountId,
  };
}

module.exports = { planWithLlm, parseLlmResponse, ALLOWED_TOOLS, sanitizeParams, validateToolParams };
