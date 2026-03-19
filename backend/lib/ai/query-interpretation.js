/**
 * Structured Query Interpretation Layer.
 * Deterministic extraction of: domain, metric, entityType, entityName, timeScope.
 * Sits between classifier and aggregator. No LLM.
 */

const { normalize } = require('./query-normalizer');
const { classify } = require('./query-classifier');

const DOMAINS = {
  finance_summary: 'finance_summary',
  appointment_summary: 'appointment_summary',
  treatment_progress: 'treatment_progress',
  doctor_treatment_performance: 'doctor_treatment_performance',
  patient_balance: 'patient_balance',
  patient_last_payment: 'patient_last_payment',
  patient_summary: 'patient_summary',
  patient_appointments: 'patient_appointments',
  patient_treatment_plans: 'patient_treatment_plans',
  patient_treatment_plan_details: 'patient_treatment_plan_details',
  doctor_schedule: 'doctor_schedule',
  current_account_balance: 'current_account_balance',
  current_account_transactions: 'current_account_transactions',
  low_stock_products: 'low_stock_products',
  unsupported_query: 'unsupported_query',
};

const METRICS = {
  collection_amount: 'collection_amount',
  revenue_amount: 'revenue_amount',
  outstanding_balance: 'outstanding_balance',
  payment_count: 'payment_count',
  appointment_count: 'appointment_count',
  completed_appointments: 'completed_appointments',
  patient_count: 'patient_count',
  completion_percentage: 'completion_percentage',
  completed_value: 'completed_value',
  completed_item_count: 'completed_item_count',
  remaining_value: 'remaining_value',
  list: 'list',
  summary: 'summary',
};

const TIME_SCOPES = {
  today: 'today',
  this_month: 'this_month',
  last_3_months: 'last_3_months',
  custom: 'custom',
  null: null,
};

const ENTITY_TYPES = {
  patient: 'patient',
  doctor: 'doctor',
  treatment_plan: 'treatment_plan',
  current_account: 'current_account',
  inventory_item: 'inventory_item',
  none: 'none',
};

// Map classifier domain -> interpretation domain + metric + timeScope
const DOMAIN_METRIC_MAP = {
  monthly_finance_summary: {
    domain: DOMAINS.finance_summary,
    metric: METRICS.collection_amount,
    timeScope: TIME_SCOPES.this_month,
    entityType: ENTITY_TYPES.none,
  },
  today_collection_summary: {
    domain: DOMAINS.finance_summary,
    metric: METRICS.collection_amount,
    timeScope: TIME_SCOPES.today,
    entityType: ENTITY_TYPES.none,
  },
  today_appointment_count: {
    domain: DOMAINS.appointment_summary,
    metric: METRICS.appointment_count,
    timeScope: TIME_SCOPES.today,
    entityType: ENTITY_TYPES.none,
  },
  today_patient_count: {
    domain: DOMAINS.appointment_summary,
    metric: METRICS.patient_count,
    timeScope: TIME_SCOPES.today,
    entityType: ENTITY_TYPES.none,
  },
  clinic_overview: {
    domain: DOMAINS.appointment_summary,
    metric: METRICS.list,
    timeScope: TIME_SCOPES.today,
    entityType: ENTITY_TYPES.none,
  },
  patient_balance: {
    domain: DOMAINS.patient_balance,
    metric: METRICS.outstanding_balance,
    timeScope: null,
    entityType: ENTITY_TYPES.patient,
  },
  patient_last_payment: {
    domain: DOMAINS.patient_last_payment,
    metric: METRICS.summary,
    timeScope: null,
    entityType: ENTITY_TYPES.patient,
  },
  patient_summary: { domain: DOMAINS.patient_summary, metric: METRICS.summary, timeScope: null, entityType: ENTITY_TYPES.patient },
  patient_appointments: { domain: DOMAINS.patient_appointments, metric: METRICS.summary, timeScope: null, entityType: ENTITY_TYPES.patient },
  patient_treatment_plans: { domain: DOMAINS.patient_treatment_plans, metric: METRICS.list, timeScope: null, entityType: ENTITY_TYPES.patient },
  patient_treatment_plan_details: { domain: DOMAINS.patient_treatment_plan_details, metric: METRICS.list, timeScope: null, entityType: ENTITY_TYPES.treatment_plan },
  patient_treatment_progress: { domain: DOMAINS.treatment_progress, metric: METRICS.completion_percentage, timeScope: null, entityType: ENTITY_TYPES.patient },
  doctor_treatment_performance: { domain: DOMAINS.doctor_treatment_performance, metric: METRICS.completed_item_count, timeScope: TIME_SCOPES.this_month, entityType: ENTITY_TYPES.doctor },
  monthly_appointment_count: { domain: DOMAINS.appointment_summary, metric: METRICS.appointment_count, timeScope: TIME_SCOPES.this_month, entityType: ENTITY_TYPES.none },
  monthly_appointment_count_for_doctor: { domain: DOMAINS.appointment_summary, metric: METRICS.appointment_count, timeScope: TIME_SCOPES.this_month, entityType: ENTITY_TYPES.doctor },
  today_appointment_count_for_doctor: { domain: DOMAINS.appointment_summary, metric: METRICS.appointment_count, timeScope: TIME_SCOPES.today, entityType: ENTITY_TYPES.doctor },
  overdue_installment_patients: { domain: DOMAINS.finance_summary, metric: METRICS.list, timeScope: null, entityType: ENTITY_TYPES.none },
  doctor_schedule: { domain: DOMAINS.doctor_schedule, metric: METRICS.list, timeScope: TIME_SCOPES.today, entityType: ENTITY_TYPES.doctor },
  current_account_balance: { domain: DOMAINS.current_account_balance, metric: METRICS.outstanding_balance, timeScope: null, entityType: ENTITY_TYPES.current_account },
  current_account_transactions: { domain: DOMAINS.current_account_transactions, metric: METRICS.list, timeScope: null, entityType: ENTITY_TYPES.current_account },
  low_stock_products: { domain: DOMAINS.low_stock_products, metric: METRICS.list, timeScope: null, entityType: ENTITY_TYPES.none },
};

