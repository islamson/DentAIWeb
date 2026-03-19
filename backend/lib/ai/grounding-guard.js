/**
 * Grounding Guard - Ensures answers are strictly grounded in retrieved data.
 * Never allow the LLM to invent names, dates, lists, or row-level details
 * unless those fields were actually retrieved.
 */

const { METRICS } = require('./assistant-contracts');
const { synthesizeConversationalResponse } = require('./conversational-response');

/** Data shapes that indicate what was actually retrieved */
const RETRIEVED_SHAPES = {
  count: 'count',
  amount: 'amount',
  ratio: 'ratio',
  rows: 'rows',
  summary: 'summary',
};

/** Output shapes the user may be asking for */
const REQUESTED_SHAPES = {
  count: 'count',
  amount: 'amount',
  ratio: 'ratio',
  list: 'list',
  summary: 'summary',
};

function inferRetrievedShape(structuredContext) {
  if (!structuredContext || structuredContext.error) return null;

  const ctx = structuredContext;

  // Row-level data: all list-capable domains
  if (Array.isArray(ctx.appointments) && ctx.appointments.length > 0) return RETRIEVED_SHAPES.rows;
  if (Array.isArray(ctx.transactions) && ctx.transactions.length > 0) return RETRIEVED_SHAPES.rows;
  if (Array.isArray(ctx.items) && ctx.items.length > 0) return RETRIEVED_SHAPES.rows;
  if (Array.isArray(ctx.treatmentItems) && ctx.treatmentItems.length > 0) return RETRIEVED_SHAPES.rows;
  if (Array.isArray(ctx.overduePatients) && ctx.overduePatients.length > 0) return RETRIEVED_SHAPES.rows;
  if (Array.isArray(ctx.patients) && ctx.patients.length > 0) return RETRIEVED_SHAPES.rows;
  if (Array.isArray(ctx.blocks) && ctx.blocks.length > 0) return RETRIEVED_SHAPES.rows;
  if (Array.isArray(ctx.plans) && ctx.plans.length > 0) return RETRIEVED_SHAPES.rows;

  // Count data
  if (typeof ctx.count === 'number' && !ctx.appointments && !ctx.transactions && !ctx.items && !ctx.treatmentItems) {
    return RETRIEVED_SHAPES.count;
  }

  // Amount data
  if (typeof ctx.revenueAmount === 'number' || typeof ctx.collectionAmount === 'number') return RETRIEVED_SHAPES.amount;
  if (typeof ctx.pendingCollectionAmount === 'number') return RETRIEVED_SHAPES.amount;
  if (typeof ctx.outstandingBalanceAmount === 'number' || typeof ctx.overdueReceivablesAmount === 'number') return RETRIEVED_SHAPES.amount;
  if (typeof ctx.completedTreatmentValue === 'number') return RETRIEVED_SHAPES.amount;
  if (typeof ctx.totalValue === 'number') return RETRIEVED_SHAPES.amount;
  if (typeof ctx.balance === 'number' || typeof ctx.remainingBalance === 'number') return RETRIEVED_SHAPES.amount;

  // Ratio data
  if (typeof ctx.percentageChange === 'number' || typeof ctx.completionPercentage === 'number') return RETRIEVED_SHAPES.ratio;
  if (typeof ctx.noShowRate === 'number' || typeof ctx.cancellationRate === 'number') return RETRIEVED_SHAPES.ratio;
  if (typeof ctx.collectionRate === 'number' || typeof ctx.completionRate === 'number') return RETRIEVED_SHAPES.ratio;

  // Comparison data (has current/previous amounts)
  if (typeof ctx.currentAmount === 'number' || typeof ctx.currentCount === 'number') return RETRIEVED_SHAPES.summary;

  // Summary data
  if (ctx.totals || ctx.summary) return RETRIEVED_SHAPES.summary;
  if (ctx.doctor?.name && ctx.appointments) return RETRIEVED_SHAPES.rows;
  if (ctx.patient?.fullName && ctx.payment) return RETRIEVED_SHAPES.summary;
  if (ctx.type === 'clinic_financial_summary' || ctx.type === 'clinic_operational_summary') return RETRIEVED_SHAPES.summary;

  return RETRIEVED_SHAPES.count;
}

