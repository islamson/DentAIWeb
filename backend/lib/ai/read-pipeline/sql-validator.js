/**
 * SQL Validator — Schema-aware validation of LLM-generated SQL before execution.
 *
 * Validates:
 * - Structural safety (no DML/DDL, no SELECT *, no multi-statement)
 * - Schema correctness (table exists, columns exist, joins use real columns)
 * - Complexity limits (max JOINs, subqueries, length)
 * - Security (forbidden tables/columns, dangerous functions)
 * - Scope enforcement (organizationId present for scoped tables)
 */

'use strict';

const { FORBIDDEN_TABLES, FORBIDDEN_COLUMNS, isValidColumn, getAllColumnNames, getTable, getAllTableNames } = require('./schema-registry');

// ── Forbidden SQL operations ────────────────────────────────────────────────
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
  'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
  'MERGE', 'UPSERT', 'REPLACE',
];

const FORBIDDEN_KEYWORD_RE = new RegExp(
  `\\b(${FORBIDDEN_KEYWORDS.join('|')})\\b`, 'i'
);

// ── SELECT INTO detection ───────────────────────────────────────────────────
const SELECT_INTO_RE = /\bSELECT\b[\s\S]*?\bINTO\b/i;

// ── SELECT * detection ──────────────────────────────────────────────────────
const SELECT_STAR_RE = /\bSELECT\s+\*/i;

// ── Multi-statement detection ───────────────────────────────────────────────
function hasMultipleStatements(sql) {
  const trimmed = sql.replace(/;\s*$/, '').trim();
  return trimmed.includes(';');
}

// ── Comment detection ───────────────────────────────────────────────────────
const LINE_COMMENT_RE = /--/;
const BLOCK_COMMENT_RE = /\/\*/;

// ── Dangerous PostgreSQL functions ──────────────────────────────────────────
const DANGEROUS_FUNCTIONS = [
  'PG_READ_FILE', 'PG_READ_BINARY_FILE', 'PG_WRITE_FILE',
  'PG_SLEEP', 'PG_TERMINATE_BACKEND', 'PG_CANCEL_BACKEND',
  'PG_RELOAD_CONF', 'PG_ROTATE_LOGFILE',
  'LO_IMPORT', 'LO_EXPORT', 'LO_UNLINK',
  'COPY', 'DBLINK', 'DBLINK_EXEC',
  'SET', 'RESET', 'SHOW',
];

const DANGEROUS_FUNCTION_RE = new RegExp(
  `\\b(${DANGEROUS_FUNCTIONS.join('|')})\\s*\\(`, 'i'
);

// ── Complexity limits ───────────────────────────────────────────────────────
const MAX_JOINS = 6;
const MAX_SUBQUERIES = 3;
const MAX_SQL_LENGTH = 5000;

/**
 * Count occurrences of a pattern in SQL.
 */
function countOccurrences(sql, pattern) {
  const matches = sql.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Extract all table references from SQL (FROM and JOIN clauses).
 * Excludes FROM inside function calls (e.g. EXTRACT(HOUR FROM "startAt"))
 * by only matching at paren depth 0.
 */
function extractReferencedTables(sql) {
  const tables = new Set();
  let depth = 0;
  let i = 0;
  const s = sql;

  while (i < s.length) {
    const c = s[i];

    if (c === '(') {
      depth++;
      i++;
      continue;
    }
    if (c === ')') {
      depth--;
      i++;
      continue;
    }

    if (depth === 0) {
      const fromMatch = s.slice(i).match(/^\b(?:FROM|JOIN)\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/i);
      if (fromMatch) {
        const tableName = fromMatch[1].toLowerCase();
        tables.add(tableName);
        i += fromMatch[0].length;
        continue;
      }
    }

    i++;
  }

  return tables;
}

/**
 * Extract column references from SQL for schema-aware validation.
 * Finds patterns like: table."columnName" or alias."columnName" or "columnName"
 */
/**
 * Extract column references from SQL for schema-aware validation.
 * Finds patterns like: table."columnName" or "table"."columnName"
 */
function extractColumnReferences(sql) {
  const refs = [];

  // Geliştirilmiş Regex: İki tarafı tırnaklı olan "table"."column" formatını da yakalar
  const qualifiedRe = /(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?)\."([a-zA-Z_][a-zA-Z0-9_]*)"/g;
  let m;
  while ((m = qualifiedRe.exec(sql)) !== null) {
    refs.push({ tableOrAlias: m[1].toLowerCase(), column: m[2] });
  }

  return refs;
}

/**
 * Tırnak içindeki tüm tanımlayıcıları (identifier) yakalar (Tekil sütun halüsinasyonlarını yakalamak için)
 */
function extractAllQuotedIdentifiers(sql) {
  const identifiers = new Set();
  const re = /"([a-zA-Z_][a-zA-Z0-9_]*)"/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    identifiers.add(m[1]);
  }
  return identifiers;
}

/**
 * Check if SQL references forbidden columns for specific tables.
 */
