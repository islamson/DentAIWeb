/**
 * Unit tests for query interpretation layer.
 * Verifies: domain, metric, entityType, entityName, timeScope, aggregatorKey.
 * Run: node backend/lib/ai/__tests__/query-interpretation.test.js
 */

const { classify } = require('../query-classifier');
const { interpret, METRICS, DOMAINS, ENTITY_TYPES } = require('../query-interpretation');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertInterpretation(query, expected, memory = null) {
  const classification = classify(query, memory);
  const interp = interpret(query, memory, classification);
  for (const [key, val] of Object.entries(expected)) {
    const actual = interp[key];
    assert(
      actual === val,
      `Query "${query}" expected ${key}=${JSON.stringify(val)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertMetric(query, expectedMetric, memory = null) {
  const classification = classify(query, memory);
  const interp = interpret(query, memory, classification);
  assert(
    interp.metric === expectedMetric,
    `Query "${query}" expected metric=${expectedMetric}, got ${interp.metric}`
  );
}

function assertAggregator(query, expectedAggregator, memory = null) {
  const classification = classify(query, memory);
  const interp = interpret(query, memory, classification);
  assert(
    interp.aggregatorKey === expectedAggregator,
    `Query "${query}" expected aggregatorKey=${expectedAggregator}, got ${interp.aggregatorKey}`
  );
}

console.log('Running query interpretation tests...\n');

// 1. "Bu ay toplam ne kadar tahsilat yaptık?" -> collection_amount, this_month
console.log('1. Monthly collection (tahsilat)');
assertInterpretation('Bu ay toplam ne kadar tahsilat yaptık?', {
  domain: DOMAINS.finance_summary,
  metric: METRICS.collection_amount,
  timeScope: 'this_month',
  entityType: ENTITY_TYPES.none,
  entityName: null,
  aggregatorKey: 'monthly_finance_summary',
});
console.log('   ✓ Tahsilat -> collection_amount, monthly_finance_summary');

// 2. "Bugün kaç randevu vardı?" -> appointment_count, today
console.log('\n2. Today appointment count');
assertInterpretation('Bugün kaç randevu vardı?', {
  domain: DOMAINS.appointment_summary,
  metric: METRICS.appointment_count,
  timeScope: 'today',
  entityType: ENTITY_TYPES.none,
  aggregatorKey: 'today_appointment_count',
});
console.log('   ✓ Bugün randevu -> appointment_count, today');

// 3. "Peki bu ay boyunca kaç randevu vardı?" -> monthly appointment count
console.log('\n3. Monthly appointment count (bu ay boyunca)');
assertInterpretation('Peki bu ay boyunca kaç randevu vardı?', {
  metric: METRICS.appointment_count,
  timeScope: 'this_month',
  aggregatorKey: 'monthly_appointment_count',
});
console.log('   ✓ Bu ay boyunca randevu -> monthly_appointment_count');

// 4. "Mart ayı boyunca kaç randevu vardı?" -> monthly with explicit month
console.log('\n4. Mart ayı appointment count');
const martResult = classify('Mart ayı boyunca kaç randevu vardı?', null);
assert(martResult.domain === 'monthly_appointment_count', `Mart ayı: expected monthly_appointment_count, got ${martResult.domain}`);
assert(martResult.extractedParams?.month === 3, `Mart ayı: expected month=3, got ${martResult.extractedParams?.month}`);
console.log('   ✓ Mart ayı -> month=3 extracted');

// 5. "Dr. Ayşe Demir'in bu ay tamamladığı tedavi kalemi sayısı kaçtır?"
console.log('\n5. Doctor treatment item count');
assertInterpretation("Dr. Ayşe Demir'in bu ay tamamladığı tedavi kalemi sayısı kaçtır?", {
  domain: DOMAINS.doctor_treatment_performance,
  entityType: ENTITY_TYPES.doctor,
  entityName: 'Ayşe Demir',
  metric: METRICS.completed_item_count,
  timeScope: 'this_month',
  aggregatorKey: 'doctor_treatment_item_count',
});
console.log('   ✓ Dr. X tedavi kalemi -> doctor_treatment_item_count');

// 6. "Mehmet Demir'in tedavisinin kaç TL'lik kısmı tamamlandı?" -> completed_value
console.log('\n6. Patient treatment completed value (TL)');
assertInterpretation("Mehmet Demir'in tedavisinin kaç TL'lik kısmı tamamlandı?", {
  domain: DOMAINS.treatment_progress,
  entityType: ENTITY_TYPES.patient,
  entityName: 'Mehmet Demir',
  metric: METRICS.completed_value,
  aggregatorKey: 'patient_treatment_progress',
});
console.log('   ✓ Kaç TL tamamlandı -> completed_value');

// 7. "Mehmet Demir isimli hastanın tedavisinin yüzde kaçı tamamlandı?" -> completion_percentage
console.log('\n7. Patient treatment completion percentage');
assertInterpretation('Mehmet Demir isimli hastanın tedavisinin yüzde kaçı tamamlandı?', {
  domain: DOMAINS.treatment_progress,
  entityType: ENTITY_TYPES.patient,
  entityName: 'Mehmet Demir',
  metric: METRICS.completion_percentage,
  aggregatorKey: 'patient_treatment_progress',
});
console.log('   ✓ Yüzde kaçı tamamlandı -> completion_percentage');

// 8. "Mehmet Demir'in ne kadar borcu kaldı?" -> patient_balance, outstanding_balance
console.log('\n8. Patient outstanding balance');
assertInterpretation("Mehmet Demir'in ne kadar borcu kaldı?", {
  domain: DOMAINS.patient_balance,
  entityType: ENTITY_TYPES.patient,
  entityName: 'Mehmet Demir',
  metric: METRICS.outstanding_balance,
  aggregatorKey: 'patient_balance',
});
console.log('   ✓ Borcu kaldı -> patient_balance');

// 9. "Düşük stoktaki ürünleri listele"
console.log('\n9. Low stock products');
assertInterpretation('Düşük stoktaki ürünleri listele', {
  domain: DOMAINS.low_stock_products,
  metric: METRICS.list,
  entityType: ENTITY_TYPES.none,
  aggregatorKey: 'low_stock_products',
});
console.log('   ✓ Düşük stok -> low_stock_products');

// 10. Metric separation: collection vs revenue (tahsilat only)
console.log('\n10. Metric separation (tahsilat = collection only)');
assertMetric('Bu ay toplam ne kadar tahsilat yaptık?', METRICS.collection_amount);
assertMetric('Bu ay ne kadar ciro yaptık?', METRICS.collection_amount);
console.log('   ✓ Tahsilat/ciro -> collection_amount (no mixed metrics)');

// 11. Today vs monthly
console.log('\n11. Time scope separation');
const todayInterp = interpret('Bugün kaç randevu vardı?', null, classify('Bugün kaç randevu vardı?', null));
const monthlyInterp = interpret('Bu ay boyunca kaç randevu vardı?', null, classify('Bu ay boyunca kaç randevu vardı?', null));
assert(todayInterp.timeScope === 'today' && todayInterp.aggregatorKey === 'today_appointment_count', 'Today scope');
assert(monthlyInterp.timeScope === 'this_month' && monthlyInterp.aggregatorKey === 'monthly_appointment_count', 'Monthly scope');
console.log('   ✓ Today vs this_month correctly separated');

// 12. Doctor-scoped monthly appointment (Case 1 from logs)
console.log('\n12. Dr.Mehmet Öz\'ün bu ay kaç randevusu vardı?');
assertInterpretation("Dr.Mehmet Öz'ün bu ay kaç randevusu vardı?", {
  entityType: ENTITY_TYPES.doctor,
  entityName: 'Mehmet Öz',
  aggregatorKey: 'monthly_appointment_count_for_doctor',
  timeScope: 'this_month',
  metric: METRICS.appointment_count,
});
console.log('   ✓ Doctor-scoped monthly appointment -> monthly_appointment_count_for_doctor');

// 13. Dr.Ayşe Demir - same pattern
console.log('\n13. Dr.Ayşe Demir\'in bu ay kaç randevusu vardı?');
assertInterpretation("Dr.Ayşe Demir'in bu ay kaç randevusu vardı?", {
  entityType: ENTITY_TYPES.doctor,
  entityName: 'Ayşe Demir',
  aggregatorKey: 'monthly_appointment_count_for_doctor',
});
console.log('   ✓ Dr. Ayşe Demir -> monthly_appointment_count_for_doctor');

// 14. Clinic-wide monthly (no doctor) - must NOT route to doctor aggregator
console.log('\n14. Bu ay toplam kaç randevu vardı? (clinic-wide)');
assertInterpretation('Bu ay toplam kaç randevu vardı?', {
  entityType: ENTITY_TYPES.none,
  aggregatorKey: 'monthly_appointment_count',
});
console.log('   ✓ Clinic-wide -> monthly_appointment_count');

// 15. Overdue installment domain
console.log('\n15. Gecikmiş taksit ödemesi bulunan hasta var mı?');
assertInterpretation('Gecikmiş taksit ödemesi bulunan hasta var mı?', {
  aggregatorKey: 'overdue_installment_patients',
});
console.log('   ✓ Overdue installment -> overdue_installment_patients');

// 16. Verify doctor vs clinic - different aggregators
console.log('\n16. Doctor vs clinic aggregator separation');
const doctorQuery = classify("Dr.Mehmet Öz'ün bu ay kaç randevusu vardı?", null);
const clinicQuery = classify('Bu ay toplam kaç randevu vardı?', null);
assert(doctorQuery.domain === 'monthly_appointment_count_for_doctor', `Doctor query: expected monthly_appointment_count_for_doctor, got ${doctorQuery.domain}`);
assert(clinicQuery.domain === 'monthly_appointment_count', `Clinic query: expected monthly_appointment_count, got ${clinicQuery.domain}`);
console.log('   ✓ Doctor and clinic use different aggregators');

console.log('\n✅ All interpretation tests passed.');
