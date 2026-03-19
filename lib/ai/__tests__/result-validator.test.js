/**
 * Result Validator Tests
 * Run: node backend/lib/ai/__tests__/result-validator.test.js
 */

'use strict';

const { validateResult, getFallbackMessage } = require('../read-pipeline/result-validator');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('Running Result Validator tests...\n');

// ── Count validation ────────────────────────────────────────────────────────

console.log('Count shape:');

test('Valid count with numeric value', () => {
  const result = validateResult([{ count: 42 }], { queryType: 'count' });
  assert(result.valid, 'Should be valid');
  assert(result.shape === 'count', `Expected count shape, got ${result.shape}`);
  assert(result.value === 42, `Expected 42, got ${result.value}`);
});

test('Empty count returns 0', () => {
  const result = validateResult([], { queryType: 'count' });
  assert(result.valid, 'Should be valid');
  assert(result.value === 0, `Expected 0, got ${result.value}`);
});

// ── Amount validation ───────────────────────────────────────────────────────

console.log('\nAmount shape:');

test('Valid amount with numeric value', () => {
  const result = validateResult([{ total_amount: 150000 }], { queryType: 'amount' });
  assert(result.valid, 'Should be valid');
  assert(result.shape === 'amount', `Expected amount shape, got ${result.shape}`);
  assert(result.value === 150000, `Expected 150000, got ${result.value}`);
});

test('Empty amount returns 0', () => {
  const result = validateResult([], { queryType: 'amount' });
  assert(result.valid, 'Should be valid');
  assert(result.value === 0, `Expected 0, got ${result.value}`);
});

// ── Ratio validation ────────────────────────────────────────────────────────

console.log('\nRatio shape:');

test('Valid ratio with numeric values', () => {
  const result = validateResult(
    [{ gender: 'female', count: 60 }, { gender: 'male', count: 40 }],
    { queryType: 'ratio' }
  );
  assert(result.valid, 'Should be valid');
});

test('Empty ratio returns 0', () => {
  const result = validateResult([], { queryType: 'ratio' });
  assert(result.valid, 'Should be valid');
  assert(result.value === 0, `Expected 0, got ${result.value}`);
});

// ── List validation ─────────────────────────────────────────────────────────

console.log('\nList shape:');

test('Valid list with rows', () => {
  const result = validateResult(
    [{ name: 'Ayşe', start_at: '2026-03-15' }, { name: 'Mehmet', start_at: '2026-03-16' }],
    { queryType: 'list' }
  );
  assert(result.valid, 'Should be valid');
  assert(result.rowCount === 2, `Expected 2 rows, got ${result.rowCount}`);
});

test('Empty list is valid', () => {
  const result = validateResult([], { queryType: 'list' });
  assert(result.valid, 'Empty list should be valid');
  assert(result.rowCount === 0, `Expected 0 rows, got ${result.rowCount}`);
});

// ── Comparison validation ───────────────────────────────────────────────────

console.log('\nComparison shape:');

test('Valid comparison with numeric values', () => {
  const result = validateResult(
    [{ period: 'this_month', count: 50 }, { period: 'last_month', count: 40 }],
    { queryType: 'comparison' }
  );
  assert(result.valid, 'Should be valid');
});

test('Empty comparison is valid with message', () => {
  const result = validateResult([], { queryType: 'comparison' });
  assert(result.valid, 'Should be valid');
});

// ── Distribution validation ─────────────────────────────────────────────────

console.log('\nDistribution shape:');

test('Valid distribution', () => {
  const result = validateResult(
    [{ hour: 9, count: 15 }, { hour: 10, count: 20 }, { hour: 11, count: 12 }],
    { queryType: 'distribution' }
  );
  assert(result.valid, 'Should be valid');
  assert(result.rowCount === 3, `Expected 3 rows, got ${result.rowCount}`);
});

// ── Summary validation ──────────────────────────────────────────────────────

console.log('\nSummary shape:');

test('Summary always valid', () => {
  const result = validateResult([{ total: 100, open: 5 }], { queryType: 'summary' });
  assert(result.valid, 'Summary should always be valid');
});

// ── Fallback messages ───────────────────────────────────────────────────────

console.log('\nFallback messages:');

test('Fallback for count returns Turkish message', () => {
  const msg = getFallbackMessage({ valid: false, shape: 'count' }, { queryType: 'count' });
  assert(msg.includes('Sayısal'), `Expected Turkish msg, got: ${msg}`);
});

test('Fallback for amount returns Turkish message', () => {
  const msg = getFallbackMessage({ valid: false, shape: 'amount' }, { queryType: 'amount' });
  assert(msg.includes('Tutar'), `Expected Turkish msg, got: ${msg}`);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n❌ Some tests failed');
  process.exit(1);
} else {
  console.log('\n✅ All result validator tests passed.');
}
