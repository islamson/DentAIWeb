/**
 * Tests for planner-first architecture components.
 * Run: node backend/lib/ai/__tests__/planner-architecture.test.js
 */

const { buildFilter } = require('../query-filter-builder');
const { selectApprovedRetrieval } = require('../approved-retrievals');
const {
  normalizePlanForExecution,
  validatePlanAgainstPolicy,
} = require('../plan-executor');
const { INTENTS, METRICS, TIME_SCOPES } = require('../assistant-contracts');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

console.log('Running planner architecture tests...\n');

// 1. Backend normalization should correct clinic intent + doctor entity
console.log('1. Backend normalization: clinic intent + doctor entity');
const normalizedDoctor = normalizePlanForExecution(
  {
    intent: INTENTS.clinic_appointment_analysis,
    entityType: 'doctor',
    entityName: 'Ayşe Demir',
    metric: METRICS.appointment_count,
    timeScope: TIME_SCOPES.this_month,
    filters: {},
    requiresClarification: false,
  },
  null
);
assert(
  normalizedDoctor.intent === INTENTS.doctor_appointment_analysis,
  `Expected doctor_appointment_analysis, got ${normalizedDoctor.intent}`
);
console.log('   ✓ Backend corrected clinic intent into doctor_appointment_analysis');

// 2. Memory should restore missing time scope for time-bound follow-up
console.log('\n2. Memory reuse for time scope');
const normalizedWithMemory = normalizePlanForExecution(
  {
    intent: INTENTS.doctor_appointment_analysis,
    entityType: 'doctor',
    entityName: 'Ayşe Demir',
    metric: METRICS.appointment_count,
    timeScope: TIME_SCOPES.none,
    filters: {},
    requiresClarification: false,
  },
  {
    lastQueryState: {
      intent: INTENTS.clinic_appointment_analysis,
      metric: METRICS.appointment_count,
      timeScope: TIME_SCOPES.this_month,
      filters: { month: 3, year: 2026 },
    },
  }
);
assert(normalizedWithMemory.timeScope === TIME_SCOPES.this_month, 'Expected timeScope restored from memory');
assert(normalizedWithMemory.filters.month === 3, 'Expected month restored from memory');
console.log('   ✓ Time scope and filters reused from memory');

// 3. Validation should reject missing period for time-bound clinic analytics
console.log('\n3. Validation rejects missing period');
const invalidPeriod = validatePlanAgainstPolicy({
  intent: INTENTS.finance_summary,
  entityType: 'none',
  entityName: null,
  metric: METRICS.collection_amount,
  timeScope: TIME_SCOPES.none,
  filters: {},
});
assert(invalidPeriod.valid === false && invalidPeriod.clarificationNeeded, 'Expected clarification for missing time scope');
console.log('   ✓ Missing period triggers clarification');

// 4. Retrieval selection: doctor monthly appointment
console.log('\n4. Retrieval selection for doctor monthly appointment');
const doctorRetrieval = selectApprovedRetrieval({
  intent: INTENTS.doctor_appointment_analysis,
  entityType: 'doctor',
  entityName: 'Ayşe Demir',
  metric: METRICS.appointment_count,
  timeScope: TIME_SCOPES.this_month,
  filters: {},
});
assert(
  doctorRetrieval?.retrievalName === 'getDoctorMonthlyAppointmentCount',
  `Expected getDoctorMonthlyAppointmentCount, got ${doctorRetrieval?.retrievalName}`
);
console.log('   ✓ Doctor monthly appointment uses doctor-scoped retrieval');

// 5. Retrieval selection: clinic monthly appointment
console.log('\n5. Retrieval selection for clinic monthly appointment');
const clinicRetrieval = selectApprovedRetrieval({
  intent: INTENTS.clinic_appointment_analysis,
  entityType: 'none',
  entityName: null,
  metric: METRICS.appointment_count,
  timeScope: TIME_SCOPES.this_month,
  filters: {},
});
assert(
  clinicRetrieval?.retrievalName === 'getClinicMonthlyAppointmentCount',
  `Expected getClinicMonthlyAppointmentCount, got ${clinicRetrieval?.retrievalName}`
);
console.log('   ✓ Clinic monthly appointment uses clinic-scoped retrieval');

// 6. Filter binding should include doctorId for doctor analytics
console.log('\n6. Final filter includes doctorId');
const ctx = { organizationId: 'org1', branchId: 'branch1' };
const filter = buildFilter(
  ctx,
  {
    intent: INTENTS.doctor_appointment_analysis,
    timeScope: TIME_SCOPES.this_month,
    filters: { month: 3, year: 2026 },
  },
  {
    doctorId: 'doc123',
    month: 3,
    year: 2026,
  }
);
assert(filter.doctorId === 'doc123', `Expected doctorId=doc123, got ${filter.doctorId}`);
assert(filter.timeRange?.from && filter.timeRange?.to, 'Expected timeRange');
console.log('   ✓ Doctor filter contains doctorId and timeRange');

// 7. Overdue receivables maps to dedicated retrieval
console.log('\n7. Overdue receivables retrieval');
const overdueRetrieval = selectApprovedRetrieval({
  intent: INTENTS.finance_summary,
  entityType: 'none',
  entityName: null,
  metric: METRICS.overdue_patient_list,
  timeScope: TIME_SCOPES.none,
  filters: {},
});
assert(
  overdueRetrieval?.retrievalName === 'getDebtorPatientList',
  `Expected getDebtorPatientList, got ${overdueRetrieval?.retrievalName}`
);
console.log('   ✓ Overdue patient list uses dedicated retrieval');

console.log('\n✅ All planner architecture tests passed.');
