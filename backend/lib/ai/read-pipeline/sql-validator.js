/**
 * SQL Validator — Schema-aware validation of LLM-generated SQL before execution.
 */

'use strict';

const { FORBIDDEN_TABLES, FORBIDDEN_COLUMNS, isValidColumn, getAllTableNames } = require('./schema-registry');

const FORBIDDEN_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'MERGE', 'UPSERT', 'REPLACE'];
const FORBIDDEN_KEYWORD_RE = new RegExp(`\\b(${FORBIDDEN_KEYWORDS.join('|')})\\b`, 'i');
const SELECT_INTO_RE = /\bSELECT\b[\s\S]*?\bINTO\b/i;
const SELECT_STAR_RE = /\bSELECT\s+\*/i;
const LINE_COMMENT_RE = /--/;
const BLOCK_COMMENT_RE = /\/\*/;

const DANGEROUS_FUNCTIONS = ['PG_READ_FILE', 'PG_READ_BINARY_FILE', 'PG_WRITE_FILE', 'PG_SLEEP', 'PG_TERMINATE_BACKEND', 'PG_CANCEL_BACKEND', 'PG_RELOAD_CONF', 'PG_ROTATE_LOGFILE', 'LO_IMPORT', 'LO_EXPORT', 'LO_UNLINK', 'COPY', 'DBLINK', 'DBLINK_EXEC', 'SET', 'RESET', 'SHOW'];
const DANGEROUS_FUNCTION_RE = new RegExp(`\\b(${DANGEROUS_FUNCTIONS.join('|')})\\s*\\(`, 'i');

const MAX_JOINS = 15;
const MAX_SUBQUERIES = 8;
const MAX_SQL_LENGTH = 10000;

function hasMultipleStatements(sql) {
  return sql.replace(/;\s*$/, '').trim().includes(';');
}

function countOccurrences(sql, pattern) {
  const matches = sql.match(pattern);
  return matches ? matches.length : 0;
}

function extractReferencedTables(sql) {
  const tables = new Set();
  const fromJoinRe = /\b(?:FROM|JOIN)\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi;
  let match;
  while ((match = fromJoinRe.exec(sql)) !== null) {
    tables.add(match[1].toLowerCase());
  }
  return tables;
}

function extractSelectAliases(sql) {
  const aliases = new Set();
  const asRegex = /\bAS\s+["']?([a-zA-Z0-9_]+)["']?/gi;
  let match;
  while ((match = asRegex.exec(sql)) !== null) {
    if (match[1]) aliases.add(match[1].toLowerCase());
  }
  return aliases;
}

function extractAllQuotedIdentifiers(sql) {
  const identifiers = new Set();
  const re = /"([a-zA-Z_][a-zA-Z0-9_]*)"/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    identifiers.add(m[1]);
  }
  return identifiers;
}

function checkForbiddenColumns(sql) {
  for (const [table, cols] of Object.entries(FORBIDDEN_COLUMNS)) {
    for (const col of cols) {
      if (new RegExp(`\\b${table}\\.["']?${col}["']?`, 'i').test(sql)) return { forbidden: true, table, column: col };
    }
  }
  return { forbidden: false };
}

function needsLimit(sql) {
  const hasAggregate = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(sql);
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(sql);
  const hasLimit = /\bLIMIT\b/i.test(sql);
  if (hasAggregate && hasGroupBy) return false;
  if (hasAggregate && !hasGroupBy) return false;
  return !hasLimit;
}

function validateSchemaReferences(sql) {
  const errors = [];
  const validTableNames = new Set(getAllTableNames());
  const refTables = extractReferencedTables(sql);

  // Sadece açıkça tablo."sütun" şeklinde yazılmış kullanımları sıkı kontrol et.
  // Bu sayede Alias (AS) ve CTE kullanımları "halüsinasyon" olarak değerlendirilmez.
  const qualifiedRe = /(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?)\."([a-zA-Z_][a-zA-Z0-9_]*)"/g;
  let m;
  while ((m = qualifiedRe.exec(sql)) !== null) {
    const tableOrAlias = m[1].toLowerCase();
    const column = m[2];
    
    if (validTableNames.has(tableOrAlias)) {
      if (!isValidColumn(tableOrAlias, column)) {
        errors.push(`Column "${column}" does not exist on table "${tableOrAlias}"`);
      }
    }
  }

  // Quoted identifier'ların AS takma adı olup olmadığını kontrol et
  const allQuoted = extractAllQuotedIdentifiers(sql);
  const selectAliases = extractSelectAliases(sql);

  for (const ident of allQuoted) {
    const lowerIdent = ident.toLowerCase();
    // Eğer bu bir AS takma adıysa (Örn: AS "patientName"), kesinlikle güvenlidir.
    if (selectAliases.has(lowerIdent)) continue;
    // Eğer tablo ismiyse, güvenlidir.
    if (validTableNames.has(lowerIdent)) continue;

    // Diğer tekil kullanımlar için esnek davranıyoruz (CTE isimleri olabileceği için sistemi çökertmiyoruz).
  }

  return { valid: errors.length === 0, errors };
}

