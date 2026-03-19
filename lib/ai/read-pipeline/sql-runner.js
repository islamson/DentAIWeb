/**
 * SQL Runner — Safe SQL execution with timeout and row limits.
 *
 * Uses Prisma $queryRawUnsafe for parameterized execution.
 * Wraps queries in a transaction with statement_timeout.
 *
 * Error classification:
 *   AI_SQL_INVALID_SCHEMA  — column/table does not exist (schema mismatch)
 *   AI_SQL_TIMEOUT         — actual statement timeout
 *   AI_SQL_EXECUTION_ERROR — generic execution failure
 */

'use strict';

const { prisma } = require('../../prisma');

const MAX_ROWS = 500;
const STATEMENT_TIMEOUT_MS = 5000;

/**
 * Execute a validated, scope-injected SQL query safely.
 *
 * @param {string} sql - the final SQL to execute
 * @param {any[]} params - parameterized values
 * @returns {Promise<{ rows: Object[], rowCount: number, executionTimeMs: number }>}
 */
async function executeSql(sql, params = []) {
  if (!sql || typeof sql !== 'string') {
    const err = new Error('SQL is empty or not a string');
    err.code = 'AI_SQL_INVALID';
    throw err;
  }

  const start = Date.now();

  try {
    // Set statement timeout for this transaction
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT_MS}'`);
      const result = await tx.$queryRawUnsafe(sql, ...params);
      return result;
    });

    const executionTimeMs = Date.now() - start;

    // Enforce row limit
    const limitedRows = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];

    // Convert BigInt values to numbers for JSON serialization
    const serializedRows = limitedRows.map(row => {
      const clean = {};
      for (const [key, val] of Object.entries(row)) {
        if (typeof val === 'bigint') {
          clean[key] = Number(val);
        } else if (val instanceof Date) {
          clean[key] = val.toISOString();
        } else {
          clean[key] = val;
        }
      }
      return clean;
    });

    return {
      rows: serializedRows,
      rowCount: serializedRows.length,
      totalRowCount: Array.isArray(rows) ? rows.length : 0,
      executionTimeMs,
      truncated: Array.isArray(rows) && rows.length > MAX_ROWS,
    };
  } catch (err) {
    const executionTimeMs = Date.now() - start;
    const msg = err.message || '';

    // ── Error classification ─────────────────────────────────────────────
    // Priority 1: Schema mismatch — column/table does not exist
    // These errors come from PostgreSQL as "column X does not exist" or
    // "relation X does not exist" messages inside Prisma raw query errors.
    if (
      msg.includes('does not exist') ||
      msg.includes('column') && msg.includes('not') ||
      msg.includes('relation') && msg.includes('not') ||
      err.code === 'P2010' && msg.includes('column') ||
      err.code === 'P2010' && msg.includes('relation') ||
      err.code === 'P2021' || // table not found
      err.code === 'P2022'    // column not found
    ) {
      const safeErr = new Error(`Sorgu şeması uyumsuz: ${classifySchemaError(msg)}`);
      safeErr.code = 'AI_SQL_INVALID_SCHEMA';
      safeErr.executionTimeMs = executionTimeMs;
      safeErr.originalMessage = process.env.NODE_ENV === 'development' ? msg : undefined;
      throw safeErr;
    }

    // Priority 2: Actual timeout
    if (
      msg.includes('statement timeout') ||
      msg.includes('canceling statement due to statement timeout') ||
      (err.code === 'P2010' && msg.includes('timeout'))
    ) {
      const safeErr = new Error('Sorgu zaman aşımına uğradı. Lütfen daha dar bir soru sorun.');
      safeErr.code = 'AI_SQL_TIMEOUT';
      safeErr.executionTimeMs = executionTimeMs;
      throw safeErr;
    }

    // Priority 3: Syntax error
    if (
      msg.includes('syntax error') ||
      msg.includes('at or near')
    ) {
      const safeErr = new Error('SQL sözdizimi hatası. Lütfen sorunuzu farklı ifade edin.');
      safeErr.code = 'AI_SQL_EXECUTION_FAILED';
      safeErr.executionTimeMs = executionTimeMs;
      safeErr.originalMessage = process.env.NODE_ENV === 'development' ? msg : undefined;
      throw safeErr;
    }

    // Priority 4: Generic safe error
    const safeErr = new Error('SQL sorgusu çalıştırılamadı. Lütfen sorunuzu farklı ifade edin.');
    safeErr.code = 'AI_SQL_EXECUTION_FAILED';
    safeErr.executionTimeMs = executionTimeMs;
    safeErr.originalMessage = process.env.NODE_ENV === 'development' ? msg : undefined;
    throw safeErr;
  }
}

/**
 * Extract a human-readable schema error from the PostgreSQL error message.
 */
function classifySchemaError(msg) {
  // "column a.patient_id does not exist" → extract the column name
  const colMatch = msg.match(/column\s+["']?(\S+?)["']?\s+does\s+not\s+exist/i);
  if (colMatch) {
    return `Sütun bulunamadı: ${colMatch[1]}`;
  }

  // "relation X does not exist" → extract table name
  const relMatch = msg.match(/relation\s+["']?(\S+?)["']?\s+does\s+not\s+exist/i);
  if (relMatch) {
    return `Tablo bulunamadı: ${relMatch[1]}`;
  }

  return 'Bilinmeyen şema hatası';
}

module.exports = {
  executeSql,
  MAX_ROWS,
  STATEMENT_TIMEOUT_MS,
};
