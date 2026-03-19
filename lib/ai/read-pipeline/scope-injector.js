/**
 * Scope Injector — Backend-enforced multi-tenant scoping.
 *
 * After the SQL is validated, this module injects "organizationId" and "branchId"
 * constraints into the query using parameterized values ($1, $2, ...).
 *
 * The LLM is instructed NOT to add these; they are added server-side to
 * guarantee correct tenant isolation.
 *
 * CRITICAL: Column names are camelCase (Prisma convention), NOT snake_case.
 *   - "organizationId" not organization_id
 *   - "branchId" not branch_id
 */

'use strict';

const { getScopeColumns, getTable } = require('./schema-registry');
const { extractReferencedTables } = require('./sql-validator');

/**
 * Determine which tables in the SQL need scope injection.
 * Returns a map of { tableName: { needsOrg: bool, needsBranch: bool } }.
 */
function analyzeTablesForScoping(sql) {
  const tables = extractReferencedTables(sql);
  const scopeMap = {};

  for (const table of tables) {
    const scopeCols = getScopeColumns(table);
    if (scopeCols.length === 0) continue;

    scopeMap[table] = {
      needsOrg: scopeCols.includes('organizationId'),
      needsBranch: false, // branch_id check happens per-table below
    };
  }

  return scopeMap;
}

/**
 * Find aliases used for tables in the SQL.
 * Returns { tableName: alias } map. Alias is preserved with original case.
 */
function findTableAliases(sql) {
  const aliases = {};
  const re = /\b(?:FROM|JOIN)\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?\s+(?:AS\s+)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi;
  let match;
  while ((match = re.exec(sql)) !== null) {
    const table = match[1].toLowerCase();
    const aliasRaw = match[2];
    const alias = aliasRaw.toLowerCase();
    const keywords = new Set(['on', 'where', 'inner', 'left', 'right', 'outer', 'cross', 'join', 'group', 'order', 'having', 'limit', 'offset', 'and', 'or', 'not', 'set']);
    if (!keywords.has(alias)) {
      aliases[table] = aliasRaw;
    }
  }
  return aliases;
}

/**
 * Quote identifier for PostgreSQL if it contains uppercase (camelCase).
 * Unquoted identifiers are lowercased; quoted preserve case.
 */
function quoteIfNeeded(identifier) {
  if (!identifier || identifier === identifier.toLowerCase()) {
    return identifier;
  }
  return `"${identifier}"`;
}

/**
 * Inject organizationId and branchId constraints into validated SQL.
 *
 * Uses parameterized values ($1, $2, ...) — NEVER string interpolation.
 *
 * @param {string} sql - validated SQL (must have passed sql-validator)
 * @param {Object} ctx - request context { organizationId, branchId }
 * @param {number} startParamIndex - starting parameter index (default 1)
 * @returns {{ sql: string, params: any[] }}
 */
function injectScope(sql, ctx, startParamIndex = 1) {
  if (!sql || !ctx?.organizationId) {
    return { sql, params: [] };
  }

  const scopeMap = analyzeTablesForScoping(sql);
  const aliases = findTableAliases(sql);
  const params = [];
  let paramIdx = startParamIndex;
  const conditions = [];

  // Organization ID conditions — camelCase "organizationId"
  const orgParamIdx = paramIdx;
  let orgParamUsed = false;

  for (const [table, scope] of Object.entries(scopeMap)) {
    if (!scope.needsOrg) continue;
    const tableRef = aliases[table] || table;
    const quotedRef = quoteIfNeeded(tableRef);
    conditions.push(`${quotedRef}."organizationId" = $${orgParamIdx}`);
    orgParamUsed = true;
  }

  if (orgParamUsed) {
    params.push(ctx.organizationId);
    paramIdx++;
  }

  // Branch ID conditions (optional) — camelCase "branchId"
  if (ctx.branchId) {
    const branchParamIdx = paramIdx;
    let branchParamUsed = false;

    for (const [table] of Object.entries(scopeMap)) {
      const tableDef = getTable(table);
      if (!tableDef) continue;
      const hasBranch = tableDef.columns.some(c => c.name === 'branchId');
      if (!hasBranch) continue;

      const tableRef = aliases[table] || table;
      const quotedRef = quoteIfNeeded(tableRef);
      conditions.push(`(${quotedRef}."branchId" = $${branchParamIdx} OR ${quotedRef}."branchId" IS NULL)`);
      branchParamUsed = true;
    }

    if (branchParamUsed) {
      params.push(ctx.branchId);
      paramIdx++;
    }
  }

  if (conditions.length === 0) {
    return { sql, params: [] };
  }

  // Inject conditions into the SQL
  const scopeClause = conditions.join(' AND ');
  let injectedSql;

  // Check if there's already a WHERE clause
  const whereMatch = sql.match(/\bWHERE\b/i);
  if (whereMatch) {
    // Insert scope conditions right after WHERE
    const whereIdx = sql.search(/\bWHERE\b/i);
    injectedSql =
      sql.slice(0, whereIdx + 5) +
      ' ' + scopeClause + ' AND' +
      sql.slice(whereIdx + 5);
  } else {
    // Need to add WHERE clause before GROUP BY, ORDER BY, LIMIT, or end
    const insertPoints = [
      /\bGROUP\s+BY\b/i,
      /\bORDER\s+BY\b/i,
      /\bLIMIT\b/i,
      /\bHAVING\b/i,
      /\bUNION\b/i,
    ];

    let insertIdx = sql.length;
    for (const re of insertPoints) {
      const m = sql.search(re);
      if (m >= 0 && m < insertIdx) {
        insertIdx = m;
      }
    }

    injectedSql =
      sql.slice(0, insertIdx).trimEnd() +
      '\nWHERE ' + scopeClause +
      (insertIdx < sql.length ? '\n' + sql.slice(insertIdx) : '');
  }

  return {
    sql: injectedSql.trim(),
    params,
  };
}

module.exports = {
  injectScope,
  analyzeTablesForScoping,
  findTableAliases,
  quoteIfNeeded,
};
