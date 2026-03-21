/**
 * Scope Injector — Backend-enforced multi-tenant scoping.
 *
 * YENİ VE NİHAİ MİMARİ (Subquery Wrapping):
 * Regex facialarını engellemek için en temiz yaklaşım.
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

  // Şemadaki fiziksel tabloları dön
  for (const [tableName, tableDef] of Object.entries(TABLES)) {
    const hasOrg = tableDef.columns.some(c => c.name === 'organizationId');
    if (!hasOrg) continue;

    const hasBranch = tableDef.columns.some(c => c.name === 'branchId');

    // Alt sorgunun çekirdeğini hazırla
    let innerQuery = `SELECT * FROM ${tableName} WHERE "organizationId" = $${orgParamIdx}`;
    if (ctx.branchId && hasBranch) {
      innerQuery += ` AND ("branchId" = $${branchParamIdx} OR "branchId" IS NULL)`;
    }

    // NİHAİ REGEX (Basit, Aptal ve Yıkılmaz)
    // Sadece FROM veya JOIN kelimesinden sonra gelen tablo adını yakalar.
    // Arkasındaki alias'a, boşluğa, WHERE kelimesine ASLA DOKUNMAZ!
    const fromRegex = new RegExp(`(\\bFROM\\s+)["']?${tableName}["']?\\b`, 'gi');
    const joinRegex = new RegExp(`(\\bJOIN\\s+)["']?${tableName}["']?\\b`, 'gi');

    // Örn: LLM "FROM appointments a" yazdı.
    // Biz sadece "FROM appointments" kısmını alıp "FROM (SELECT ...) appointments" yapıyoruz.
    // Geri kalan " a" kısmı SQL'in orijinalinde zaten durduğu için Postgres bunu kendi kendine "alias" olarak anlıyor!
    injectedSql = injectedSql.replace(fromRegex, `$1(${innerQuery}) ${tableName}`);
    injectedSql = injectedSql.replace(joinRegex, `$1(${innerQuery}) ${tableName}`);
  }

  return {
    sql: injectedSql,
    params,
  };
}

module.exports = {
  injectScope,
};