function inferRequestedShape(question, plan) {
  const q = String(question || '').toLowerCase();
  const metric = plan?.metric;

  // If plan declared outputShape (from capability catalog or planner), trust it
  if (plan?.outputShape) {
    if (plan.outputShape === 'list') return REQUESTED_SHAPES.list;
    if (plan.outputShape === 'count') return REQUESTED_SHAPES.count;
    if (plan.outputShape === 'amount') return REQUESTED_SHAPES.amount;
    if (plan.outputShape === 'ratio') return REQUESTED_SHAPES.ratio;
    if (plan.outputShape === 'summary') return REQUESTED_SHAPES.summary;
  }

  const listPhrases = [
    /\blistele\b/,
    /\blisteler misin\b/,
    /\blisteler misiniz\b/,
    /\bisimleriyle\b/,
    /\bhasta ismi\b/,
    /\bdoktor ismi\b/,
    /\btarih saati ile\b/,
    /\bdetayli goster\b/,
    /\bdetaylı göster\b/,
    /\bkimler\b/,
    /\bhangi hastalar\b/,
    /\bhangi randevular\b/,
    /\bdetaylı listele\b/,
    /\bdetayları ile\b/,
    /\bbunları.*listele\b/,
    /\bhasta ismi ve tedavi\b/,
    /\bdoktor ismiyle\b/,
    /\btarih saatiyle\b/,
    /\bsırala\b/,
  ];
  if (listPhrases.some((p) => p.test(q))) return REQUESTED_SHAPES.list;

  // List metrics
  if (metric === METRICS.appointment_list || metric === METRICS.schedule_list) return REQUESTED_SHAPES.list;
  if (metric === METRICS.transaction_list || metric === METRICS.low_stock_list) return REQUESTED_SHAPES.list;
  if (metric === METRICS.overdue_patient_list || metric === METRICS.debtor_patient_list) return REQUESTED_SHAPES.list;
  if (metric === METRICS.completed_treatment_list) return REQUESTED_SHAPES.list;
  if (metric === METRICS.cancelled_appointments_list) return REQUESTED_SHAPES.list;
  if (metric === METRICS.no_show_patients_list) return REQUESTED_SHAPES.list;
  if (metric === METRICS.expiring_stock_list) return REQUESTED_SHAPES.list;

  // Count metrics
  if (metric === METRICS.appointment_count || metric === METRICS.patient_count) return REQUESTED_SHAPES.count;
  if (metric === METRICS.new_patient_count || metric === METRICS.completed_treatment_count) return REQUESTED_SHAPES.count;
  if (metric === METRICS.cancelled_appointment_count || metric === METRICS.no_show_count) return REQUESTED_SHAPES.count;
  if (metric === METRICS.inventory_item_count || metric === METRICS.low_stock_item_count) return REQUESTED_SHAPES.count;
  if (metric === METRICS.completed_treatment_item_count || metric === METRICS.doctor_patient_count) return REQUESTED_SHAPES.count;

  // Amount metrics
  if (metric === METRICS.revenue_amount || metric === METRICS.collection_amount) return REQUESTED_SHAPES.amount;
  if (metric === METRICS.pending_collection_amount || metric === METRICS.outstanding_balance_amount) return REQUESTED_SHAPES.amount;
  if (metric === METRICS.overdue_receivables_amount || metric === METRICS.completed_treatment_value) return REQUESTED_SHAPES.amount;
  if (metric === METRICS.doctor_revenue_amount || metric === METRICS.doctor_collection_amount) return REQUESTED_SHAPES.amount;
  if (metric === METRICS.stock_value_total) return REQUESTED_SHAPES.amount;

  // Ratio metrics
  if (metric === METRICS.completion_percentage) return REQUESTED_SHAPES.ratio;
  if (metric === METRICS.no_show_rate || metric === METRICS.cancellation_rate) return REQUESTED_SHAPES.ratio;
  if (metric === METRICS.patient_gender_ratio || metric === METRICS.collection_rate) return REQUESTED_SHAPES.ratio;
  if (metric === METRICS.treatment_completion_rate) return REQUESTED_SHAPES.ratio;

  return REQUESTED_SHAPES.summary;
}

function hasRows(structuredContext) {
  if (!structuredContext) return false;
  const arr =
    structuredContext.appointments ||
    structuredContext.transactions ||
    structuredContext.items ||
    structuredContext.treatmentItems ||
    structuredContext.overduePatients ||
    structuredContext.patients;
  return Array.isArray(arr) && arr.length > 0;
}

function hasNamedEntities(structuredContext) {
  if (!structuredContext) return false;
  const rows = structuredContext.appointments || structuredContext.transactions ||
    structuredContext.items || structuredContext.treatmentItems || [];
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const first = rows[0];
  return !!(first?.patientName || first?.doctorName || first?.name);
}

