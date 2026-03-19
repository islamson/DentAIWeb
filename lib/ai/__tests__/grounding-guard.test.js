/**
 * Grounding guard and capability catalog tests.
 * Run: node backend/lib/ai/__tests__/grounding-guard.test.js
 */

const { checkGrounding, inferRetrievedShape, inferRequestedShape } = require('../grounding-guard');
const { getCapability, getExpectedOutputShape, getListVariantMetric, listCapabilities } = require('../capability-catalog');
const { INTENTS, METRICS, OUTPUT_SHAPES, inferOutputShapeFromMetric } = require('../assistant-contracts');
const { applyDeterministicOverrides } = require('../semantic-validator');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

console.log('Running grounding guard & capability catalog tests...\n');

// ────── Grounding Guard Tests ──────────────────────────────────

console.log('1. List requested + count retrieved → fails grounding');
const failResult = checkGrounding({
  question: 'Bu ayki randevuları listele',
  plan: { metric: METRICS.appointment_list, outputShape: OUTPUT_SHAPES.list },
  structuredContext: { count: 42 },
});
assert(failResult.pass === false, `Expected pass=false, got ${failResult.pass}`);
assert(failResult.reason === 'list_requested_count_retrieved', `Expected list_requested_count_retrieved, got ${failResult.reason}`);
console.log('   ✓ Grounding correctly rejects list→count');

console.log('\n2. Count requested + count retrieved → passes');
const passCount = checkGrounding({
  question: 'Bu ay kaç randevu var?',
  plan: { metric: METRICS.appointment_count, outputShape: OUTPUT_SHAPES.count },
  structuredContext: { count: 42 },
});
assert(passCount.pass === true, `Expected pass=true, got ${passCount.pass}`);
console.log('   ✓ Count→count passes grounding');

console.log('\n3. List requested + rows retrieved → passes');
const passList = checkGrounding({
  question: 'Randevuları listele',
  plan: { metric: METRICS.appointment_list, outputShape: OUTPUT_SHAPES.list },
  structuredContext: {
    appointments: [{ patientName: 'Ahmet', doctorName: 'Dr. Ay\u015fe', startAt: '2026-03-19' }],
  },
});
assert(passList.pass === true, `Expected pass=true, got ${passList.pass}`);
console.log('   ✓ List→rows passes grounding');

console.log('\n4. Amount requested + amount retrieved → passes');
const passAmount = checkGrounding({
  question: 'Bu ayki ciro ne kadar?',
  plan: { metric: METRICS.revenue_amount, outputShape: OUTPUT_SHAPES.amount },
  structuredContext: { revenueAmount: 150000 },
});
assert(passAmount.pass === true, `Expected pass=true, got ${passAmount.pass}`);
console.log('   ✓ Amount→amount passes grounding');

// ────── Shape Inference Tests ──────────────────────────────────

console.log('\n5. inferRetrievedShape detects overdue patients as rows');
const overdueShape = inferRetrievedShape({
  patients: [{ fullName: 'Test', totalOverdueAmount: 5000 }],
});
assert(overdueShape === 'rows', `Expected rows, got ${overdueShape}`);
console.log('   ✓ overduePatients → rows');

console.log('\n6. inferRetrievedShape detects noShowRate as ratio');
const noShowShape = inferRetrievedShape({ noShowRate: 5.5, noShowCount: 3, totalAppointments: 55 });
assert(noShowShape === 'ratio', `Expected ratio, got ${noShowShape}`);
console.log('   ✓ noShowRate → ratio');

console.log('\n7. inferRetrievedShape detects pendingCollectionAmount as amount');
const pendingShape = inferRetrievedShape({ pendingCollectionAmount: 250000 });
assert(pendingShape === 'amount', `Expected amount, got ${pendingShape}`);
console.log('   ✓ pendingCollectionAmount → amount');

console.log('\n8. inferRequestedShape respects plan.outputShape');
const forceList = inferRequestedShape('test', { metric: METRICS.appointment_count, outputShape: 'list' });
assert(forceList === 'list', `Expected list, got ${forceList}`);
console.log('   ✓ plan.outputShape overrides metric inference');

console.log('\n9. inferRequestedShape detects Turkish list phrases');
const turkishList = inferRequestedShape('randevuları listele', { metric: METRICS.appointment_count });
assert(turkishList === 'list', `Expected list, got ${turkishList}`);
console.log('   ✓ "listele" → list');

// ────── Capability Catalog Tests ──────────────────────────────

