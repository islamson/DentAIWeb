/**
 * Builds explicit filter objects for Prisma queries.
 * All aggregators receive a fully bound filter - no implicit scope.
 */

function buildMonthRange(month, year) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildTodayRange(dateStr = null) {
  const from = dateStr ? new Date(dateStr) : new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildWeekRange(referenceDate = null) {
  const from = referenceDate ? new Date(referenceDate) : new Date();
  from.setHours(0, 0, 0, 0);
  const day = from.getDay() || 7;
  from.setDate(from.getDate() - day + 1);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  to.setMilliseconds(-1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildLastThreeMonthsRange(referenceDate = null) {
  const anchor = referenceDate ? new Date(referenceDate) : new Date();
  const to = new Date(anchor);
  to.setHours(23, 59, 59, 999);
  const from = new Date(anchor.getFullYear(), anchor.getMonth() - 2, 1);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Build filter object from context and either a legacy interpretation or a new LLM plan.
 * @param {Object} ctx - { organizationId, branchId, userId }
 * @param {Object} planLike - { aggregatorKey?, retrievalKey?, intent?, timeScope?, filters? }
 * @param {Object} resolved - { doctorId, patientId, currentAccountId, month, year, date }
 * @returns {Object} Strict filter for logging and retrieval use
 */
function buildFilter(ctx, planLike, resolved = {}) {
  const filters = planLike?.filters || {};
  const base = {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId || null,
    doctorId: resolved.doctorId || null,
    patientId: resolved.patientId || null,
    currentAccountId: resolved.currentAccountId || null,
    timeRange: null,
    appointmentStatus: filters.status || null,
  };

  const routeKey = planLike?.retrievalKey || planLike?.aggregatorKey || planLike?.intent || null;
  const timeScope = planLike?.timeScope || null;
  const now = new Date();
  const month = resolved.month ?? filters.month ?? now.getMonth() + 1;
  const year = resolved.year ?? filters.year ?? now.getFullYear();

  if (timeScope === 'today') {
    base.timeRange = buildTodayRange(resolved.date || filters.date || null);
    return base;
  }
  if (timeScope === 'this_week') {
    base.timeRange = buildWeekRange(filters.date || null);
    return base;
  }
  if (timeScope === 'this_month') {
    base.timeRange = buildMonthRange(month, year);
    return base;
  }
  if (timeScope === 'last_3_months') {
    base.timeRange = buildLastThreeMonthsRange(filters.date || null);
    return base;
  }
  if (timeScope === 'custom') {
    if (filters.month && filters.year) {
      base.timeRange = buildMonthRange(filters.month, filters.year);
      return base;
    }
    if (filters.fromDate && filters.toDate) {
      const from = new Date(filters.fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(filters.toDate);
      to.setHours(23, 59, 59, 999);
      base.timeRange = { from: from.toISOString(), to: to.toISOString() };
      return base;
    }
  }

  switch (routeKey) {
    case 'monthly_appointment_count':
    case 'monthly_appointment_count_for_doctor':
    case 'monthly_finance_summary':
    case 'clinic_appointment_analysis':
    case 'doctor_appointment_analysis':
    case 'clinic_patient_demographics':
      base.timeRange = buildMonthRange(month, year);
      break;
    case 'today_appointment_count':
    case 'today_appointment_count_for_doctor':
    case 'today_patient_count':
    case 'clinic_overview':
    case 'doctor_schedule':
      base.timeRange = buildTodayRange(resolved.date || filters.date || null);
      break;
    default:
      break;
  }

  return base;
}

module.exports = { buildFilter };
