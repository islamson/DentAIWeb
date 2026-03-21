/**
 * Scope Injector — Backend-enforced multi-tenant scoping.
 *
 * Safer version:
 * - injects only at TOP-LEVEL WHERE / clause boundaries
 * - avoids corrupting subqueries by inserting into first nested WHERE
 * - skips LEFT/RIGHT/FULL joined tables in WHERE to avoid null-rejecting joins
 *
 * NOTE:
 * This is still not a full SQL AST injector, but it is much safer than the
 * previous regex-first implementation.
 */

'use strict';

const { getScopeColumns, getTable } = require('./schema-registry');
const { extractReferencedTables } = require('./sql-validator');

/**
 * Determine which top-level tables in the SQL need scope injection.
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
      needsBranch: scopeCols.includes('branchId'),
    };
  }

  return scopeMap;
}

/**
 * Find aliases used for top-level FROM/JOIN tables.
 * Returns { tableName: alias } map. Alias preserves original case.
 */
function findTableAliases(sql) {
  const aliases = {};
  const re = /\b(?:FROM|JOIN)\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?\s+(?:AS\s+)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi;
  let match;

  while ((match = re.exec(sql)) !== null) {
    const table = match[1].toLowerCase();
    const aliasRaw = match[2];
    const alias = aliasRaw.toLowerCase();

    const keywords = new Set([
      'on', 'where', 'inner', 'left', 'right', 'outer', 'cross',
      'join', 'group', 'order', 'having', 'limit', 'offset',
      'and', 'or', 'not', 'set'
    ]);

    if (!keywords.has(alias)) {
      aliases[table] = aliasRaw;
    }
  }

  return aliases;
}

/**
 * Quote identifier for PostgreSQL if it contains uppercase.
 */
function quoteIfNeeded(identifier) {
  if (!identifier || identifier === identifier.toLowerCase()) {
    return identifier;
  }
  return `"${identifier}"`;
}

/**
 * Find the index of a top-level SQL keyword (WHERE, GROUP BY, ORDER BY, etc.)
 * ignoring strings and nested parentheses.
 */
function findTopLevelKeywordIndex(sql, keywordRegex) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const prev = i > 0 ? sql[i - 1] : '';

    if (!inDouble && ch === '\'' && prev !== '\\') {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && ch === '"' && prev !== '\\') {
      inDouble = !inDouble;
      continue;
    }

    if (inSingle || inDouble) continue;

    if (ch === '(') {
      depth++;
      continue;
    }

    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0) {
      const slice = sql.slice(i);
      const m = slice.match(keywordRegex);
      if (m && m.index === 0) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Detect whether a top-level table is joined with LEFT/RIGHT/FULL OUTER semantics.
 * Such tables should NOT be scoped in WHERE because that null-rejects the join.
 */
function isOuterJoinedTable(sql, table, alias) {
  const names = [table, alias].filter(Boolean).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  for (const name of names) {
    const re = new RegExp(
      `\\b(?:LEFT|RIGHT|FULL)(?:\\s+OUTER)?\\s+JOIN\\s+["']?${name}["']?\\b`,
      'i'
    );
    if (re.test(sql)) return true;
  }

  return false;
}

/**
 * Inject organizationId / branchId constraints into TOP-LEVEL WHERE.
 *
 * Strategy:
 * - Only inject top-level scope conditions
 * - Skip OUTER JOIN tables from WHERE injection
 * - Never inject into nested subquery WHERE by accident
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

  const orgParamIdx = paramIdx;
  let orgParamUsed = false;

  for (const [table, scope] of Object.entries(scopeMap)) {
    if (!scope.needsOrg) continue;

    const alias = aliases[table];
    if (isOuterJoinedTable(sql, table, alias)) {
      continue;
    }

    const tableRef = alias || table;
    const quotedRef = quoteIfNeeded(tableRef);
    conditions.push(`${quotedRef}."organizationId" = $${orgParamIdx}`);
    orgParamUsed = true;
  }

  if (orgParamUsed) {
    params.push(ctx.organizationId);
    paramIdx++;
  }

  if (ctx.branchId) {
    const branchParamIdx = paramIdx;
    let branchParamUsed = false;

    for (const [table, scope] of Object.entries(scopeMap)) {
      if (!scope.needsBranch) continue;

      const alias = aliases[table];
      if (isOuterJoinedTable(sql, table, alias)) {
        continue;
      }

      const tableRef = alias || table;
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

  const scopeClause = conditions.join(' AND ');
  let injectedSql;

  const whereIdx = findTopLevelKeywordIndex(sql, /^WHERE\b/i);

  if (whereIdx >= 0) {
    injectedSql =
      sql.slice(0, whereIdx + 5) +
      ' ' + scopeClause + ' AND ' +
      sql.slice(whereIdx + 5).trimStart();
  } else {
    const candidates = [
      { re: /^GROUP\s+BY\b/i },
      { re: /^ORDER\s+BY\b/i },
      { re: /^LIMIT\b/i },
      { re: /^HAVING\b/i },
      { re: /^UNION\b/i },
    ];

    let insertIdx = sql.length;
    for (const c of candidates) {
      const idx = findTopLevelKeywordIndex(sql, c.re);
      if (idx >= 0 && idx < insertIdx) {
        insertIdx = idx;
      }
    }

    injectedSql =
      sql.slice(0, insertIdx).trimEnd() +
      '\nWHERE ' + scopeClause +
      (insertIdx < sql.length ? '\n' + sql.slice(insertIdx).trimStart() : '');
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
  findTopLevelKeywordIndex,
  isOuterJoinedTable,
};