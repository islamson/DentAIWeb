/**
 * SQL Validator Tests (updated for camelCase schema)
 * Run: node backend/lib/ai/__tests__/sql-validator.test.js
 */

'use strict';

const { validateSql, extractReferencedTables, validateSchemaReferences } = require('../read-pipeline/sql-validator');

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

console.log('Running SQL Validator tests...\n');

// ── Valid queries (camelCase) ─────────────────────────────────────────────

console.log('Valid SELECTs:');

test('Simple count query', () => {
  const result = validateSql('SELECT COUNT(*) AS count FROM appointments');
  assert(result.valid, `Expected valid, got: ${result.reason}`);
});

test('Query with WHERE and LIMIT (camelCase)', () => {
  const result = validateSql(`
    SELECT id, "firstName", "lastName"
    FROM patients
    WHERE "createdAt" >= '2026-01-01'
    LIMIT 50
  `);
  assert(result.valid, `Expected valid, got: ${result.reason}`);
});

test('Query with JOIN (camelCase)', () => {
  const result = validateSql(`
    SELECT a.id, p."firstName", p."lastName", a."startAt", a.status
    FROM appointments a
    JOIN patients p ON a."patientId" = p.id
    WHERE a.status = 'COMPLETED'
    LIMIT 50
  `);
  assert(result.valid, `Expected valid, got: ${result.reason}`);
});

test('Aggregate with GROUP BY', () => {
  const result = validateSql(`
    SELECT u.name, COUNT(*) AS count
    FROM treatment_items ti
    JOIN users u ON ti."assignedDoctorId" = u.id
    WHERE ti.status = 'COMPLETED'
    GROUP BY u.name
    ORDER BY count DESC
    LIMIT 10
  `);
  assert(result.valid, `Expected valid, got: ${result.reason}`);
});

test('SUM aggregate (no LIMIT needed)', () => {
  const result = validateSql(`
    SELECT SUM(amount) AS total_amount
    FROM payments
    WHERE "deletedAt" IS NULL
  `);
  assert(result.valid, `Expected valid, got: ${result.reason}`);
});

test('CTE with WITH clause', () => {
  const result = validateSql(`
    WITH monthly AS (
      SELECT DATE_TRUNC('month', "startAt") AS month, COUNT(*) AS cnt
      FROM appointments
      GROUP BY DATE_TRUNC('month', "startAt")
    )
    SELECT month, cnt FROM monthly ORDER BY month LIMIT 12
  `);
  assert(result.valid, `Expected valid, got: ${result.reason}`);
});

// ── Invalid queries ───────────────────────────────────────────────────────

console.log('\nRejected queries:');

test('Rejects INSERT', () => {
  const result = validateSql("INSERT INTO patients (\"firstName\") VALUES ('test')");
  assert(!result.valid, 'Expected rejection');
});

test('Rejects UPDATE', () => {
  const result = validateSql("UPDATE patients SET \"firstName\" = 'hacked' WHERE id = '1'");
  assert(!result.valid, 'Expected rejection');
});

test('Rejects DELETE', () => {
  const result = validateSql("DELETE FROM patients WHERE id = '1'");
  assert(!result.valid, 'Expected rejection');
});

test('Rejects DROP TABLE', () => {
  const result = validateSql('DROP TABLE patients');
  assert(!result.valid, 'Expected rejection');
});

test('Rejects ALTER TABLE', () => {
  const result = validateSql("ALTER TABLE patients ADD COLUMN hack TEXT");
  assert(!result.valid, 'Expected rejection');
});

test('Rejects TRUNCATE', () => {
  const result = validateSql('TRUNCATE patients');
  assert(!result.valid, 'Expected rejection');
});

test('Rejects SELECT INTO', () => {
  const result = validateSql('SELECT id INTO temp_table FROM patients LIMIT 10');
  assert(!result.valid, 'Expected rejection');
});

test('Rejects SELECT *', () => {
  const result = validateSql('SELECT * FROM patients LIMIT 10');
  assert(!result.valid, 'Expected rejection');
});

test('Rejects multi-statement', () => {
  const result = validateSql("SELECT id FROM patients LIMIT 1; DROP TABLE patients");
  assert(!result.valid, 'Expected rejection');
});

test('Rejects SQL comments (line)', () => {
  const result = validateSql('SELECT id FROM patients LIMIT 10 -- hack');
  assert(!result.valid, 'Expected rejection');
});

test('Rejects SQL comments (block)', () => {
  const result = validateSql('SELECT id FROM patients /* hack */ LIMIT 10');
  assert(!result.valid, 'Expected rejection');
});

test('Rejects forbidden table: ai_request_logs', () => {
  const result = validateSql('SELECT COUNT(*) FROM ai_request_logs');
  assert(!result.valid, 'Expected rejection');
  assert(result.reason.includes('Forbidden table'), `Wrong reason: ${result.reason}`);
});