function hasAppointmentsList(structuredContext) {
  return Array.isArray(structuredContext?.appointments) && structuredContext.appointments.length > 0;
}

function hasDoctors(structuredContext) {
  const rows = structuredContext?.appointments || structuredContext?.treatmentItems || [];
  return rows.some((r) => r?.doctorName);
}

function hasPatients(structuredContext) {
  const rows = structuredContext?.appointments || structuredContext?.patients || structuredContext?.treatmentItems || [];
  return rows.some((r) => r?.patientName || r?.fullName);
}

/**
 * Check if the user asks for a list but we only have count data.
 * Returns { pass: false, reason } if grounding would be violated.
 */
function checkGrounding({ question, plan, structuredContext }) {
  const retrieved = inferRetrievedShape(structuredContext);
  const requested = inferRequestedShape(question, plan);

  if (requested === REQUESTED_SHAPES.list && retrieved === RETRIEVED_SHAPES.count) {
    return {
      pass: false,
      reason: 'list_requested_count_retrieved',
      requestedOutputShape: requested,
      retrievedDataShape: retrieved,
      groundingGuardPassed: false,
    };
  }

  if (requested === REQUESTED_SHAPES.list && !hasRows(structuredContext)) {
    return {
      pass: false,
      reason: 'list_requested_no_rows',
      requestedOutputShape: requested,
      retrievedDataShape: retrieved,
      groundingGuardPassed: false,
    };
  }

  return {
    pass: true,
    requestedOutputShape: requested,
    retrievedDataShape: retrieved,
    groundingGuardPassed: true,
    hasRows: hasRows(structuredContext),
    hasNamedEntities: hasNamedEntities(structuredContext),
    hasAppointmentsList: hasAppointmentsList(structuredContext),
    hasDoctors: hasDoctors(structuredContext),
    hasPatients: hasPatients(structuredContext),
  };
}

/**
 * Domain-specific grounding failure messages.
 */
async function handleGroundingFailure({ question, plan, userMessage, reason }) {
  if (reason === 'list_requested_count_retrieved' || reason === 'list_requested_no_rows') {
    const metric = plan?.metric || '';
    const intent = plan?.intent || '';

    // Domain-specific messages
    let rawMessage;
    if (metric.includes('treatment') || intent.includes('treatment')) {
      rawMessage = 'Şu anda sadece tedavi sayısı bilgisi mevcut. Tedavi listesi (hasta adı, tedavi detayı, tarih) almak için lütfen sorunuzu "listele" şeklinde tekrar sorun.';
    } else if (metric.includes('cancelled') || metric.includes('cancellation')) {
      rawMessage = 'Şu anda sadece iptal sayısı bilgisi mevcut. İptal edilen randevuların listesini almak için lütfen "iptalleri listele" deyin.';
    } else if (metric.includes('no_show')) {
      rawMessage = 'Şu anda sadece gelmeme oranı bilgisi mevcut. Gelmeyen hastaların listesini almak için lütfen "gelmeyen hastaları listele" deyin.';
    } else if (metric.includes('stock') || metric.includes('inventory')) {
      rawMessage = 'Şu anda sadece stok sayısı bilgisi mevcut. Düşük stok ürünlerinin listesini almak için lütfen "düşük stokları listele" deyin.';
    } else if (metric.includes('debtor') || metric.includes('overdue_patient')) {
      rawMessage = 'Şu anda sadece borç tutar bilgisi mevcut. Borçlu hasta listesi almak için lütfen "borçlu hastaları listele" deyin.';
    } else {
      rawMessage = 'Şu anda sadece sayısal/özet bilgisi mevcut. Detaylı liste almak için lütfen sorunuzu "listele" şeklinde tekrar sorun.';
    }

    return synthesizeConversationalResponse({
      type: 'unsupported',
      userMessage: userMessage || question,
      rawMessage,
      plan,
    });
  }
  return 'Bu bilgiyi şu an veremiyorum. Lütfen sorunuzu farklı bir şekilde ifade edin.';
}

module.exports = {
  checkGrounding,
  handleGroundingFailure,
  inferRetrievedShape,
  inferRequestedShape,
  hasRows,
  hasNamedEntities,
  hasAppointmentsList,
  hasDoctors,
  hasPatients,
  RETRIEVED_SHAPES,
  REQUESTED_SHAPES,
};
