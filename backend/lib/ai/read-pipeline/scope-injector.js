/**
 * Scope Injector — Backend-enforced multi-tenant scoping.
 *
 * Validated SQL içindeki fiziksel tabloları subquery ile wrap eder ve
 * organization / branch filtresini LLM'den bağımsız olarak zorlar.
 */

'use strict';

const { TABLES } = require('./schema-registry');

const CLAUSE_KEYWORDS = new Set([
  'WHERE',
  'JOIN',
  'LEFT',
  'RIGHT',
  'FULL',
  'INNER',
  'CROSS',
  'ON',
  'GROUP',
  'ORDER',
  'LIMIT',
  'HAVING',
  'UNION',
  'EXCEPT',
  'INTERSECT',
  'OFFSET',
  'USING',
]);

function buildScopedSubquery(tableName, tableDef, orgParamIdx, branchParamIdx, hasBranchScope) {
  const hasBranchColumn = tableDef.columns.some(c => c.name === 'branchId');

  let subquery = `SELECT * FROM ${tableName} WHERE "organizationId" = $${orgParamIdx}`;

  if (hasBranchScope && hasBranchColumn) {
    subquery += ` AND ("branchId" = $${branchParamIdx} OR "branchId" IS NULL)`;
  }

  return `(${subquery})`;
}

function buildTableRefRegex(tableName, keyword) {
  return new RegExp(
    `\\b${keyword}\\s+["']?${tableName}["']?(?:\\s+(?:AS\\s+)?([A-Za-z_][A-Za-z0-9_]*))?(?=\\s|,|\\)|$)`,
    'gi'
  );
}

function replaceTableRefs(sql, tableName, scopedSubquery, keyword) {
  const regex = buildTableRefRegex(tableName, keyword);

  return sql.replace(regex, (match, alias) => {
    if (alias) {
      const upper = String(alias).toUpperCase();

      // Gerçek alias değil de bir sonraki SQL clause kelimesi regex tarafından yutulduysa,
      // onu geri koy ve tablo alias'ını tableName olarak ekle.
      if (CLAUSE_KEYWORDS.has(upper)) {
        return `${keyword} ${scopedSubquery} ${tableName} ${alias}`;
      }

      return `${keyword} ${scopedSubquery} ${alias}`;
    }

    return `${keyword} ${scopedSubquery} ${tableName}`;
  });
}

function injectScope(sql, ctx, startParamIndex = 1) {
  if (!sql || !ctx?.organizationId) {
    return { sql, params: [] };
  }

  const params = [];
  let paramIdx = startParamIndex;

  params.push(ctx.organizationId);
  const orgParamIdx = paramIdx++;

  let branchParamIdx = null;
  if (ctx.branchId) {
    params.push(ctx.branchId);
    branchParamIdx = paramIdx++;
  }

  let injectedSql = sql;

  for (const [tableName, tableDef] of Object.entries(TABLES)) {
    const hasOrg = tableDef.columns.some(c => c.name === 'organizationId');
    if (!hasOrg) continue;

    const scopedSubquery = buildScopedSubquery(
      tableName,
      tableDef,
      orgParamIdx,
      branchParamIdx,
      Boolean(ctx.branchId)
    );

    injectedSql = replaceTableRefs(injectedSql, tableName, scopedSubquery, 'FROM');
    injectedSql = replaceTableRefs(injectedSql, tableName, scopedSubquery, 'JOIN');
  }

  return {
    sql: injectedSql,
    params,
  };
}

module.exports = {
  injectScope,
};