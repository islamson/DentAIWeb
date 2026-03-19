/**
 * Query Normalizer - Pre-classification text normalization.
 * Turkish variants, synonym mapping, punctuation cleanup.
 * Enables robust matching for clinic ERP questions.
 */

// Turkish / common typos: "bu gün" => "bugün", "buay" => "bu ay"
// Note: avoid \\b with Turkish chars (ü,ı,ğ,ş,ç,ö) - JS \\w doesn't include them
const TURKISH_NORMALIZATIONS = [
  [/\bbu\s+gün\b/gi, 'bugün'],
  [/bugünkü/gi, 'bugün'],
  [/bugünki/gi, 'bugün'],
  [/\bbuay\b/gi, 'bu ay'],
  [/\bbu\s+ay\b/gi, 'bu ay'],
  [/\bşimdiki\s+ay\b/gi, 'bu ay'],
  [/\bstoktaki\b/gi, 'stoktaki'],
  [/\bstokta\b/gi, 'stokta'],
  [/\bdüşük\s+stok\b/gi, 'düşük stok'],
  [/\bkaç\s+tane\b/gi, 'kaç'],
  [/\bne\s+kadar\b/gi, 'ne kadar'],
  [/\bkaç\s+adet\b/gi, 'kaç'],
  [/\brandevu\s+sayısı\b/gi, 'randevu sayısı'],
  [/\brandevu\s+sayisi\b/gi, 'randevu sayısı'],
];

// English -> Turkish for common clinic terms
const EN_TO_TR_SYNONYMS = {
  today: 'bugün',
  appointment: 'randevu',
  appointments: 'randevu',
  patient: 'hasta',
  patients: 'hasta',
  revenue: 'ciro',
  collection: 'tahsilat',
  collections: 'tahsilat',
  payment: 'ödeme',
  payments: 'ödeme',
  income: 'gelir',
  stock: 'stok',
  low: 'düşük',
  month: 'ay',
  monthly: 'aylık',
  count: 'sayı',
  number: 'sayı',
  how: 'kaç',
  many: 'kaç',
};

/**
 * Normalize query for classification.
 * @param {string} raw - Raw user message
 * @returns {{ normalized: string, raw: string }}
 */
function normalize(raw) {
  if (raw == null || typeof raw !== 'string') {
    return { normalized: '', raw: String(raw || '') };
  }

  let s = raw.trim();
  const original = s;

  // Lowercase for matching
  s = s.toLowerCase();

  // Remove excessive punctuation (keep apostrophe for Turkish possessive)
  s = s.replace(/[?!.,;:]+/g, ' ');

  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ');

  // Turkish normalizations
  for (const [pattern, replacement] of TURKISH_NORMALIZATIONS) {
    s = s.replace(pattern, replacement);
  }

  // English synonym expansion (append Turkish equivalent for matching)
  const words = s.split(/\s+/);
  const expanded = [];
  for (const w of words) {
    const key = w.toLowerCase().replace(/[^a-z0-9çğıöşü]/g, '');
    if (EN_TO_TR_SYNONYMS[key]) {
      expanded.push(w, EN_TO_TR_SYNONYMS[key]);
    } else {
      expanded.push(w);
    }
  }
  s = expanded.join(' ');

  // Final trim
  s = s.trim();

  return { normalized: s, raw: original };
}

module.exports = { normalize, EN_TO_TR_SYNONYMS, TURKISH_NORMALIZATIONS };
