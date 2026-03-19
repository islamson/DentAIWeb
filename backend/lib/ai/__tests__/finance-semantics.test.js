/**
 * Finance semantic regression tests.
 * Run: node backend/lib/ai/__tests__/finance-semantics.test.js
 */

const { analyzeBusinessSemantics } = require('../business-ontology');
const { validateSemanticAlignment } = require('../semantic-validator');
const { normalizePlanForExecution } = require('../plan-executor');
const { selectApprovedRetrieval } = require('../approved-retrievals');
const { INTENTS, METRICS, TIME_SCOPES } = require('../assistant-contracts');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

console.log('Running finance semantics tests...\n');

// 1. Pending collection query should map to pending_collection_amount
console.log('1. Bu ayki bekleyen tahsilat ne kadar?');
const pendingAnalysis = analyzeBusinessSemantics('Bu ayki bekleyen tahsilat ne kadar?', null);
assert(
  pendingAnalysis.primaryMetricHint === METRICS.pending_collection_amount,
  `Expected pending_collection_amount, got ${pendingAnalysis.primaryMetricHint}`
);
assert(pendingAnalysis.timeScopeHint === TIME_SCOPES.this_month, 'Expected this_month hint');
console.log('   ✓ bekleyen tahsilat -> pending_collection_amount');

// 2. Total collection query should map to collection_amount
console.log('\n2. Bu ay toplam tahsilat ne kadar?');
const collectionAnalysis = analyzeBusinessSemantics('Bu ay toplam tahsilat ne kadar?', null);
assert(
  collectionAnalysis.primaryMetricHint === METRICS.collection_amount,
  `Expected collection_amount, got ${collectionAnalysis.primaryMetricHint}`
);
console.log('   ✓ toplam tahsilat -> collection_amount');

// 3. Semantic mismatch must be detected
console.log('\n3. Semantic mismatch: planner says collection_amount for pending query');
const mismatch = validateSemanticAlignment({
  analysis: pendingAnalysis,
  plan: normalizePlanForExecution({
    intent: INTENTS.finance_summary,
    metric: METRICS.collection_amount,
    entityType: 'none',
    entityName: null,
    timeScope: TIME_SCOPES.this_month,
    filters: {},
    requiresClarification: false,
  }),
});
assert(mismatch.semanticMismatch === true, 'Expected semantic mismatch');
assert(mismatch.expectedMetric === METRICS.pending_collection_amount, 'Expected pending_collection_amount mismatch');
console.log('   ✓ semantic mismatch detected before retrieval');

// 4. Correction follow-up should preserve prior scope and only update metric
console.log('\n4. Correction follow-up updates metric only');
const correctionMemory = {
  lastQueryState: {
    intent: INTENTS.finance_summary,
    metric: METRICS.collection_amount,
    timeScope: TIME_SCOPES.this_month,
    filters: { month: 3, year: 2026 },
  },
};
const correctionAnalysis = analyzeBusinessSemantics(
  'Emin misin, o toplam tahsilat idi, ben bekleyen tahsilatı soruyorum',
  correctionMemory
);
const corrected = validateSemanticAlignment({
  analysis: correctionAnalysis,
  plan: normalizePlanForExecution({
    intent: INTENTS.finance_summary,
    metric: METRICS.collection_amount,
    entityType: 'none',
    entityName: null,
    timeScope: TIME_SCOPES.none,
    filters: {},
    requiresClarification: false,
  }, correctionMemory),
  memory: correctionMemory,
});
assert(corrected.adjustedPlan.metric === METRICS.pending_collection_amount, 'Expected metric correction');
assert(corrected.adjustedPlan.timeScope === TIME_SCOPES.this_month, 'Expected previous timeScope preserved');
assert(corrected.adjustedPlan.filters.month === 3, 'Expected previous month preserved');
console.log('   ✓ correction preserves timeScope and updates only metric');

// 5. Compare-to-previous should set comparison flag
console.log('\n5. Bekleyen tahsilat geçen aya göre arttı mı?');
const comparisonAnalysis = analyzeBusinessSemantics('Bekleyen tahsilat geçen aya göre arttı mı?', null);
assert(
  comparisonAnalysis.primaryMetricHint === METRICS.pending_collection_amount,
  `Expected pending_collection_amount, got ${comparisonAnalysis.primaryMetricHint}`
);
assert(comparisonAnalysis.filtersHint.compareToPrevious === true, 'Expected compareToPrevious=true');
console.log('   ✓ comparison hint detected');

// 6. Ciro should map to revenue_amount
console.log('\n6. Bu ayki ciro ne kadar?');
const revenueAnalysis = analyzeBusinessSemantics('Bu ayki ciro ne kadar?', null);
assert(revenueAnalysis.primaryMetricHint === METRICS.revenue_amount, 'Expected revenue_amount');
console.log('   ✓ ciro -> revenue_amount');

// 7. Overdue installment patient query should map to overdue_patient_list
console.log('\n7. Gecikmiş taksit ödemesi bulunan hasta var mı?');
const overdueAnalysis = analyzeBusinessSemantics('Gecikmiş taksit ödemesi bulunan hasta var mı?', null);
assert(
  overdueAnalysis.primaryMetricHint === METRICS.overdue_patient_list,
  `Expected overdue_patient_list, got ${overdueAnalysis.primaryMetricHint}`
);
console.log('   ✓ overdue installment patients -> overdue_patient_list');

// 8. Retrieval functions must differ by metric
console.log('\n8. Retrieval catalogue switches with metric');
const pendingRetrieval = selectApprovedRetrieval({
  intent: INTENTS.finance_summary,
  metric: METRICS.pending_collection_amount,
  entityType: 'none',
  entityName: null,
  timeScope: TIME_SCOPES.this_month,
  filters: {},
});
const collectionRetrieval = selectApprovedRetrieval({
  intent: INTENTS.finance_summary,
  metric: METRICS.collection_amount,
  entityType: 'none',
  entityName: null,
  timeScope: TIME_SCOPES.this_month,
  filters: {},
});
assert(
  pendingRetrieval?.retrievalName === 'getClinicPendingCollectionAmount',
  `Expected getClinicPendingCollectionAmount, got ${pendingRetrieval?.retrievalName}`
);
assert(
  collectionRetrieval?.retrievalName === 'getClinicMonthlyCollection',
  `Expected getClinicMonthlyCollection, got ${collectionRetrieval?.retrievalName}`
);
console.log('   ✓ retrieval changes when metric changes');

console.log('\n✅ All finance semantics tests passed.');