test('Rejects missing LIMIT for row queries', () => {
  const result = validateSql('SELECT id, "firstName" FROM patients WHERE id IS NOT NULL');
  assert(!result.valid, 'Expected rejection');
  assert(result.reason.includes('LIMIT'), `Wrong reason: ${result.reason}`);
});

test('Rejects dangerous function: pg_sleep', () => {
  const result = validateSql("SELECT pg_sleep(10) FROM patients LIMIT 1");
  assert(!result.valid, 'Expected rejection');
});

test('Rejects excessive JOINs (>6)', () => {
  const sql = `
    SELECT a.id FROM appointments a
    JOIN patients p ON a."patientId" = p.id
    JOIN users u ON a."doctorUserId" = u.id
    JOIN invoices i ON i."patientId" = p.id
    JOIN payments pay ON pay."invoiceId" = i.id
    JOIN treatment_plans tp ON tp."patientId" = p.id
    JOIN treatment_items ti ON ti."treatmentPlanId" = tp.id
    JOIN service_catalog sc ON ti."catalogServiceId" = sc.id
    LIMIT 10
  `;
  const result = validateSql(sql);
  assert(!result.valid, 'Expected rejection');
  assert(result.reason.includes('JOIN'), `Wrong reason: ${result.reason}`);
});

test('Rejects oversized SQL', () => {
  const longSql = 'SELECT id FROM patients WHERE ' + 'id IS NOT NULL AND '.repeat(300) + 'TRUE LIMIT 1';
  const result = validateSql(longSql);
  assert(!result.valid, 'Expected rejection');
});

test('Rejects null/empty input', () => {
  assert(!validateSql(null).valid, 'null should be rejected');
  assert(!validateSql('').valid, 'empty should be rejected');
  assert(!validateSql('   ').valid, 'whitespace should be rejected');
});

// ── Schema-aware validation ─────────────────────────────────────────────

console.log('\nSchema-aware validation:');

test('Rejects unknown column (snake_case)', () => {
  const result = validateSql(`
    SELECT a.id, a."patient_id"
    FROM appointments a
    LIMIT 10
  `);
  // patient_id doesn't exist; patientId does
  if (result.valid) {
    // It's valid structurally but schema check should catch it
    const schemaResult = validateSchemaReferences('SELECT a."patient_id" FROM appointments a LIMIT 10');
    assert(!schemaResult.valid, 'Schema check should catch snake_case column');
  }
});

test('Accepts valid camelCase column', () => {
  const schemaResult = validateSchemaReferences('SELECT appointments."patientId" FROM appointments');
  assert(schemaResult.valid, `Expected valid, got errors: ${schemaResult.errors.join(', ')}`);
});

test('Rejects unknown table', () => {
  const schemaResult = validateSchemaReferences('SELECT id FROM nonexistent_table LIMIT 10');
  assert(!schemaResult.valid, 'Should reject unknown table');
  assert(schemaResult.errors.some(e => e.includes('nonexistent_table')), 'Should mention the table name');
});

// ── extractReferencedTables ─────────────────────────────────────────────

console.log('\nTable extraction:');

test('Extracts tables from simple query', () => {
  const tables = extractReferencedTables('SELECT id FROM patients LIMIT 10');
  assert(tables.has('patients'), 'Expected patients');
});

test('Extracts tables from JOIN query', () => {
  const tables = extractReferencedTables(`
    SELECT a.id FROM appointments a
    JOIN patients p ON a."patientId" = p.id
    JOIN users u ON a."doctorUserId" = u.id
  `);
  assert(tables.has('appointments'), 'Expected appointments');
  assert(tables.has('patients'), 'Expected patients');
  assert(tables.has('users'), 'Expected users');
});

test('Does NOT treat EXTRACT(HOUR FROM "startAt") column as table', () => {
  const sql = `SELECT EXTRACT(HOUR FROM "startAt") AS "hour", COUNT(*) AS "count"
    FROM appointments
    WHERE "status" = 'CANCELLED'
    GROUP BY EXTRACT(HOUR FROM "startAt")
    ORDER BY "count" DESC
    LIMIT 100`;
  const tables = extractReferencedTables(sql);
  assert(tables.has('appointments'), 'Expected appointments');
  assert(!tables.has('startat'), 'Must NOT treat "startAt" inside EXTRACT as table');
});

test('EXTRACT cancellation distribution query validates', () => {
  const sql = `SELECT EXTRACT(HOUR FROM "startAt") AS "hour", COUNT(*) AS "count"
    FROM appointments
    WHERE "status" = 'CANCELLED'
    GROUP BY EXTRACT(HOUR FROM "startAt")
    ORDER BY "count" DESC
    LIMIT 100`;
  const result = validateSql(sql, { schemaAware: true });
  assert(result.valid, `Expected valid, got: ${result.reason}`);
});

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n❌ Some tests failed');
  process.exit(1);
} else {
  console.log('\n✅ All SQL validator tests passed.');
}
