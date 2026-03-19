/**
 * Query Understanding Layer - Parse user message into structured query object.
 * Entity-centric. Maps planner intent to entityType, operation, requiresLLM.
 * No LLM - deterministic structured parsing.
 */

const { plan } = require('./planner');

/** @typedef {'patient'|'doctor'|'clinic'|'current_account'|'inventory'|'lab'|'treatment_plan'|'unknown'} EntityType */
/** @typedef {'lookup'|'list'|'summarize'|'compare'|'trend_analysis'|'explain'|'write_intent'} Operation */

/**
 * Tools that require LLM for analytical/explanation (trend, compare, why).
 * All others = direct factual answer.
 */
const ANALYTICAL_TOOLS = new Set([
  // Premium / future: doctor performance trend, clinic profitability, churn explanation
  'get_doctor_performance_metrics',
  'get_clinic_profitability_snapshot',
  'get_churn_risk_score',
  'get_case_acceptance_score',
  'get_pricing_recommendation',
  'get_staff_productivity_score',
  'get_clinical_insight',
  // Current account: summary/interpretation needs LLM
  'get_current_account_transaction_summary',
]);

/**
 * Map tool to entity type.
 */
const TOOL_ENTITY_MAP = {
  search_patient: 'patient',
  get_patient_summary: 'patient',
  get_patient_last_payment: 'patient',
  get_patient_balance: 'patient',
  get_patient_financial_history: 'patient',
  get_patient_upcoming_appointments: 'patient',
  get_patient_contact: 'patient',
  get_patient_last_treatment: 'patient',
  get_today_appointments: 'clinic',
  get_appointments_noshow: 'clinic',
  get_appointments_cancelled: 'clinic',
  get_doctor_schedule: 'doctor',
  get_debtors_summary: 'clinic',
  get_monthly_finance_summary: 'clinic',
  get_weekly_finance_summary: 'clinic',
  get_payments_today: 'clinic',
  search_current_account: 'current_account',
  get_current_account_balance: 'current_account',
  get_current_account_last_payment: 'current_account',
  get_current_account_summary: 'current_account',
  get_current_account_last_transaction: 'current_account',
  get_current_account_transaction_summary: 'current_account',
  get_current_account_transactions: 'current_account',
  get_current_account_monthly_summary: 'current_account',
  get_low_stock_products: 'inventory',
  get_critical_stock: 'inventory',
  get_stock_movement_summary: 'inventory',
  get_last_stock_entry: 'inventory',
  get_product_quantity: 'inventory',
  get_lab_materials: 'lab',
};

/**
 * Map tool to operation.
 */
const TOOL_OPERATION_MAP = {
  search_patient: 'list',
  get_patient_summary: 'lookup',
  get_patient_last_payment: 'lookup',
  get_patient_balance: 'lookup',
  get_patient_financial_history: 'list',
  get_patient_upcoming_appointments: 'list',
  get_patient_contact: 'lookup',
  get_patient_last_treatment: 'lookup',
  get_today_appointments: 'list',
  get_appointments_noshow: 'summarize',
  get_appointments_cancelled: 'summarize',
  get_doctor_schedule: 'list',
  get_debtors_summary: 'summarize',
  get_monthly_finance_summary: 'summarize',
  get_weekly_finance_summary: 'summarize',
  get_payments_today: 'summarize',
  search_current_account: 'list',
  get_current_account_balance: 'lookup',
  get_current_account_last_payment: 'lookup',
  get_current_account_summary: 'lookup',
  get_current_account_last_transaction: 'lookup',
  get_current_account_transaction_summary: 'summarize',
  get_current_account_transactions: 'list',
  get_current_account_monthly_summary: 'summarize',
  get_low_stock_products: 'list',
  get_critical_stock: 'list',
  get_stock_movement_summary: 'summarize',
  get_last_stock_entry: 'lookup',
  get_product_quantity: 'lookup',
  get_lab_materials: 'list',
};

/**
 * Extract time range from params/context.
 */
function extractTimeRange(params, tool) {
  const today = new Date().toISOString().slice(0, 10);
  if (params?.date) return { from: params.date, to: params.date };
  if (['get_monthly_finance_summary'].includes(tool)) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from: start, to: end };
  }
  if (['get_weekly_finance_summary'].includes(tool)) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  if (['get_payments_today', 'get_today_appointments'].includes(tool)) {
    return { from: today, to: today };
  }
  return { from: today, to: today };
}

/**
 * Build structured query object from planner result.
 * @param {Object} planResult - Result from plan()
 * @param {Object} memory - Conversation memory
 * @returns {Object} Structured query
 */
function buildQueryFromPlan(planResult, memory = null) {
  if (planResult.clarification_needed) {
    return {
      entityType: 'unknown',
      entityName: null,
      operation: 'lookup',
      requiresLLM: false,
      confidence: 0,
      clarification_needed: true,
      message: planResult.message,
    };
  }

  if (planResult.direct_answer) {
    return {
      entityType: 'unknown',
      entityName: null,
      operation: 'lookup',
      requiresLLM: false,
      confidence: 1,
      direct_answer: planResult.direct_answer,
    };
  }

  const tool = planResult.tool || null;
  const intent = planResult.intent || null;
  const params = planResult.params || {};
  const entityType = TOOL_ENTITY_MAP[tool] || 'unknown';
  const operation = TOOL_OPERATION_MAP[tool] || 'lookup';
  const requiresLLM = ANALYTICAL_TOOLS.has(tool);
  const confidence = tool ? 0.9 : 0.5;

  const entityName =
    params.patientQuery ||
    params.doctorQuery ||
    params.currentAccountQuery ||
    (entityType === 'patient' && memory?.lastReferencedPatientName) ||
    (entityType === 'doctor' && null) ||
    (entityType === 'current_account' && memory?.lastReferencedCurrentAccountName) ||
    null;

  const timeRange = extractTimeRange(params, tool);

  return {
    entityType,
    entityName,
    secondaryEntityType: null,
    secondaryEntityName: null,
    timeRange,
    metric: null,
    operation,
    requiresLLM,
    confidence,
    intent,
    tool,
    params,
    memoryUsed: !!planResult.memoryUsed,
  };
}

/**
 * Understand query: parse message and return structured query object.
 * @param {string} message
 * @param {Object} opts - { history?, memory? }
 * @returns {Promise<Object>} Structured query
 */
async function understandQuery(message, opts = {}) {
  const { history = [], memory = null } = opts;
  const planResult = plan(message, { history, memory });
  return buildQueryFromPlan(planResult, memory);
}

module.exports = {
  understandQuery,
  buildQueryFromPlan,
  ANALYTICAL_TOOLS,
  TOOL_ENTITY_MAP,
  TOOL_OPERATION_MAP,
};
