/**
 * Context Pack Builders - Structured scoped data for LLM.
 * Never expose raw DB. Server-controlled, permission-checked.
 * Returns compact JSON with exactly the data needed.
 */

const { buildPatientFinanceContext } = require('./patient-finance');
const { buildPatientAppointmentContext } = require('./patient-appointment');
const { buildClinicRevenueContext } = require('./clinic-revenue');
const { buildCurrentAccountContext } = require('./current-account');
const { buildDoctorScheduleContext } = require('./doctor-schedule');

const PACK_BUILDERS = {
  patient_finance: buildPatientFinanceContext,
  patient_appointment: buildPatientAppointmentContext,
  clinic_revenue: buildClinicRevenueContext,
  current_account: buildCurrentAccountContext,
  doctor_schedule: buildDoctorScheduleContext,
};

/**
 * Build context pack by type.
 * @param {string} packType
 * @param {Object} ctx - AiContext
 * @param {Object} params - { patientId?, doctorId?, currentAccountId?, timeRange? }
 * @returns {Promise<Object>} Compact structured context
 */
async function buildContextPack(packType, ctx, params = {}) {
  const builder = PACK_BUILDERS[packType];
  if (!builder) return { error: `Unknown context pack: ${packType}` };
  return builder(ctx, params);
}

/**
 * Map tool to context pack type for LLM analytical path.
 */
const TOOL_TO_CONTEXT_PACK = {
  get_patient_balance: 'patient_finance',
  get_patient_financial_history: 'patient_finance',
  get_patient_last_payment: 'patient_finance',
  get_patient_summary: 'patient_appointment',
  get_patient_upcoming_appointments: 'patient_appointment',
  get_monthly_finance_summary: 'clinic_revenue',
  get_weekly_finance_summary: 'clinic_revenue',
  get_payments_today: 'clinic_revenue',
  get_current_account_balance: 'current_account',
  get_current_account_last_payment: 'current_account',
  get_current_account_summary: 'current_account',
  get_current_account_last_transaction: 'current_account',
  get_current_account_transaction_summary: 'current_account',
  get_current_account_transactions: 'current_account',
  get_current_account_monthly_summary: 'current_account',
  get_doctor_schedule: 'doctor_schedule',
};

module.exports = {
  buildContextPack,
  PACK_BUILDERS,
  TOOL_TO_CONTEXT_PACK,
};
