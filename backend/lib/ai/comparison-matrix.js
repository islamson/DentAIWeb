/**
 * Compatibility matrix for metric comparison support.
 * Defines which metrics support comparison and how.
 * Validation rejects only truly unsupported combinations.
 */

const { METRICS } = require('./assistant-contracts');

const COMPARISON_MATRIX = {
  [METRICS.revenue_amount]: {
    supportsComparison: true,
    comparisonPeriods: ['previous_month', 'previous_week'],
    retrievalName: 'getClinicMonthlyRevenueComparison',
    requiresEntity: null,
  },
  [METRICS.pending_collection_amount]: {
    supportsComparison: true,
    comparisonPeriods: ['previous_month'],
    retrievalName: 'getClinicPendingCollectionComparison',
    requiresEntity: null,
  },
  [METRICS.completed_treatment_item_count]: {
    supportsComparison: true,
    comparisonPeriods: ['previous_month'],
    retrievalName: 'getDoctorCompletedTreatmentItemCountComparison',
    requiresEntity: null, // supports both doctor-scoped and clinic-wide
  },
  [METRICS.collection_amount]: {
    supportsComparison: true,
    comparisonPeriods: ['previous_month'],
    retrievalName: 'getClinicCollectionComparison',
    requiresEntity: null,
  },
  [METRICS.appointment_count]: {
    supportsComparison: true,
    comparisonPeriods: ['previous_month'],
    retrievalName: 'getClinicAppointmentCountComparison',
    requiresEntity: null,
  },
  // ── Phase 6: New comparison entries ────────────────────────────────
  [METRICS.no_show_rate]: {
    supportsComparison: true,
    comparisonPeriods: ['previous_month'],
    retrievalName: 'getClinicNoShowRateComparison',
    requiresEntity: null,
  },
  [METRICS.cancellation_rate]: {
    supportsComparison: true,
    comparisonPeriods: ['previous_month'],
    retrievalName: 'getClinicCancellationRateComparison',
    requiresEntity: null,
  },
  [METRICS.new_patient_count]: {
    supportsComparison: true,
    comparisonPeriods: ['previous_month'],
    retrievalName: 'getClinicNewPatientCountComparison',
    requiresEntity: null,
  },
  [METRICS.doctor_revenue_amount]: {
    supportsComparison: true,
    comparisonPeriods: ['previous_month'],
    retrievalName: 'getDoctorRevenueComparison',
    requiresEntity: 'doctor',
  },
  // ── Non-comparable metrics ─────────────────────────────────────────
  [METRICS.outstanding_balance_amount]: { supportsComparison: false },
  [METRICS.overdue_receivables_amount]: { supportsComparison: false },
  [METRICS.overdue_patient_list]: { supportsComparison: false },
  [METRICS.summary]: { supportsComparison: false },
  [METRICS.last_payment]: { supportsComparison: false },
  [METRICS.completion_percentage]: { supportsComparison: false },
  [METRICS.completed_treatment_value]: { supportsComparison: false },
  [METRICS.transaction_list]: { supportsComparison: false },
  [METRICS.low_stock_list]: { supportsComparison: false },
  [METRICS.schedule_list]: { supportsComparison: false },
  [METRICS.patient_count]: { supportsComparison: false },
  [METRICS.appointment_list]: { supportsComparison: false },
  [METRICS.patient_gender_ratio]: { supportsComparison: false },
  [METRICS.appointment_patient_count_by_gender]: { supportsComparison: false },
  [METRICS.completed_treatment_count]: { supportsComparison: false },
  [METRICS.new_patient_count_by_gender]: { supportsComparison: false },
  [METRICS.debtor_patient_list]: { supportsComparison: false },
  [METRICS.cancelled_appointments_list]: { supportsComparison: false },
  [METRICS.no_show_patients_list]: { supportsComparison: false },
  [METRICS.completed_treatment_list]: { supportsComparison: false },
  [METRICS.doctor_collection_amount]: { supportsComparison: false },
  [METRICS.doctor_patient_count]: { supportsComparison: false },
  [METRICS.collection_rate]: { supportsComparison: false },
  [METRICS.treatment_completion_rate]: { supportsComparison: false },
  [METRICS.inventory_item_count]: { supportsComparison: false },
  [METRICS.low_stock_item_count]: { supportsComparison: false },
  [METRICS.expiring_stock_count]: { supportsComparison: false },
  [METRICS.expiring_stock_list]: { supportsComparison: false },
  [METRICS.stock_value_total]: { supportsComparison: false },
};

/**
 * Check if a metric supports comparison for the given period and entity.
 */
function canCompare(metric, comparisonPeriod = 'previous_month', entityType = 'none') {
  const entry = COMPARISON_MATRIX[metric];
  if (!entry || !entry.supportsComparison) return false;
  if (!entry.comparisonPeriods?.includes(comparisonPeriod)) return false;
  if (entry.requiresEntity && entityType !== entry.requiresEntity) return false;
  return true;
}

/**
 * Get the comparison executor retrieval name for a metric.
 */
function getComparisonRetrievalName(metric) {
  const entry = COMPARISON_MATRIX[metric];
  if (!entry?.supportsComparison) return null;
  return entry.retrievalName || null;
}

module.exports = {
  COMPARISON_MATRIX,
  canCompare,
  getComparisonRetrievalName,
};
