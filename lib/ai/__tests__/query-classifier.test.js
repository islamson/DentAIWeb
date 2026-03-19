/**
 * Unit tests for query classifier and normalizer.
 * Run: node backend/lib/ai/__tests__/query-classifier.test.js
 */

const { classify, DOMAINS } = require('../query-classifier');
const { normalize } = require('../query-normalizer');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertDomain(query, expectedDomain, memory = null) {
  const r = classify(query, memory);
  assert(r.domain === expectedDomain, `Expected domain ${expectedDomain} for "${query}", got ${r.domain}`);
}

function assertNotUnsupported(query, memory = null) {
  const r = classify(query, memory);
  assert(r.domain !== DOMAINS.unsupported_query, `Query "${query}" should not be unsupported, got ${r.domain}`);
}

function assertUnsupported(query, memory = null) {
  const r = classify(query, memory);
  assert(r.domain === DOMAINS.unsupported_query, `Expected unsupported for "${query}", got ${r.domain}`);
}

function assertNormalization(raw, expectedContains) {
  const { normalized } = normalize(raw);
  assert(
    expectedContains.every((s) => normalized.includes(s)),
    `Normalized "${raw}" should contain ${JSON.stringify(expectedContains)}, got "${normalized}"`
  );
}

console.log('Running query classifier tests...\n');

// Normalization
console.log('1. Normalization');
assertNormalization('Bu gün kaç randevu vardı?', ['bugün', 'randevu']);
assertNormalization('Today appointment count', ['bugün', 'randevu']);
console.log('   ✓ bu gün => bugün, today => bugün');

// Today appointment count variants
console.log('\n2. Today appointment count');
assertDomain('Bugün ne kadar randevu vardı?', DOMAINS.today_appointment_count);
assertDomain('Bu gün kaç randevu vardı?', DOMAINS.today_appointment_count);
assertDomain('Bugün kaç tane randevu var?', DOMAINS.today_appointment_count);
assertDomain('Bugünkü randevu sayısı nedir?', DOMAINS.today_appointment_count);
assertDomain('Bugün toplam kaç randevu?', DOMAINS.today_appointment_count);
assertDomain('Today appointment count', DOMAINS.today_appointment_count);
assertDomain('How many appointments do we have today?', DOMAINS.today_appointment_count);
console.log('   ✓ All today appointment variants route to today_appointment_count');

// Today collection
console.log('\n3. Today collection summary');
assertDomain('Bugünkü tahsilat ne kadar?', DOMAINS.today_collection_summary);
assertDomain('Bugün kaç tahsilat yaptık?', DOMAINS.today_collection_summary);
console.log('   ✓ Today tahsilat routes to today_collection_summary');

// Monthly finance
console.log('\n4. Monthly finance summary');
assertDomain('Bu ay ne kadar ciro yaptık?', DOMAINS.monthly_finance_summary);
assertDomain('Bu ay ne kadar gelir oldu?', DOMAINS.monthly_finance_summary);
console.log('   ✓ Monthly finance variants route correctly');

// Low stock
console.log('\n5. Low stock products');
assertDomain('Düşük stoktaki ürünleri listele', DOMAINS.low_stock_products);
assertDomain('Düşük stokta hangi ürünler var?', DOMAINS.low_stock_products);
console.log('   ✓ Low stock variants route correctly');

// Clinic overview / today appointments (same data)
assertDomain('Bugünkü randevuları göster', DOMAINS.today_appointment_count);
console.log('   ✓ Clinic overview / today appointments');

// Unsupported / clarification
console.log('\n6. Unsupported / edge cases');
assertUnsupported('');
assertUnsupported('   ');
// "Yusuf'un hastaları kimler?" - doctor's patients - not in supported domains, should go to unsupported or clarification
const yusufResult = classify("Yusuf'un hastaları kimler?", null);
assert(
  yusufResult.domain === DOMAINS.unsupported_query || yusufResult.needsClarification,
  `Yusuf case: domain=${yusufResult.domain}, should be unsupported or need clarification`
);
console.log('   ✓ Empty and edge cases');

// Abusive / irrelevant - should not crash
console.log('\n7. Abusive / irrelevant (no crash)');
try {
  classify('asdfghjkl qwerty', null);
  classify('!!!@@@###', null);
  classify('<script>alert(1)</script>', null);
  classify('x'.repeat(10000), null);
  console.log('   ✓ No crash on abusive input');
} catch (e) {
  throw new Error(`Abusive input caused crash: ${e.message}`);
}

// Fallback behavior
console.log('\n8. Secondary fallback');
const fallbackResult = classify('bugün randevu durumu', null);
assert(
  fallbackResult.domain === DOMAINS.today_appointment_count || fallbackResult.domain === DOMAINS.clinic_overview,
  `Fallback: expected today-related domain, got ${fallbackResult.domain}`
);
console.log('   ✓ Secondary fallback works');

// Meta fields for logging
console.log('\n9. Classification meta (rawQuery, normalizedQuery, matchedRule)');
const metaResult = classify('Bugün kaç randevu var?', null);
assert(metaResult.rawQuery != null, 'rawQuery should be set');
assert(metaResult.normalizedQuery != null, 'normalizedQuery should be set');
assert(metaResult.matchedRule != null, 'matchedRule should be set');
console.log(`   ✓ rawQuery="${metaResult.rawQuery?.slice(0, 30)}..."`);
console.log(`   ✓ normalizedQuery="${metaResult.normalizedQuery?.slice(0, 40)}..."`);
console.log(`   ✓ matchedRule=${metaResult.matchedRule}`);

console.log('\n✅ All tests passed.');