console.log('\n10. Capability catalog: doctor_appointment_list exists');
const docAppList = getCapability(INTENTS.doctor_appointment_analysis, METRICS.appointment_list);
assert(docAppList !== null, 'Expected capability entry');
assert(docAppList.outputShape === OUTPUT_SHAPES.list, `Expected list, got ${docAppList.outputShape}`);
console.log('   ✓ doctor_appointment_list found with outputShape=list');

console.log('\n11. Capability catalog: no_show_rate exists');
const noShow = getCapability(INTENTS.clinic_appointment_analysis, METRICS.no_show_rate);
assert(noShow !== null, 'Expected capability entry');
assert(noShow.outputShape === OUTPUT_SHAPES.ratio, `Expected ratio, got ${noShow.outputShape}`);
console.log('   ✓ no_show_rate found with outputShape=ratio');

console.log('\n12. getExpectedOutputShape returns list for appointment_list');
const shape = getExpectedOutputShape(INTENTS.clinic_appointment_analysis, METRICS.appointment_list);
assert(shape === OUTPUT_SHAPES.list, `Expected list, got ${shape}`);
console.log('   ✓ Expected output shape = list');

console.log('\n13. getListVariantMetric: appointment_count → appointment_list');
const listMetric = getListVariantMetric(INTENTS.clinic_appointment_analysis, METRICS.appointment_count);
assert(listMetric === METRICS.appointment_list, `Expected appointment_list, got ${listMetric}`);
console.log('   ✓ Count→list metric conversion works');

console.log('\n14. All catalog entries have valid outputShape');
const allCaps = listCapabilities();
for (const cap of allCaps) {
  assert(
    Object.values(OUTPUT_SHAPES).includes(cap.outputShape),
    `Invalid outputShape "${cap.outputShape}" for ${cap.capability}`
  );
}
console.log(`   ✓ All ${allCaps.length} capabilities have valid outputShape`);

// ────── inferOutputShapeFromMetric Tests ──────────────────────

console.log('\n15. inferOutputShapeFromMetric infers correctly');
assert(inferOutputShapeFromMetric(METRICS.appointment_count) === OUTPUT_SHAPES.count, 'appointment_count');
assert(inferOutputShapeFromMetric(METRICS.appointment_list) === OUTPUT_SHAPES.list, 'appointment_list');
assert(inferOutputShapeFromMetric(METRICS.revenue_amount) === OUTPUT_SHAPES.amount, 'revenue_amount');
assert(inferOutputShapeFromMetric(METRICS.no_show_rate) === OUTPUT_SHAPES.ratio, 'no_show_rate');
assert(inferOutputShapeFromMetric(METRICS.completion_percentage) === OUTPUT_SHAPES.ratio, 'completion_percentage');
assert(inferOutputShapeFromMetric(METRICS.summary) === OUTPUT_SHAPES.summary, 'summary');
console.log('   ✓ All metric→outputShape inferences correct');

// ────── Semantic Deterministic Override Tests ─────────────────

console.log('\n16. Deterministic override: hasta sayısı → patient_count (not appointment_count)');
const overridden = applyDeterministicOverrides(
  { intent: INTENTS.clinic_appointment_analysis, metric: METRICS.appointment_count, timeScope: 'this_month', filters: {} },
  { primaryMetricHint: METRICS.patient_count }
);
assert(overridden.metric === METRICS.patient_count, `Expected patient_count, got ${overridden.metric}`);
assert(overridden.intent === INTENTS.clinic_patient_analysis, `Expected clinic_patient_analysis, got ${overridden.intent}`);
console.log('   ✓ patient_count override applied');

console.log('\n17. Deterministic override: listele + count → list');
const listOverride = applyDeterministicOverrides(
  { intent: INTENTS.clinic_appointment_analysis, metric: METRICS.appointment_count, timeScope: 'this_month', filters: {} },
  { listIntent: true }
);
assert(listOverride.metric === METRICS.appointment_list, `Expected appointment_list, got ${listOverride.metric}`);
console.log('   ✓ list override from count applied');

console.log('\n18. Deterministic override: kadın hasta oranı → patient_gender_ratio');
const genderOverride = applyDeterministicOverrides(
  { intent: INTENTS.clinic_patient_analysis, metric: METRICS.patient_count, timeScope: 'this_month', filters: {} },
  { primaryMetricHint: METRICS.patient_gender_ratio }
);
assert(genderOverride.metric === METRICS.patient_gender_ratio, `Expected patient_gender_ratio, got ${genderOverride.metric}`);
console.log('   ✓ gender ratio override applied');

console.log('\n✅ All grounding guard & capability catalog tests passed.');
