/**
 * Result Validator — Validates SQL result shape against the semantic read plan.
 *
 * Ensures the SQL result matches what the user asked for (count, amount, list, etc.).
 * On mismatch, returns a safe fallback rather than passing bad data to the renderer.
 */

'use strict';

/**
 * Expected result shapes and their validation logic.
 */
const SHAPE_VALIDATORS = {
  count: (rows) => {
    if (!rows || rows.length === 0) return { valid: true, shape: 'count', value: 0 };
    if (rows.length === 1) {
      const values = Object.values(rows[0]);
      const numVal = values.find(v => typeof v === 'number');
      if (numVal !== undefined) return { valid: true, shape: 'count', value: numVal };
    }
    // Could still be valid if single row with count-like column
    if (rows.length === 1) {
      const row = rows[0];
      const countKey = Object.keys(row).find(k =>
        k.toLowerCase().includes('count') || k.toLowerCase().includes('total')
      );
      if (countKey && typeof row[countKey] === 'number') {
        return { valid: true, shape: 'count', value: row[countKey] };
      }
    }
    return { valid: false, shape: 'count', reason: 'Count query should return a single numeric value' };
  },

  amount: (rows) => {
    if (!rows || rows.length === 0) return { valid: true, shape: 'amount', value: 0 };
    if (rows.length === 1) {
      const values = Object.values(rows[0]);
      const numVal = values.find(v => typeof v === 'number');
      if (numVal !== undefined) return { valid: true, shape: 'amount', value: numVal };
    }
    if (rows.length === 1) {
      const row = rows[0];
      const amountKey = Object.keys(row).find(k =>
        k.toLowerCase().includes('sum') || k.toLowerCase().includes('total') ||
        k.toLowerCase().includes('amount') || k.toLowerCase().includes('revenue')
      );
      if (amountKey && typeof row[amountKey] === 'number') {
        return { valid: true, shape: 'amount', value: row[amountKey] };
      }
    }
    return { valid: false, shape: 'amount', reason: 'Amount query should return a single numeric value' };
  },

  ratio: (rows) => {
    if (!rows || rows.length === 0) return { valid: true, shape: 'ratio', value: 0 };
    // Single row with ratio/percentage
    if (rows.length >= 1) {
      const row = rows[0];
      const hasNumeric = Object.values(row).some(v => typeof v === 'number');
      if (hasNumeric) return { valid: true, shape: 'ratio', rows };
    }
    return { valid: false, shape: 'ratio', reason: 'Ratio query should return numeric values' };
  },

  list: (rows) => {
    if (!rows) return { valid: false, shape: 'list', reason: 'No rows returned' };
    // Empty list is valid
    return { valid: true, shape: 'list', rows, rowCount: rows.length };
  },

  comparison: (rows) => {
    if (!rows || rows.length === 0) {
      return { valid: true, shape: 'comparison', rows: [], message: 'Karşılaştırma verisi bulunamadı.' };
    }
    const hasNumeric = rows.some(r => Object.values(r).some(v => typeof v === 'number'));
    if (hasNumeric) return { valid: true, shape: 'comparison', rows };
    return { valid: false, shape: 'comparison', reason: 'Comparison query should contain numeric values' };
  },

  distribution: (rows) => {
    if (!rows || rows.length === 0) {
      return { valid: true, shape: 'distribution', rows: [], message: 'Dağılım verisi bulunamadı.' };
    }
    return { valid: true, shape: 'distribution', rows, rowCount: rows.length };
  },

  trend: (rows) => {
    if (!rows || rows.length === 0) {
      return { valid: true, shape: 'trend', rows: [], message: 'Trend verisi bulunamadı.' };
    }
    return { valid: true, shape: 'trend', rows, rowCount: rows.length };
  },

  summary: (rows) => {
    // Summary is the most flexible shape
    return { valid: true, shape: 'summary', rows: rows || [], rowCount: (rows || []).length };
  },
};

/**
 * Validate SQL result against the expected shape from the read plan.
 *
 * @param {Object[]} rows - SQL result rows
 * @param {Object} readPlan - semantic read plan
 * @returns {{ valid: boolean, shape: string, reason?: string, ... }}
 */
function validateResult(rows, readPlan) {
  const expectedShape = readPlan?.queryType || 'summary';
  const validator = SHAPE_VALIDATORS[expectedShape] || SHAPE_VALIDATORS.summary;
  return validator(rows);
}

/**
 * Get a safe fallback message when validation fails.
 */
function getFallbackMessage(validation, readPlan) {
  const shape = validation.shape || readPlan?.queryType || 'unknown';
  const reason = validation.reason || 'bilinmeyen hata';

  const messages = {
    count: 'Sayısal sonuç bekleniyordu ancak farklı bir sonuç döndü. Lütfen sorunuzu tekrar deneyin.',
    amount: 'Tutar sonucu bekleniyordu ancak farklı bir sonuç döndü. Lütfen sorunuzu tekrar deneyin.',
    ratio: 'Oran/yüzde sonucu bekleniyordu ancak farklı bir sonuç döndü. Lütfen sorunuzu tekrar deneyin.',
    list: 'Liste sonucu bekleniyordu ancak veri bulunamadı.',
    comparison: 'Karşılaştırma verisi bekleniyordu ancak farklı bir sonuç döndü.',
    distribution: 'Dağılım verisi bekleniyordu ancak farklı bir sonuç döndü.',
    trend: 'Trend verisi bekleniyordu ancak farklı bir sonuç döndü.',
  };

  return messages[shape] || `Sonuç doğrulanamadı: ${reason}`;
}

module.exports = {
  validateResult,
  getFallbackMessage,
  SHAPE_VALIDATORS,
};