function checkForbiddenColumns(sql) {
  const sqlLower = sql.toLowerCase();
  for (const [table, cols] of Object.entries(FORBIDDEN_COLUMNS)) {
    for (const col of cols) {
      // Check for table."column"
      if (new RegExp(`\\b${table}\\.["']?${col}["']?`, 'i').test(sql)) {
        return { forbidden: true, table, column: col };
      }
      // Check for "column" in SELECT clause when table is referenced
      const tables = extractReferencedTables(sql);
      if (tables.has(table)) {
        const selectMatch = sql.match(/\bSELECT\b([\s\S]*?)\bFROM\b/i);
        if (selectMatch && new RegExp(`["']?${col}["']?`, 'i').test(selectMatch[1])) {
          return { forbidden: true, table, column: col };
        }
      }
    }
  }
  return { forbidden: false };
}

/**
 * Check if non-aggregate SELECT queries have LIMIT.
 * Grouped aggregates (COUNT + GROUP BY) do NOT require LIMIT.
 */
function needsLimit(sql) {
  const hasAggregate = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(sql);
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(sql);
  const hasLimit = /\bLIMIT\b/i.test(sql);
  if (hasAggregate && hasGroupBy) return false;
  if (hasAggregate && !hasGroupBy) return false;
  return !hasLimit;
}

/**
 * Schema-aware validation: check that referenced tables and columns actually exist.
 * Returns { valid: boolean, errors: string[] }
 */