function validateSql(sql, options = { schemaAware: true }) {
  if (!sql) return { valid: false, reason: 'SQL is empty', code: 'AI_SQL_VALIDATION_FAILED' };
  const trimmed = sql.trim();

  if (trimmed.length > MAX_SQL_LENGTH) return { valid: false, reason: 'SQL exceeds maximum length', code: 'AI_SQL_VALIDATION_FAILED' };
  if (!/^\s*(SELECT|WITH)\b/i.test(trimmed)) return { valid: false, reason: 'SQL must start with SELECT or WITH', code: 'AI_SQL_VALIDATION_FAILED' };
  if (FORBIDDEN_KEYWORD_RE.test(trimmed)) return { valid: false, reason: 'Forbidden keyword detected', code: 'AI_SQL_VALIDATION_FAILED' };
  if (SELECT_INTO_RE.test(trimmed)) return { valid: false, reason: 'SELECT INTO is not allowed', code: 'AI_SQL_VALIDATION_FAILED' };
  if (SELECT_STAR_RE.test(trimmed)) return { valid: false, reason: 'SELECT * is not allowed', code: 'AI_SQL_VALIDATION_FAILED' };
  if (hasMultipleStatements(trimmed)) return { valid: false, reason: 'Multiple statements not allowed', code: 'AI_SQL_VALIDATION_FAILED' };
  if (LINE_COMMENT_RE.test(trimmed) || BLOCK_COMMENT_RE.test(trimmed)) return { valid: false, reason: 'SQL comments are not allowed', code: 'AI_SQL_VALIDATION_FAILED' };
  if (DANGEROUS_FUNCTION_RE.test(trimmed)) return { valid: false, reason: 'Dangerous function detected', code: 'AI_SQL_VALIDATION_FAILED' };

  for (const table of extractReferencedTables(trimmed)) {
    if (FORBIDDEN_TABLES.has(table)) return { valid: false, reason: `Forbidden table: ${table}`, code: 'AI_SQL_VALIDATION_FAILED' };
  }

  const colCheck = checkForbiddenColumns(trimmed);
  if (colCheck.forbidden) return { valid: false, reason: `Forbidden column: ${colCheck.table}.${colCheck.column}`, code: 'AI_SQL_VALIDATION_FAILED' };
  if (needsLimit(trimmed)) return { valid: false, reason: 'LIMIT is required for non-aggregate queries', code: 'AI_SQL_VALIDATION_FAILED' };
  if (countOccurrences(trimmed, /\bJOIN\b/gi) > MAX_JOINS) return { valid: false, reason: `Too many JOINs`, code: 'AI_SQL_VALIDATION_FAILED' };
  if (countOccurrences(trimmed, /\(\s*SELECT\b/gi) > MAX_SUBQUERIES) return { valid: false, reason: `Too many subqueries`, code: 'AI_SQL_VALIDATION_FAILED' };

  if (options.schemaAware) {
    const schemaCheck = validateSchemaReferences(trimmed);
    if (!schemaCheck.valid) {
      return { valid: false, reason: `Schema mismatch: ${schemaCheck.errors.join('; ')}`, code: 'AI_SQL_INVALID_SCHEMA', schemaErrors: schemaCheck.errors };
    }
  }

  return { valid: true };
}

function repairSql(sql, validationResult) {
  if (!sql || !validationResult) return sql;
  let repaired = sql.trim();
  if (validationResult.reason === 'LIMIT is required for non-aggregate queries' && !/\bLIMIT\b/i.test(repaired)) {
    repaired = repaired.replace(/\s*$/, '') + ' LIMIT 50';
  }
  return repaired.trim();
}

module.exports = { validateSql, extractReferencedTables, validateSchemaReferences, repairSql, needsLimit };