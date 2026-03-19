/**
 * Scope Injector Tests (updated for camelCase identifiers)
 * Run: node backend/lib/ai/__tests__/scope-injector.test.js
 */

'use strict';

const { injectScope, analyzeTablesForScoping, findTableAliases } = require('../read-pipeline/scope-injector');

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

console.log('Running Scope Injector tests...\n');

const ctx = { organizationId: 'org_123', branchId: 'branch_456' };
const ctxNoBranch = { organizationId: 'org_123', branchId: null };

// ── analyzeTablesForScoping ──────────────────────────────────────────────────

console.log('Table scope analysis:');

test('Detects org scope for patients table (camelCase)', () => {
  const map = analyzeTablesForScoping('SELECT id FROM patients LIMIT 10');
  assert(map.patients?.needsOrg === true, 'patients should need org scope');
});

test('Detects org scope for appointments table', () => {
  const map = analyzeTablesForScoping('SELECT id FROM appointments LIMIT 10');
  assert(map.appointments?.needsOrg === true, 'appointments should need org scope');
});

test('No scope for tables without org column', () => {
  const map = analyzeTablesForScoping('SELECT id FROM treatment_item_teeth LIMIT 10');
  const teeth = map.treatment_item_teeth;
  assert(!teeth || !teeth.needsOrg, 'treatment_item_teeth should NOT need org scope');
});

// ── findTableAliases ─────────────────────────────────────────────────────────

console.log('\nAlias detection:');

test('Finds alias in FROM clause', () => {
  const aliases = findTableAliases('SELECT p.id FROM patients p LIMIT 10');
  assert(aliases.patients === 'p', `Expected alias p, got ${aliases.patients}`);
});

test('Finds alias with AS keyword', () => {
  const aliases = findTableAliases('SELECT p.id FROM patients AS p LIMIT 10');
  assert(aliases.patients === 'p', `Expected alias p, got ${aliases.patients}`);
});

test('Finds multiple aliases', () => {
  const aliases = findTableAliases(`
    SELECT a.id FROM appointments a
    JOIN patients p ON a."patientId" = p.id
  `);
  assert(aliases.appointments === 'a', `Expected alias a, got ${aliases.appointments}`);
  assert(aliases.patients === 'p', `Expected alias p, got ${aliases.patients}`);
});

// ── injectScope ─────────────────────────────────────────────────────────

console.log('\nScope injection (camelCase):');

test('Injects org scope with camelCase column name', () => {
  const sql = "SELECT COUNT(*) FROM appointments WHERE status = 'COMPLETED'";
  const result = injectScope(sql, ctxNoBranch);
  assert(result.sql.includes('"organizationId"'), 'Should use camelCase organizationId');
  assert(!result.sql.includes('organization_id'), 'Should NOT use snake_case');
  assert(result.sql.includes('$1'), 'Should use parameterized $1');
  assert(result.params.length === 1, `Expected 1 param, got ${result.params.length}`);
  assert(result.params[0] === 'org_123', `Expected org_123, got ${result.params[0]}`);
});

test('Injects org scope into query WITHOUT WHERE', () => {
  const sql = 'SELECT COUNT(*) FROM appointments';
  const result = injectScope(sql, ctxNoBranch);
  assert(result.sql.includes('WHERE'), 'Should add WHERE clause');
  assert(result.sql.includes('"organizationId"'), 'Should include camelCase organizationId');
});

test('Injects both org and branch scope (camelCase)', () => {
  const sql = "SELECT COUNT(*) FROM appointments WHERE status = 'COMPLETED'";
  const result = injectScope(sql, ctx);
  assert(result.sql.includes('"organizationId"'), 'Should include organizationId');
  assert(result.sql.includes('"branchId"'), 'Should include branchId');
  assert(!result.sql.includes('organization_id'), 'Should NOT use snake_case org');
  assert(!result.sql.includes('branch_id'), 'Should NOT use snake_case branch');
  assert(result.params.length === 2, `Expected 2 params, got ${result.params.length}`);
  assert(result.params[0] === 'org_123', `Expected org_123, got ${result.params[0]}`);
  assert(result.params[1] === 'branch_456', `Expected branch_456, got ${result.params[1]}`);
});

test('Handles aliased tables (camelCase)', () => {
  const sql = `SELECT a.id, p."firstName"
    FROM appointments a
    JOIN patients p ON a."patientId" = p.id
    WHERE a.status = 'COMPLETED'
    LIMIT 50`;
  const result = injectScope(sql, ctxNoBranch);
  assert(result.sql.includes('"organizationId"'), 'Should include camelCase organizationId');
  assert(result.params.length >= 1, 'Should have at least 1 param');
});

test('No literal "Ekleme" in output', () => {
  const sql = "SELECT COUNT(*) FROM appointments WHERE status = 'COMPLETED'";
  const result = injectScope(sql, ctx);
  assert(!result.sql.includes('Ekleme'), 'Should NOT contain "Ekleme"');
  assert(!result.sql.includes("'org_"), 'Should NOT contain literal org ID');
  assert(result.sql.includes('$'), 'Should use $ parameterized placeholders');
});

test('Returns unchanged SQL when no context', () => {
  const sql = 'SELECT COUNT(*) FROM appointments';
  const result = injectScope(sql, { organizationId: null });
  assert(result.sql === sql, 'SQL should be unchanged');
  assert(result.params.length === 0, 'No params expected');
});

test('Injects before GROUP BY when no WHERE exists', () => {
  const sql = 'SELECT status, COUNT(*) FROM appointments GROUP BY status LIMIT 10';
  const result = injectScope(sql, ctxNoBranch);
  const whereIdx = result.sql.indexOf('WHERE');
  const groupIdx = result.sql.indexOf('GROUP BY');
  assert(whereIdx >= 0, 'Should have WHERE clause');
  assert(whereIdx < groupIdx, 'WHERE should come before GROUP BY');
});

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n❌ Some tests failed');
  process.exit(1);
} else {
  console.log('\n✅ All scope injector tests passed.');
}
