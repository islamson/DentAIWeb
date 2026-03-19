/**
 * Pipeline scope tests - verify doctor vs clinic routing and filter binding.
 * Run: node backend/lib/ai/__tests__/pipeline-scope.test.js
 */

const { classify } = require('../query-classifier');
const { interpret } = require('../query-interpretation');
const { buildFilter } = require('../query-filter-builder');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

console.log('Running pipeline scope tests...\n');

// 1. Doctor-scoped query produces aggregator that requires doctorId
console.log('1. Dr.Mehmet Öz - monthly_appointment_count_for_doctor');
const c1 = classify("Dr.Mehmet Öz'ün bu ay kaç randevusu vardı?", null);
const i1 = interpret("Dr.Mehmet Öz'ün bu ay kaç randevusu vardı?", null, c1);
assert(c1.domain === 'monthly_appointment_count_for_doctor', `Expected monthly_appointment_count_for_doctor, got ${c1.domain}`);
assert(i1.aggregatorKey === 'monthly_appointment_count_for_doctor', `Expected aggregator monthly_appointment_count_for_doctor, got ${i1.aggregatorKey}`);
assert(i1.entityType === 'doctor', `Expected entityType=doctor, got ${i1.entityType}`);
console.log('   ✓ Doctor-scoped query routes to monthly_appointment_count_for_doctor');

// 2. Clinic-wide query does NOT require doctorId
console.log('\n2. Bu ay toplam kaç randevu - clinic-wide');
const c2 = classify('Bu ay toplam kaç randevu vardı?', null);
const i2 = interpret('Bu ay toplam kaç randevu vardı?', null, c2);
assert(c2.domain === 'monthly_appointment_count', `Expected monthly_appointment_count, got ${c2.domain}`);
assert(i2.entityType === 'none', `Expected entityType=none, got ${i2.entityType}`);
console.log('   ✓ Clinic-wide uses monthly_appointment_count');

// 3. Filter builder produces doctorId when resolved has doctorId
console.log('\n3. Filter contains doctorId for doctor-scoped');
const ctx = { organizationId: 'org1', branchId: 'branch1' };
const resolved = { doctorId: 'doc123', month: 3, year: 2026 };
const filter = buildFilter(ctx, { aggregatorKey: 'monthly_appointment_count_for_doctor' }, resolved);
assert(filter.doctorId === 'doc123', `Expected filter.doctorId=doc123, got ${filter.doctorId}`);
assert(filter.timeRange != null, 'Expected filter.timeRange');
assert(filter.timeRange.from != null && filter.timeRange.to != null, 'Expected timeRange.from and to');
console.log('   ✓ Final filter contains doctorId:', filter.doctorId);

// 4. Filter for clinic-wide has no doctorId
console.log('\n4. Filter for clinic-wide has doctorId=null');
const filterClinic = buildFilter(ctx, { aggregatorKey: 'monthly_appointment_count' }, { month: 3, year: 2026 });
assert(filterClinic.doctorId === null, `Expected doctorId=null for clinic, got ${filterClinic.doctorId}`);
console.log('   ✓ Clinic filter has doctorId=null');

// 5. Dr. Ayşe and Dr. Mehmet both route to doctor aggregator (not clinic)
console.log('\n5. Both Dr. Ayşe and Dr. Mehmet use doctor aggregator');
const cAyse = classify("Dr.Ayşe Demir'in bu ay kaç randevusu vardı?", null);
const cMehmet = classify("Dr.Mehmet Öz'ün bu ay kaç randevusu vardı?", null);
assert(cAyse.domain === 'monthly_appointment_count_for_doctor', `Dr. Ayşe: expected doctor aggregator, got ${cAyse.domain}`);
assert(cMehmet.domain === 'monthly_appointment_count_for_doctor', `Dr. Mehmet: expected doctor aggregator, got ${cMehmet.domain}`);
assert(cAyse.domain !== 'monthly_appointment_count', 'Dr. Ayşe must NOT use clinic-wide');
assert(cMehmet.domain !== 'monthly_appointment_count', 'Dr. Mehmet must NOT use clinic-wide');
console.log('   ✓ Both doctors use monthly_appointment_count_for_doctor');

// 6. Overdue installment domain
console.log('\n6. Overdue installment routes correctly');
const cOverdue = classify('Gecikmiş taksit ödemesi bulunan hasta var mı?', null);
assert(cOverdue.domain === 'overdue_installment_patients', `Expected overdue_installment_patients, got ${cOverdue.domain}`);
console.log('   ✓ Overdue installment -> overdue_installment_patients');

console.log('\n✅ All pipeline scope tests passed.');