function validateSchemaReferences(sql) {
  const errors = [];
  const validTableNames = new Set(getAllTableNames().map(t => {
    const def = getTable(t);
    return def ? def.table : t;
  }));

  // Also add table keys (they're the same but sometimes lookups use keys)
  for (const t of getAllTableNames()) {
    validTableNames.add(t);
  }

  // Extract CTE names (WITH xxx AS (...)) — these are valid virtual tables
  const cteNames = new Set();
  const cteRe = /\bWITH\s+(\w+)\s+AS\s*\(/gi;
  let cteMatch;
  while ((cteMatch = cteRe.exec(sql)) !== null) {
    cteNames.add(cteMatch[1].toLowerCase());
  }

  const refTables = extractReferencedTables(sql);

  // Check tables exist (skip SQL keywords, CTE names, and known tables)
  const sqlKeywords = new Set(['select', 'from', 'where', 'join', 'on', 'and', 'or', 'not', 'in', 'as', 'group', 'by', 'order', 'limit', 'offset', 'having', 'union', 'inner', 'left', 'right', 'outer', 'cross', 'case', 'when', 'then', 'else', 'end', 'with', 'distinct', 'true', 'false', 'null']);
  for (const table of refTables) {
    if (sqlKeywords.has(table)) continue;
    if (cteNames.has(table)) continue; // CTE virtual table
    if (!validTableNames.has(table) && !FORBIDDEN_TABLES.has(table)) {
      errors.push(`Unknown table: "${table}"`);
    }
  }

  // Check column references when available
  const columnRefs = extractColumnReferences(sql);
  const tableToAlias = {};
  const aliasToTable = {};
  const aliasRe = /\b(?:FROM|JOIN)\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?\s+(?:AS\s+)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi;
  let am;
  while ((am = aliasRe.exec(sql)) !== null) {
    const t = am[1].toLowerCase();
    const a = am[2].toLowerCase();
    const kw = new Set(['on', 'where', 'inner', 'left', 'right', 'outer', 'cross', 'join', 'group', 'order', 'having', 'limit', 'offset', 'and', 'or', 'not', 'set']);
    if (!kw.has(a)) {
      tableToAlias[t] = am[2];
      aliasToTable[a] = t;
    }
  }

  for (const ref of columnRefs) {
    const refKey = ref.tableOrAlias.toLowerCase();
    const actualTable = aliasToTable[refKey] || refKey;
    
    // YENİ KONTROL: Tablo SQL içinde (FROM veya JOIN ile) gerçekten kullanılmış mı?
    if (!refTables.has(actualTable) && !cteNames.has(actualTable)) {
      errors.push(`Table "${actualTable}" is referenced but not included in FROM/JOIN clause.`);
      continue; // Hata ekledik, sonrakine geç
    }

    if (!validTableNames.has(actualTable)) continue; // skip unknown (already reported)
    if (!isValidColumn(actualTable, ref.column)) {
      errors.push(`Column "${ref.column}" does not exist on table "${actualTable}"`);
    }
  }

  // YENİ KONTROL: Tekil Halüsinasyonları (Örn: "product_name") yakalama
  const allQuoted = extractAllQuotedIdentifiers(sql);
  const joinedTables = Array.from(refTables).map(t => aliasToTable[t] || t).filter(t => validTableNames.has(t));
  
  for (const ident of allQuoted) {
    const lowerIdent = ident.toLowerCase();
    // Eğer bu kelime bir tablo adı, alias adı veya CTE adıysa güvenlidir, geç.
    if (validTableNames.has(lowerIdent) || aliasToTable[lowerIdent] || cteNames.has(lowerIdent)) continue;

    // Eğer bu kelime, JOIN edilen tablolardan en az birinde sütun olarak VARSA güvenlidir.
    let foundInAnyTable = false;
    for (const table of joinedTables) {
      if (isValidColumn(table, ident)) {
        foundInAnyTable = true;
        break;
      }
    }
    
    if (!foundInAnyTable) {
      errors.push(`Unknown identifier or hallucinated column: "${ident}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a SQL string. Returns validation result.
 *
 * @param {string} sql - SQL to validate
 * @param {Object} options - { schemaAware: boolean }
 * @returns {{ valid: boolean, reason?: string, code?: string }}
 */
function validateSql(sql, options = { schemaAware: true }) {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, reason: 'SQL is empty or not a string', code: 'AI_SQL_VALIDATION_FAILED' };
  }

  const trimmed = sql.trim();

  // 0. Length check
  if (trimmed.length > MAX_SQL_LENGTH) {
    return { valid: false, reason: `SQL exceeds maximum length (${MAX_SQL_LENGTH} chars)`, code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 1. Must start with SELECT (or WITH for CTEs)
  if (!/^\s*(SELECT|WITH)\b/i.test(trimmed)) {
    return { valid: false, reason: 'SQL must start with SELECT or WITH', code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 2. No DML/DDL keywords
  if (FORBIDDEN_KEYWORD_RE.test(trimmed)) {
    const match = trimmed.match(FORBIDDEN_KEYWORD_RE);
    return { valid: false, reason: `Forbidden keyword: ${match[1]}`, code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 3. No SELECT INTO
  if (SELECT_INTO_RE.test(trimmed)) {
    return { valid: false, reason: 'SELECT INTO is not allowed', code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 4. No SELECT *
  if (SELECT_STAR_RE.test(trimmed)) {
    return { valid: false, reason: 'SELECT * is not allowed — enumerate columns explicitly', code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 5. No multi-statement
  if (hasMultipleStatements(trimmed)) {
    return { valid: false, reason: 'Multiple statements not allowed — single SELECT only', code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 6. No comments
  if (LINE_COMMENT_RE.test(trimmed) || BLOCK_COMMENT_RE.test(trimmed)) {
    return { valid: false, reason: 'SQL comments are not allowed', code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 7. No dangerous functions
  if (DANGEROUS_FUNCTION_RE.test(trimmed)) {
    const match = trimmed.match(DANGEROUS_FUNCTION_RE);
    return { valid: false, reason: `Dangerous function: ${match[1]}`, code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 8. Forbidden tables
  const refTables = extractReferencedTables(trimmed);
  for (const table of refTables) {
    if (FORBIDDEN_TABLES.has(table)) {
      return { valid: false, reason: `Forbidden table: ${table}`, code: 'AI_SQL_VALIDATION_FAILED' };
    }
  }

  // 9. Forbidden columns
  const colCheck = checkForbiddenColumns(trimmed);
  if (colCheck.forbidden) {
    return { valid: false, reason: `Forbidden column: ${colCheck.table}.${colCheck.column}`, code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 10. LIMIT enforcement for row-returning queries
  if (needsLimit(trimmed)) {
    return { valid: false, reason: 'LIMIT is required for non-aggregate queries', code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 11. Join complexity
  const joinCount = countOccurrences(trimmed, /\bJOIN\b/gi);
  if (joinCount > MAX_JOINS) {
    return { valid: false, reason: `Too many JOINs: ${joinCount} (max ${MAX_JOINS})`, code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 12. Subquery complexity
  const subqueryCount = countOccurrences(trimmed, /\(\s*SELECT\b/gi);
  if (subqueryCount > MAX_SUBQUERIES) {
    return { valid: false, reason: `Too many subqueries: ${subqueryCount} (max ${MAX_SUBQUERIES})`, code: 'AI_SQL_VALIDATION_FAILED' };
  }

  // 13. Schema-aware validation (check tables/columns exist)
  if (options.schemaAware) {
    const schemaCheck = validateSchemaReferences(trimmed);
    if (!schemaCheck.valid) {
      return {
        valid: false,
        reason: `Schema mismatch: ${schemaCheck.errors.join('; ')}`,
        code: 'AI_SQL_INVALID_SCHEMA',
        schemaErrors: schemaCheck.errors,
      };
    }
  }

  return { valid: true };
}

/**
 * Attempt to repair SQL when validation fails.
 * Only repairs safe, non-semantic issues (e.g. add LIMIT).
 * Does NOT modify valid SQL or change semantics.
 */
function repairSql(sql, validationResult) {
  if (!sql || !validationResult) return sql;
  let repaired = sql.trim();

  if (validationResult.reason === 'LIMIT is required for non-aggregate queries') {
    if (!/\bLIMIT\b/i.test(repaired)) {
      repaired = repaired.replace(/\s*$/, '') + ' LIMIT 100';
    }
  }

  return repaired.trim();
}

module.exports = {
  validateSql,
  extractReferencedTables,
  extractColumnReferences,
  validateSchemaReferences,
  repairSql,
  needsLimit,
  FORBIDDEN_KEYWORDS,
  DANGEROUS_FUNCTIONS,
  MAX_JOINS,
  MAX_SUBQUERIES,
  MAX_SQL_LENGTH,
};