// Pattern overrides for metric refinement (norm -> { metric?, timeScope? })
function refineMetricFromQuery(norm, classifierDomain) {
  // "tahsilat" = collection only
  if (/tahsilat|tahsilat yaptık|ödeme aldık/.test(norm) && classifierDomain === 'monthly_finance_summary') {
    return { metric: METRICS.collection_amount };
  }
  // "ciro" = revenue (often same as collection in clinic)
  if (/ciro|gelir|revenue/.test(norm) && classifierDomain === 'monthly_finance_summary') {
    return { metric: METRICS.collection_amount }; // clinic: ciro = tahsilat
  }
  // "kaç randevu" = count only
  if (/kaç randevu|randevu sayısı|randevu sayisi|ne kadar randevu|randevu vardı|randevu var/.test(norm)) {
    return { metric: METRICS.appointment_count };
  }
  // "bu ay boyunca" = this_month
  if (/bu ay boyunca|bu ay içinde|mart ayı|ocak ayı|şubat ayı/.test(norm)) {
    return { timeScope: TIME_SCOPES.this_month };
  }
  return {};
}

// Treatment progress patterns
const PATIENT_POSSESSIVE = /^(.+?)[''](?:nın|nin|nun|nün|ın|in|un|ün)\s/i;
const DOCTOR_PATTERNS = [
  /Dr\.?\s*(.+?)[''](?:ın|in|ün|un)\s/i,
  /Dr\.?\s+(.+?)[''](?:ın|in)\s/i,
  /doktor\s+(.+?)(?:\s|$)/i,
  /Dr\.?\s+(.+?)(?=\s|$)/i,
];

