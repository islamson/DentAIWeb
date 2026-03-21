/**
 * Scope Injector — Backend-enforced multi-tenant scoping.
 *
 * YENİ MİMARİ (Subquery Wrapping):
 * WHERE cümlelerini bozmamak ve UNION/CTE sorgularında çökmemek için,
 * FROM veya JOIN edilen fiziksel tablolar anında filtreli alt sorgulara çevrilir.
 * Örn: FROM appointments a -> FROM (SELECT * FROM appointments WHERE "organizationId" = $1) AS appointments a
 */

'use strict';

const { TABLES } = require('./schema-registry');

/**
 * Inject organizationId and branchId constraints into validated SQL.
 * Uses Parameterized Queries ($1, $2) to prevent SQL Injection.
 */
function injectScope(sql, ctx, startParamIndex = 1) {
  if (!sql || !ctx?.organizationId) {
    return { sql, params: [] };
  }

  let injectedSql = sql;
  const params = [];
  let paramIdx = startParamIndex;

  // Param 1: Organization ID
  params.push(ctx.organizationId);
  const orgParamIdx = paramIdx++;

  // Param 2: Branch ID (Opsiyonel)
  let branchParamIdx = null;
  if (ctx.branchId) {
    params.push(ctx.branchId);
    branchParamIdx = paramIdx++;
  }

  // Sadece şemada scope sütunları olan fiziksel tabloları sarıyoruz
  for (const [tableName, tableDef] of Object.entries(TABLES)) {
    const hasOrg = tableDef.columns.some(c => c.name === 'organizationId');
    if (!hasOrg) continue;

    const hasBranch = tableDef.columns.some(c => c.name === 'branchId');

    // Güvenli alt sorguyu oluştur (Sanal RLS)
    let scopedTable = `(SELECT * FROM ${tableName} WHERE "organizationId" = $${orgParamIdx}`;
    if (ctx.branchId && hasBranch) {
      scopedTable += ` AND ("branchId" = $${branchParamIdx} OR "branchId" IS NULL)`;
    }
    scopedTable += `) AS ${tableName}`;

    // Tablo adından sonra gelen isteğe bağlı "AS alias" veya sadece "alias" yapısını yakala
    const fromRegex = new RegExp(`\\bFROM\\s+["']?${tableName}["']?(?:\\s+(?:AS\\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?\\b`, 'gi');
    const joinRegex = new RegExp(`\\bJOIN\\s+["']?${tableName}["']?(?:\\s+(?:AS\\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?\\b`, 'gi');

    injectedSql = injectedSql.replace(fromRegex, (match, alias) => {
      return `FROM ${scopedTable} AS ${alias || tableName}`;
    });
    
    injectedSql = injectedSql.replace(joinRegex, (match, alias) => {
      return `JOIN ${scopedTable} AS ${alias || tableName}`;
    });
  }

  return {
    sql: injectedSql,
    params,
  };
}

module.exports = {
  injectScope,
};