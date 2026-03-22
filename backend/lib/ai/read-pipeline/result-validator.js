/**
 * Result Validator — Validates SQL result shape against the semantic read plan.
 */

'use strict';

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);

  if (typeof value === 'string') {
    const s = value.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) return n;
    }
  }

  if (value && typeof value === 'object') {
    if (typeof value.toNumber === 'function') {
      const n = value.toNumber();
      if (Number.isFinite(n)) return n;
    }

    if (value.constructor?.name === 'Decimal' && typeof value.toString === 'function') {
      const n = Number(value.toString());
      if (Number.isFinite(n)) return n;
    }
  }

  return null;
}

function findFirstNumericValue(row) {
  if (!row || typeof row !== 'object') return null;
  for (const val of Object.values(row)) {
    const n = toFiniteNumber(val);
    if (n != null) return n;
  }
  return null;
}

const SHAPE_VALIDATORS = {
  count: (rows) => {
    if (!rows || rows.length === 0) return { valid: true, shape: 'count', value: 0 };

    if (rows.length === 1) {
      const n = findFirstNumericValue(rows[0]);
      if (n != null) return { valid: true, shape: 'count', value: n };
    }

    if (rows.length === 1) {
      const row = rows[0];
      const countKey = Object.keys(row).find((k) =>
        k.toLowerCase().includes('count') || k.toLowerCase().includes('total')
      );
      if (countKey) {
        const n = toFiniteNumber(row[countKey]);
        if (n != null) return { valid: true, shape: 'count', value: n };
      }
    }

    return { valid: false, shape: 'count', reason: 'Count query should return a single numeric value' };
  },

  amount: (rows) => {
    if (!rows || rows.length === 0) return { valid: true, shape: 'amount', value: 0 };

    if (rows.length === 1) {
      const n = findFirstNumericValue(rows[0]);
      if (n != null) return { valid: true, shape: 'amount', value: n };
    }

    if (rows.length === 1) {
      const row = rows[0];
      const amountKey = Object.keys(row).find((k) =>
        k.toLowerCase().includes('sum') ||
        k.toLowerCase().includes('total') ||
        k.toLowerCase().includes('amount') ||
        k.toLowerCase().includes('revenue') ||
        k.toLowerCase().includes('collection') ||
        k.toLowerCase().includes('balance')
      );

      if (amountKey) {
        const n = toFiniteNumber(row[amountKey]);
        if (n != null) return { valid: true, shape: 'amount', value: n };
      }
    }

    return { valid: false, shape: 'amount', reason: 'Amount query should return a single numeric value' };
  },

  ratio: (rows) => {
    if (!rows || rows.length === 0) return { valid: true, shape: 'ratio', value: 0 };

    if (rows.length >= 1) {
      const row = rows[0];
      const hasNumeric = Object.values(row).some((v) => toFiniteNumber(v) != null);
      if (hasNumeric) return { valid: true, shape: 'ratio', rows };
    }

    return { valid: false, shape: 'ratio', reason: 'Ratio query should return numeric values' };
  },

  list: (rows) => {
    if (!rows) return { valid: false, shape: 'list', reason: 'No rows returned' };
    return { valid: true, shape: 'list', rows, rowCount: rows.length };
  },

  comparison: (rows) => {
    if (!rows || rows.length === 0) {
      return { valid: true, shape: 'comparison', rows: [], message: 'Karşılaştırma verisi bulunamadı.' };
    }

    const hasNumeric = rows.some((r) => Object.values(r).some((v) => toFiniteNumber(v) != null));
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
    return { valid: true, shape: 'summary', rows: rows || [], rowCount: (rows || []).length };
  },
};

function validateResult(rows, readPlan) {
  const expectedShape = readPlan?.queryType || 'summary';
  const validator = SHAPE_VALIDATORS[expectedShape] || SHAPE_VALIDATORS.summary;
  return validator(rows);
}

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