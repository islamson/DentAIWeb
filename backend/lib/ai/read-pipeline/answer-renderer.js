/**
 * Answer Renderer — Final natural-language answer from SQL results.
 *
 * For simple shapes (count, amount): deterministic template rendering (no LLM).
 * For complex shapes (list, comparison, distribution): LLM synthesis using SQL rows.
 * Critical rule: the answer may ONLY reference values present in the SQL result.
 */

'use strict';

const { chat, isAvailable } = require('../ollama');

/**
 * Format currency from kuruş (cents) to TL.
 */
function formatCurrency(amountKurus) {
  if (amountKurus == null) return '₺0';
  const tl = amountKurus / 100;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(tl);
}

/**
 * Format a date for Turkish display.
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Format datetime for Turkish display.
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Determine if the query result contains currency amounts.
 */
function isCurrencyResult(readPlan, validation) {
  if (readPlan?.queryType === 'amount') return true;
  const metrics = readPlan?.requestedMetrics || [];
  return metrics.some(m =>
    m.includes('amount') || m.includes('revenue') || m.includes('collection') ||
    m.includes('payment') || m.includes('sum_amount') || m.includes('total') ||
    m.includes('balance') || m.includes('price')
  );
}

/**
 * Deterministic count answer.
 */
function renderCount(rows, readPlan) {
  const value = rows[0] ? Object.values(rows[0]).find(v => typeof v === 'number') : 0;
  const count = value ?? 0;

  const entities = readPlan?.targetEntities || [];
  const entityName = entities[0] || 'kayıt';

  // Turkish entity name mapping
  const nameMap = {
    appointments: 'randevu',
    patients: 'hasta',
    treatment_items: 'tedavi kalemi',
    treatment_plans: 'tedavi planı',
    invoices: 'fatura',
    payments: 'ödeme',
    inventory_items: 'stok kalemi',
    users: 'kullanıcı',
  };

  const label = nameMap[entityName] || entityName;
  return `Toplam **${count}** ${label} bulundu.`;
}

/**
 * Deterministic amount answer.
 */
function renderAmount(rows, readPlan) {
  const value = rows[0] ? Object.values(rows[0]).find(v => typeof v === 'number') : 0;
  const amount = value ?? 0;

  const metrics = readPlan?.requestedMetrics || [];
  const metric = metrics[0] || 'tutar';

  const metricLabels = {
    sum_amount: 'Toplam tutar',
    collection_amount: 'Toplam tahsilat',
    pending_collection_amount: 'Bekleyen tahsilat',
    revenue: 'Ciro',
    collection: 'Tahsilat',
    total_payment: 'Toplam ödeme',
    balance: 'Bakiye',
    outstanding: 'Bekleyen alacak',
  };

  const label = metricLabels[metric] || 'Toplam';
  return `${label}: **${formatCurrency(amount)}**`;
}

/**
 * Deterministic ratio answer.
 */
function renderRatio(rows, readPlan) {
  if (!rows || rows.length === 0) return 'Oran hesaplanamadı — veri bulunamadı.';

  if (rows.length > 1) {
    const numKey = Object.keys(rows[0]).find(k => typeof rows[0][k] === 'number');
    const labelKey = Object.keys(rows[0]).find(k => typeof rows[0][k] === 'string');

    if (numKey && labelKey) {
      const total = rows.reduce((s, r) => s + (r[numKey] || 0), 0);
      if (total > 0) {
        const parts = rows.map(r => {
          const pct = ((r[numKey] / total) * 100).toFixed(1);
          return `- **${r[labelKey]}**: ${r[numKey]} (%${pct})`;
        });
        return `Dağılım (toplam: ${total}):\n${parts.join('\n')}`;
      }
    }
  }

  const row = rows[0] || {};
  const ratioKey = Object.keys(row).find(k =>
    ['ratio', 'rate', 'percentage', 'pct', 'oran', 'yuzde'].some(token =>
      k.toLowerCase().includes(token)
    )
  );

  if (ratioKey && typeof row[ratioKey] === 'number') {
    return `Oran: **%${row[ratioKey].toFixed(1)}**`;
  }

  const numericValues = Object.values(row).filter(v => typeof v === 'number');
  if (numericValues.length === 1) {
    return `Oran: **%${numericValues[0].toFixed(1)}**`;
  }

  if ('count' in row || 'totalAmount' in row || 'total' in row) {
    return 'Oran hesaplanamadı. Sorgu oran yerine ham sayım/tutar verisi döndürdü.';
  }

  return 'Oran hesaplanamadı. Lütfen sorunuzu daha net ifade edin.';
}

/**
 * LLM-based answer for complex results (lists, comparisons, distributions).
 */