function extractPatientName(msg) {
  const t = (msg || '').trim();
  const m = t.match(PATIENT_POSSESSIVE);
  if (m) return m[1].trim();
  const isimli = t.match(/(.+?)\s+isimli\s+hastanın/i);
  if (isimli) return isimli[1].trim();
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

/**
 * Interpret query into structured request.
 * @param {string} message
 * @param {Object} memory
 * @param {Object} classification - from classify()
 * @returns {Object} Structured interpretation
 */
function interpret(message, memory = null, classification = null) {
  const { normalized: norm, raw: rawQuery } = normalize(message || '');
  const classResult = classification || classify(message, memory);

  const base = {
    rawQuery,
    normalizedQuery: norm,
    needsClarification: classResult.needsClarification || false,
    clarificationReason: classResult.clarificationReason || null,
    extractedParams: classResult.extractedParams || {},
  };

  if (classResult.domain === 'unsupported_query') {
    return {
      ...base,
      domain: DOMAINS.unsupported_query,
      entityType: ENTITY_TYPES.none,
      entityName: null,
      metric: null,
      timeScope: null,
      filters: {},
      aggregatorKey: null,
    };
  }

  const mapEntry = DOMAIN_METRIC_MAP[classResult.domain];
  if (!mapEntry) {
    return {
      ...base,
      domain: DOMAINS.unsupported_query,
      entityType: ENTITY_TYPES.none,
      entityName: null,
      metric: null,
      timeScope: null,
      filters: {},
      aggregatorKey: null,
    };
  }

  const refinement = refineMetricFromQuery(norm, classResult.domain);
  const metric = refinement.metric ?? mapEntry.metric;
  const timeScope = refinement.timeScope ?? mapEntry.timeScope;

  let entityName = null;
  let entityType = mapEntry.entityType;

  // Override for treatment_progress / doctor_treatment_performance from query patterns
  const patientName = extractPatientName(rawQuery);
  const doctorName = extractDoctorName(rawQuery);

  // "tedavisinin yüzde kaçı tamamlandı" -> treatment_progress + completion_percentage
  if (patientName && /tedavisinin\s+(yüzde\s+)?kaçı\s+tamamlandı|tedavisinin\s+kaç\s+tl|kaç\s+tl['']?lik\s+kısmı\s+tamamlandı/.test(norm)) {
    return {
      ...base,
      domain: DOMAINS.treatment_progress,
      entityType: ENTITY_TYPES.patient,
      entityName: patientName,
      metric: /yüzde|yüzde kaç/.test(norm) ? METRICS.completion_percentage : METRICS.completed_value,
      timeScope: null,
      filters: {},
      aggregatorKey: 'patient_treatment_progress',
      extractedParams: { ...base.extractedParams, patientQuery: patientName },
    };
  }

  // Doctor + randevu + bu ay -> monthly_appointment_count_for_doctor (entityType already set by classifier)
  if (doctorName && /randevu/.test(norm) && (/\bbu ay\b/.test(norm) || /\b(mart|ocak|şubat|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+ayı?\b/.test(norm))) {
    const mapEntryDoctor = DOMAIN_METRIC_MAP[classResult.domain];
    if (mapEntryDoctor) {
      return {
        ...base,
        domain: DOMAINS.appointment_summary,
        entityType: ENTITY_TYPES.doctor,
        entityName: doctorName.replace(/^Dr\.?\s*/i, '').trim(),
        metric: METRICS.appointment_count,
        timeScope: TIME_SCOPES.this_month,
        filters: {},
        aggregatorKey: classResult.domain,
        classifierDomain: classResult.domain,
        extractedParams: { ...base.extractedParams, doctorQuery: doctorName },
      };
    }
  }

  // Doctor + randevu + bugün -> today_appointment_count_for_doctor
  if (doctorName && /\bbugün\b/.test(norm) && /randevu/.test(norm) && classResult.domain === 'today_appointment_count_for_doctor') {
    return {
      ...base,
      domain: DOMAINS.appointment_summary,
      entityType: ENTITY_TYPES.doctor,
      entityName: doctorName.replace(/^Dr\.?\s*/i, '').trim(),
      metric: METRICS.appointment_count,
      timeScope: TIME_SCOPES.today,
      filters: {},
      aggregatorKey: 'today_appointment_count_for_doctor',
      classifierDomain: classResult.domain,
      extractedParams: { ...base.extractedParams, doctorQuery: doctorName },
    };
  }

  // "Dr. X'in bu ay tamamladığı tedavi kalemi sayısı" -> doctor_treatment_performance
  if (doctorName && /tamamladığı\s+tedavi\s+kalem|tedavi\s+kalemi\s+sayısı|bu ay\s+tamamladı/.test(norm)) {
    const monthMatch = norm.match(/(?:bu ay|mart|ocak|şubat|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+ayı?/);
    return {
      ...base,
      domain: DOMAINS.doctor_treatment_performance,
      entityType: ENTITY_TYPES.doctor,
      entityName: doctorName,
      metric: METRICS.completed_item_count,
      timeScope: TIME_SCOPES.this_month,
      filters: {},
      aggregatorKey: 'doctor_treatment_item_count',
      extractedParams: { ...base.extractedParams, doctorQuery: doctorName },
    };
  }

  const doctorQuery = doctorName || base.extractedParams.doctorQuery;
  if (patientName) entityName = patientName;
  else if (doctorQuery) entityName = String(doctorQuery).replace(/^Dr\.?\s*/i, '').trim() || doctorQuery;
  else if (base.extractedParams.currentAccountQuery) entityName = base.extractedParams.currentAccountQuery;
  else if (memory?.lastResolvedPatient?.name) entityName = memory.lastResolvedPatient.name;
  else if (memory?.lastResolvedDoctor?.name) entityName = memory.lastResolvedDoctor.name;
  else if (memory?.lastResolvedCurrentAccount?.name) entityName = memory.lastResolvedCurrentAccount.name;

  // Map classifier domain to aggregator key
  const aggregatorKey = classResult.domain;

  return {
    ...base,
    domain: mapEntry.domain,
    entityType,
    entityName,
    metric,
    timeScope,
    filters: {},
    aggregatorKey,
    classifierDomain: classResult.domain,
  };
}

module.exports = {
  interpret,
  DOMAINS,
  METRICS,
  TIME_SCOPES,
  ENTITY_TYPES,
};
