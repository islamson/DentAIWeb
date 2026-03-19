/**
 * Schema Slicer Tests
 * Run: node backend/lib/ai/__tests__/schema-slicer.test.js
 */

'use strict';

const {
  buildSchemaSlice,
  inferDomainsFromPlan,
  getTablesForDomain,
  getDomainNames,
} = require('../read-pipeline/schema-slicer');
const { FORBIDDEN_TABLES } = require('../read-pipeline/schema-registry');

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

console.log('Running Schema Slicer tests...\n');

// ── Domain definitions ──────────────────────────────────────────────────────

console.log('Domain definitions:');

test('All domains are defined', () => {
  const domains = getDomainNames();
  assert(domains.includes('appointments'), 'Missing appointments domain');
  assert(domains.includes('patients'), 'Missing patients domain');
  assert(domains.includes('finance'), 'Missing finance domain');
  assert(domains.includes('treatment'), 'Missing treatment domain');
  assert(domains.includes('inventory'), 'Missing inventory domain');
  assert(domains.includes('lab'), 'Missing lab domain');
  assert(domains.includes('doctors'), 'Missing doctors domain');
});

test('Appointments domain has correct tables', () => {
  const tables = getTablesForDomain('appointments');
  assert(tables.includes('appointments'), 'Missing appointments');
  assert(tables.includes('patients'), 'Missing patients');
  assert(tables.includes('users'), 'Missing users');
});

test('Finance domain has payment-related tables', () => {
  const tables = getTablesForDomain('finance');
  assert(tables.includes('invoices'), 'Missing invoices');
  assert(tables.includes('payments'), 'Missing payments');
  assert(tables.includes('financial_movements'), 'Missing financial_movements');
  assert(tables.includes('current_accounts'), 'Missing current_accounts');
});

test('Treatment domain has treatment tables', () => {
  const tables = getTablesForDomain('treatment');
  assert(tables.includes('treatment_items'), 'Missing treatment_items');
  assert(tables.includes('treatment_plans'), 'Missing treatment_plans');
  assert(tables.includes('service_catalog'), 'Missing service_catalog');
});

// ── buildSchemaSlice ─────────────────────────────────────────────────────────

console.log('\nSchema slice building:');

test('Single domain slice', () => {
  const slice = buildSchemaSlice(['appointments']);
  assert(slice.tables.includes('appointments'), 'Missing appointments table');
  assert(slice.tables.includes('patients'), 'Missing patients table');
  assert(slice.promptText.includes('appointments'), 'Prompt should mention appointments');
  assert(slice.promptText.includes('AVAILABLE SCHEMA'), 'Prompt should have header');
});

test('Multi-domain slice merges tables', () => {
  const slice = buildSchemaSlice(['appointments', 'finance']);
  assert(slice.tables.includes('appointments'), 'Missing appointments');
  assert(slice.tables.includes('invoices'), 'Missing invoices');
  assert(slice.tables.includes('payments'), 'Missing payments');
  // Deduplication: patients should appear once
  const patientCount = slice.tables.filter(t => t === 'patients').length;
  assert(patientCount === 1, `patients should appear once, got ${patientCount}`);
});

test('Forbidden tables are never included', () => {
  const allDomains = getDomainNames();
  const slice = buildSchemaSlice(allDomains);
  for (const forbidden of FORBIDDEN_TABLES) {
    assert(!slice.tables.includes(forbidden), `Forbidden table ${forbidden} should not be in slice`);
  }
});

test('Empty domain list defaults to appointments', () => {
  const slice = buildSchemaSlice([]);
  assert(slice.tables.includes('appointments'), 'Default should include appointments');
});

test('Join paths are filtered to slice tables', () => {
  const slice = buildSchemaSlice(['appointments']);
  for (const join of slice.joinPaths) {
    assert(slice.tables.includes(join.from), `Join from ${join.from} not in tables`);
    assert(slice.tables.includes(join.to), `Join to ${join.to} not in tables`);
  }
});

test('Prompt text includes table descriptions', () => {
  const slice = buildSchemaSlice(['finance']);
  assert(slice.promptText.includes('Ödeme'), 'Should include Turkish descriptions');
});

// ── inferDomainsFromPlan ─────────────────────────────────────────────────────

console.log('\nDomain inference:');

test('Infers from explicit domains', () => {
  const domains = inferDomainsFromPlan({ domains: ['finance', 'patients'] });
  assert(domains.includes('finance'), 'Missing finance');
  assert(domains.includes('patients'), 'Missing patients');
});

test('Infers from targetEntities', () => {
  const domains = inferDomainsFromPlan({ targetEntities: ['appointments'], domains: [] });
  assert(domains.includes('appointments'), 'Should infer appointments');
});

test('Infers finance from payment-related entities', () => {
  const domains = inferDomainsFromPlan({ targetEntities: ['payments', 'invoices'], domains: [] });
  assert(domains.includes('finance'), 'Should infer finance');
});

test('Falls back to appointments when no info', () => {
  const domains = inferDomainsFromPlan({ targetEntities: [], domains: [] });
  assert(domains.includes('appointments'), 'Should fallback to appointments');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n❌ Some tests failed');
  process.exit(1);
} else {
  console.log('\n✅ All schema slicer tests passed.');
}