async function renderWithLlm(rows, readPlan, originalQuestion) {
  const available = await isAvailable();
  if (!available) {
    return renderFallbackTable(rows, readPlan);
  }

  // Limit rows sent to LLM
  const maxRows = 25;
  const displayRows = rows.slice(0, maxRows);
  const isCurrency = isCurrencyResult(readPlan);

  const systemPrompt = [
    'Sen bir diş kliniği ERP asistanısın. SQL sorgu sonucunu Türkçe doğal dilde özetle.',
    '',
    'Kurallar:',
    '1. SADECE verilen sonuç verilerinden bahset. Yorum veya tahmin YAPMA.',
    '2. Sayılar varsa onları bold yap (**123** gibi).',
    isCurrency ? '3. Para tutarları kuruş cinsindendir, TL ye çevir (100 ile böl). ₺ sembolü kullan.' : '',
    '4. Liste ise tablo veya madde işareti formatında göster.',
    '5. Tarihler varsa Türkçe formatla (ör. 15 Mart 2026).',
    '6. Profesyonel ve yardımcı bir ton kullan.',
    '7. Markdown formatı kullan.',
    rows.length > maxRows ? `8. Toplam ${rows.length} sonuç var, sadece ilk ${maxRows} tanesi gösterildi.` : '',
  ].filter(Boolean).join('\n');

  const userMsg = [
    `Kullanıcı sorusu: "${originalQuestion}"`,
    `Sorgu türü: ${readPlan?.queryType || 'bilinmiyor'}`,
    `Toplam sonuç sayısı: ${rows.length}`,
    '',
    'SQL sonucu (JSON):',
    JSON.stringify(displayRows, null, 2),
  ].join('\n');

  try {
    const { content } = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ]);
    return content;
  } catch {
    return renderFallbackTable(rows, readPlan);
  }
}

/**
 * Fallback table rendering when LLM is unavailable.
 */
function renderFallbackTable(rows, readPlan) {
  if (!rows || rows.length === 0) return 'Sonuç bulunamadı.';

  const isCurrency = isCurrencyResult(readPlan);
  const maxRows = 20;
  const displayRows = rows.slice(0, maxRows);
  const keys = Object.keys(displayRows[0]);

  // Build markdown table
  const header = '| ' + keys.join(' | ') + ' |';
  const separator = '| ' + keys.map(() => '---').join(' | ') + ' |';
  const bodyRows = displayRows.map(row => {
    const cells = keys.map(k => {
      let val = row[k];
      if (val == null) return '-';
      if (typeof val === 'number' && isCurrency && (
        k.toLowerCase().includes('amount') || k.toLowerCase().includes('total') ||
        k.toLowerCase().includes('price') || k.toLowerCase().includes('sum') ||
        k.toLowerCase().includes('revenue') || k.toLowerCase().includes('balance')
      )) {
        return formatCurrency(val);
      }
      if (typeof val === 'string' && /\d{4}-\d{2}-\d{2}T/.test(val)) {
        return formatDateTime(val);
      }
      return String(val);
    });
    return '| ' + cells.join(' | ') + ' |';
  });

  let result = [header, separator, ...bodyRows].join('\n');
  if (rows.length > maxRows) {
    result += `\n\n_...ve ${rows.length - maxRows} kayıt daha._`;
  }
  return result;
}

/**
 * Render final answer from SQL results.
 *
 * @param {Object} params
 * @param {Object[]} params.rows - SQL result rows
 * @param {Object} params.readPlan - semantic read plan
 * @param {Object} params.validation - result validation
 * @param {string} params.originalQuestion - user's original question
 * @returns {Promise<string>}
 */
async function renderAnswer({ rows, readPlan, validation, originalQuestion }) {
  const queryType = readPlan?.queryType || 'summary';
  const resultRows = rows || [];

  // Empty result
  if (resultRows.length === 0) {
    const entityMap = {
      appointments: 'randevu',
      patients: 'hasta',
      treatment_items: 'tedavi kalemi',
      invoices: 'fatura',
      payments: 'ödeme',
    };
    const entity = entityMap[readPlan?.targetEntities?.[0]] || 'kayıt';
    if (queryType === 'count') return `Toplam **0** ${entity} bulundu.`;
    if (queryType === 'amount') return `Toplam tutar: **${formatCurrency(0)}**`;
    return `Belirtilen kriterlere uygun ${entity} bulunamadı.`;
  }

  // Deterministic rendering for simple shapes
  switch (queryType) {
    case 'count':
      return renderCount(resultRows, readPlan);
    case 'amount':
      return renderAmount(resultRows, readPlan);
    case 'ratio':
      return renderRatio(resultRows, readPlan);
    default:
      // Complex shapes — use LLM
      return renderWithLlm(resultRows, readPlan, originalQuestion);
  }
}

module.exports = {
  renderAnswer,
  renderCount,
  renderAmount,
  renderRatio,
  renderFallbackTable,
  formatCurrency,
  formatDate,
  formatDateTime,
};
