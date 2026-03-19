/**
 * @deprecated Use llm-query-planner + business-ontology getDeterministicPlan instead.
 * Phase 1 deterministic planner/router.
 * Analyzes message, selects intent, extracts params.
 * Supports history + memory for follow-up questions.
 * No LLM - keyword matching and safe fallbacks.
 */

const PATIENT_FOLLOWUP_KEYWORDS = [
  'ne kadar borcu', 'borcu var', 'borcu ne kadar', 'kalan borç', 'toplam borç',
  'kalan bakiye', 'kalan bakiyesi', 'açık borcu ne kadar',
  'özetini göster', 'özeti ne', 'son randevusu', 'son randevu ne zaman',
  'son ödemesi ne kadar', 'ne kadardı', 'borç durumu',
  'finansal geçmiş', 'gelecek randevular', 'telefonu', 'e-posta', 'son tedavi',
];
const DOCTOR_FOLLOWUP_KEYWORDS = ['programı ne', 'bugünkü programı', 'programı nedir'];
const CURRENT_ACCOUNT_FOLLOWUP_KEYWORDS = [
  'peki borcu', 'borcu ne', 'borcu ne kadar', 'alacağı var mı', 'alacak ne',
  'son işlem', 'son hareket', 'son hareket ne', 'detay ver', 'özetle',
  'bu cari', 'bu hesap', 'bu cari ile', 'tüm işlemleri özetle',
  'açık ne kadar', 'borç mu fazla', 'alacak mı', 'geçen ay durum',
  'ne kadar borcumuz', 'borcumuz var', 'son ödeme', 'bakiyesi ne', 'cari bakiye',
];

/**
 * Extract patient name from Turkish possessive patterns:
 * "Ahmet Yılmaz'ın son ödemesi" -> "Ahmet Yılmaz"
 * "Mehmet'in özeti" -> "Mehmet"
 * Supports both typographic (') and ASCII (') apostrophe.
 */
function extractPatientName(msg) {
  const trimmed = msg.trim();
  // Turkish possessive: X'ın, X'in, X'un, X'ün (apostrophe: ' or ')
  const possessiveMatch = trimmed.match(/^(.+?)[''](?:nın|nin|nun|nün|ın|in|un|ün)\s/i);
  if (possessiveMatch) return possessiveMatch[1].trim();

  // "X için", "X hastası", "X hasta özeti"
  const icinMatch = trimmed.match(/(.+?)\s+(?:için|hastası|hastasının|hasta\s+özet)/i);
  if (icinMatch) return icinMatch[1].trim();

  return null;
}

/**
 * Extract search query after "ara", "bul", "listele"
 */
function extractSearchQuery(msg) {
  const trimmed = msg.trim();
  const araMatch = trimmed.match(/(?:hasta\s+)?(?:ara|bul|listele|sorgula)\s+(.+)/i);
  if (araMatch) return araMatch[1].trim();

  const hastaMatch = trimmed.match(/(?:hangi\s+)?hastalar?\s+(.+)/i);
  if (hastaMatch) return hastaMatch[1].trim();

  return null;
}

/**
 * Extract current account / supplier name from Turkish patterns:
 * "ABS Medikal firmasına yapılan son ödeme" -> "ABS Medikal"
 * "X firmasına borcumuz", "X cari hesabının bakiyesi", "Deneme cari hesabı"
 */
function extractCurrentAccountName(msg) {
  const trimmed = msg.trim();
  // "X firmasına", "X firmaya", "X firması"
  const firmaMatch = trimmed.match(/(.+?)\s+firmas?(?:ına|aya|ı)\s/i);
  if (firmaMatch) return firmaMatch[1].trim();

  // "X cari hesabı", "X cari hesabının", "X cari hesabının bakiyesi"
  const cariHesapMatch = trimmed.match(/(.+?)\s+cari\s+hesab(?:ı|ının)\s/i);
  if (cariHesapMatch) return cariHesapMatch[1].trim();

  // "X tedarikçiye", "X tedarikçisine"
  const tedarikMatch = trimmed.match(/(.+?)\s+tedarikçi(?:ye|sine)?\s/i);
  if (tedarikMatch) return tedarikMatch[1].trim();

  // "X laboratuvarına", "X laboratuvara"
  const labMatch = trimmed.match(/(.+?)\s+laboratuvar(?:ına|a)?\s/i);
  if (labMatch) return labMatch[1].trim();

  // "X şirketine", "X şirkete"
  const sirketMatch = trimmed.match(/(.+?)\s+şirket(?:ine|e)?\s/i);
  if (sirketMatch) return sirketMatch[1].trim();

  // "X medikal", "X medikale" (company name + medikal)
  const medikalMatch = trimmed.match(/(.+?)\s+medikal(?:\s|e|a|i)/i);
  if (medikalMatch) return medikalMatch[1].trim();

  return null;
}

/**
 * Extract date hint from message: "yarın", "bu hafta", "bugün"
 */
function extractDateHint(msg) {
  const trimmed = (msg || '').trim().toLowerCase();
  if (trimmed.includes('yarın') || trimmed.includes('yarin')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (trimmed.includes('bu hafta') || trimmed.includes('haftalık') || trimmed.includes('haftalik')) {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Extract product/inventory item name from message
 */
function extractProductQuery(msg) {
  const trimmed = msg.trim();
  const patterns = [
    /(?:ürün|stok|malzeme)\s+(.+?)(?:\s+(?:miktarı|adeti|kaç|ne kadar)|$)/i,
    /(.+?)\s+(?:ürünün|stoktaki|stok)\s+(?:miktarı|adeti|kaç)/i,
    /(?:kaç\s+)?(.+?)\s+(?:var|kaldı|kaldi)/i,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m && m[1] && m[1].trim().length >= 2) return m[1].trim();
  }
  return null;
}

/**
 * Extract doctor name from "doktor X", "Dr. X programı", "Dr. Ayşe Demir'in bugünkü programı"
 */
function extractDoctorName(msg) {
  const trimmed = msg.trim();
  // "Dr. Ayşe Demir'in bugünkü programı" -> "Ayşe Demir"
  const drPossessiveMatch = trimmed.match(/Dr\.?\s+(.+?)[''](?:ın|in|un|ün)\s+(?:bugünkü\s+)?program/i);
  if (drPossessiveMatch) return drPossessiveMatch[1].trim();

  const doktorMatch = trimmed.match(/doktor\s+(.+?)(?:\s+(?:için|programı|takvimi))?$/i);
  if (doktorMatch) return doktorMatch[1].trim();

  const drMatch = trimmed.match(/Dr\.?\s+(.+?)(?=\s+programı|\s+takvimi|\s+için|$)/i);
  if (drMatch) return drMatch[1].trim();

  const programMatch = trimmed.match(/(.+?)[''](?:ın|in|un|ün)\s+program/i);
  if (programMatch) return programMatch[1].trim();

  return null;
}

/**
 * Intent definitions: keywords, tool, param extractor
 */
const INTENTS = [
  {
    id: 'patient_search',
    tool: 'search_patient',
    keywords: [
      'hasta ara', 'hasta bul', 'hasta listele', 'hasta sorgula',
      'hangi hasta', 'hastalar', 'hasta adı', 'hasta ismi',
      'kim var', 'kayıtlı hasta',
    ],
    extractParams: (msg, memory) => {
      const query = extractSearchQuery(msg) || extractPatientName(msg) || '';
      return { query, limit: 10 };
    },
    needsParam: (p) => !p.query || p.query.length < 2,
    clarification: 'Hangi hasta veya arama terimini kullanmak istiyorsunuz?',
  },
  {
    id: 'patient_summary',
    tool: 'get_patient_summary',
    keywords: [
      'hasta özeti', 'hasta bilgisi', 'hasta detayı', 'hasta bilgileri',
      'hastanın özeti', 'hastanın bilgisi', 'özetini göster', 'özeti ne',
      'son randevu', 'son randevusu', 'son randevusu ne zaman',
    ],
    extractParams: (msg, memory) => {
      const name = extractPatientName(msg);
      // Explicit entity > memory: only use memory when no explicit name in message
      return { patientQuery: name, patientId: name ? null : memory?.lastReferencedPatientId };
    },
    needsParam: (p) => !p.patientQuery && !p.patientId,
    clarification: 'Hangi hastayı kastettiğinizi belirtir misiniz?',
  },
  {
    id: 'patient_last_payment',
    tool: 'get_patient_last_payment',
    keywords: [
      'son ödeme', 'ödemesi ne zaman', 'ne zaman ödedi', 'son ödemesi',
      'ödeme tarihi', 'en son ödeme', 'son tahsilat',
    ],
    extractParams: (msg, memory) => {
      const name = extractPatientName(msg);
      return { patientQuery: name, patientId: name ? null : memory?.lastReferencedPatientId };
    },
    needsParam: (p) => !p.patientQuery && !p.patientId,
    clarification: 'Hangi hastanın son ödemesini görmek istiyorsunuz?',
  },
  {
    id: 'patient_balance',
    tool: 'get_patient_balance',
    keywords: [
      'ne kadar borcu', 'borcu var', 'borcu ne kadar', 'kalan borç',
      'toplam borç', 'borç durumu', 'açık borç', 'açık borcu ne kadar',
      'kalan bakiye', 'kalan bakiyesi', 'bakiyesi ne kadar',
    ],
    extractParams: (msg, memory) => {
      const name = extractPatientName(msg);
      return { patientQuery: name, patientId: name ? null : memory?.lastReferencedPatientId };
    },
    needsParam: (p) => !p.patientQuery && !p.patientId,
    clarification: 'Hangi hastanın bakiyesini görmek istiyorsunuz?',
  },
  {
    id: 'patient_financial_history',
    tool: 'get_patient_financial_history',
    keywords: ['finansal geçmiş', 'finansal hareket', 'ödeme geçmişi', 'hareket geçmişi', 'finansal özet'],
    extractParams: (msg, memory) => {
      const name = extractPatientName(msg);
      return { patientQuery: name, patientId: name ? null : memory?.lastReferencedPatientId };
    },
    needsParam: (p) => !p.patientQuery && !p.patientId,
    clarification: 'Hangi hastanın finansal geçmişini görmek istiyorsunuz?',
  },
  {
    id: 'patient_upcoming_appointments',
    tool: 'get_patient_upcoming_appointments',
    keywords: ['gelecek randevular', 'gelecek randevusu', 'yaklaşan randevu', 'sonraki randevu'],
    extractParams: (msg, memory) => {
      const name = extractPatientName(msg);
      return { patientQuery: name, patientId: name ? null : memory?.lastReferencedPatientId };
    },
    needsParam: (p) => !p.patientQuery && !p.patientId,
    clarification: 'Hangi hastanın gelecek randevularını görmek istiyorsunuz?',
  },
  {
    id: 'patient_contact',
    tool: 'get_patient_contact',
    keywords: ['telefon numarası', 'telefonu ne', 'e-posta', 'email', 'iletişim', 'ulaşım'],
    extractParams: (msg, memory) => {
      const name = extractPatientName(msg);
      return { patientQuery: name, patientId: name ? null : memory?.lastReferencedPatientId };
    },
    needsParam: (p) => !p.patientQuery && !p.patientId,
    clarification: 'Hangi hastanın iletişim bilgisini görmek istiyorsunuz?',
  },
  {
    id: 'patient_last_treatment',
    tool: 'get_patient_last_treatment',
    keywords: ['son tedavi', 'son tedavisi', 'en son tedavi', 'tedavi geçmişi'],
    extractParams: (msg, memory) => {
      const name = extractPatientName(msg);
      return { patientQuery: name, patientId: name ? null : memory?.lastReferencedPatientId };
    },
    needsParam: (p) => !p.patientQuery && !p.patientId,
    clarification: 'Hangi hastanın son tedavisini görmek istiyorsunuz?',
  },
  {
    id: 'monthly_finance',
    tool: 'get_monthly_finance_summary',
    keywords: [
      'bu ay', 'bu ayki', 'ayki toplam', 'toplam cirosu', 'ciro',
      'bu ay toplam', 'bu ayki tahsilat', 'bu ayki gelir',
      'bu ay ne kadar ödeme', 'bu ay ödeme aldık', 'aylık gelir',
      'kliniğin bu ayki', 'toplam ödeme', 'tahsilat ne kadar',
      'gelir ne kadar', 'ödeme aldık',
    ],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  {
    id: 'weekly_finance',
    tool: 'get_weekly_finance_summary',
    keywords: ['bu hafta', 'haftalık ciro', 'haftalik ciro', 'haftalık tahsilat', 'bu hafta toplam'],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  {
    id: 'payments_today',
    tool: 'get_payments_today',
    keywords: ['bugün ne kadar ödeme', 'bugün ödeme aldık', 'bugün tahsilat', 'bugün alınan ödeme', 'bugünkü tahsilat'],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  {
    id: 'today_appointments',
    tool: 'get_today_appointments',
    keywords: [
      'bugünkü randevular', 'bugünkü randevuları', 'bugün randevu', 'bugünün randevuları',
      'bugün kaç randevu', 'günün randevuları', 'randevu listesi bugün', 'randevuları göster',
    ],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  {
    id: 'appointments_noshow',
    tool: 'get_appointments_noshow',
    keywords: ['gelmedi', 'gelmeyen', 'noshow', 'no-show', 'randevuya gelmeyen', 'iptal gelmedi'],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  {
    id: 'appointments_cancelled',
    tool: 'get_appointments_cancelled',
    keywords: ['iptal edilen', 'iptal randevular', 'iptal listesi', 'cancel', 'iptal olan'],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  {
    id: 'doctor_schedule',
    tool: 'get_doctor_schedule',
    keywords: [
      'doktor programı', 'doktor takvimi', 'doktorun programı',
      'doktorun randevuları', 'hangi doktor', 'doktorun günü',
      'programı bugün', 'programı nedir', 'programı ne', 'bugünkü programı',
    ],
    extractParams: (msg, memory) => {
      const doctorName = extractDoctorName(msg);
      return {
        doctorQuery: doctorName,
        doctorId: doctorName ? null : memory?.lastReferencedDoctorId,
        date: extractDateHint(msg),
      };
    },
    needsParam: (p) => !p.doctorQuery && !p.doctorId,
    clarification: 'Hangi doktor için programı görmek istiyorsunuz?',
  },
  {
    id: 'debtors_summary',
    tool: 'get_debtors_summary',
    keywords: [
      'borçlular', 'borçlu hastalar', 'borçlu hastaları', 'hastaları özetle',
      'açık faturalar', 'ödenmemiş faturalar', 'borç özeti', 'cari borç',
    ],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  // Current account / supplier intents - must match before patient when message indicates firma/tedarikçi
  {
    id: 'current_account_last_payment',
    tool: 'get_current_account_last_payment',
    keywords: [
      'firmasına yapılan son ödeme', 'firmaya yapılan son ödeme', 'firmasına son ödeme',
      'tedarikçiye yapılan ödeme', 'tedarikçiye son ödeme', 'firmaya ne zaman ödeme',
      'cari hesaba son ödeme', 'şirkete yapılan son ödeme', 'laboratuvara son ödeme',
    ],
    extractParams: (msg, memory) => {
      const name = extractCurrentAccountName(msg);
      return { currentAccountQuery: name, currentAccountId: name ? null : memory?.lastReferencedCurrentAccountId };
    },
    needsParam: (p) => !p.currentAccountQuery && !p.currentAccountId,
    clarification: 'Hangi cari hesap veya firma için bilgi istiyorsunuz?',
  },
  {
    id: 'current_account_balance',
    tool: 'get_current_account_balance',
    keywords: [
      'peki borcu', 'borcu ne kadar', 'borcu ne', 'açık ne kadar', 'borç mu fazla',
      'firmasına borcumuz', 'firmaya borcumuz', 'firmasına ne kadar borcumuz',
      'şirketine borcumuz', 'şirkete borcumuz', 'ne kadar borcumuz',
      'firma bakiyesi', 'cari bakiye', 'tedarikçi bakiyesi', 'tedarikçiye borcumuz',
      'şirkete borcumuz', 'laboratuvara borcumuz', 'firmasına borç',
      'cari hesabı bakiyesi', 'cari hesabının bakiyesi', 'borç', 'alacak', 'bakiye',
    ],
    extractParams: (msg, memory) => {
      const name = extractCurrentAccountName(msg);
      return { currentAccountQuery: name, currentAccountId: name ? null : memory?.lastReferencedCurrentAccountId };
    },
    needsParam: (p) => !p.currentAccountQuery && !p.currentAccountId,
    clarification: 'Hangi cari hesap veya firma için bilgi istiyorsunuz?',
  },
  {
    id: 'current_account_last_transaction',
    tool: 'get_current_account_last_transaction',
    keywords: [
      'son işlem', 'son hareket', 'son hareket ne', 'son işlem ne',
      'en son işlem', 'en son hareket', 'son finansal işlem',
    ],
    extractParams: (msg, memory) => {
      const name = extractCurrentAccountName(msg);
      return { currentAccountQuery: name, currentAccountId: name ? null : memory?.lastReferencedCurrentAccountId };
    },
    needsParam: (p) => !p.currentAccountQuery && !p.currentAccountId,
    clarification: 'Hangi cari hesap veya firma için son işlemi görmek istiyorsunuz?',
  },
  {
    id: 'current_account_transaction_summary',
    tool: 'get_current_account_transaction_summary',
    keywords: [
      'tüm işlemleri özetle', 'işlemleri özetle', 'işlem özeti',
      'bu cari ile yapılan', 'finansal işlem', 'hareketleri özetle',
      'borç-alacak', 'borç alacak davranışı', 'özetle',
    ],
    extractParams: (msg, memory) => {
      const name = extractCurrentAccountName(msg);
      return { currentAccountQuery: name, currentAccountId: name ? null : memory?.lastReferencedCurrentAccountId };
    },
    needsParam: (p) => !p.currentAccountQuery && !p.currentAccountId,
    clarification: 'Hangi cari hesap için işlem özetini görmek istiyorsunuz?',
  },
  {
    id: 'current_account_transactions',
    tool: 'get_current_account_transactions',
    keywords: [
      'işlem listesi', 'hareket listesi', 'tüm işlemler', 'tüm hareketler',
      'finansal hareketler', 'işlemleri listele', 'hareketleri göster',
    ],
    extractParams: (msg, memory) => {
      const name = extractCurrentAccountName(msg);
      return { currentAccountQuery: name, currentAccountId: name ? null : memory?.lastReferencedCurrentAccountId };
    },
    needsParam: (p) => !p.currentAccountQuery && !p.currentAccountId,
    clarification: 'Hangi cari hesap için işlemleri görmek istiyorsunuz?',
  },
  {
    id: 'current_account_monthly_summary',
    tool: 'get_current_account_monthly_summary',
    keywords: [
      'geçen ay durum', 'geçen ay', 'bu ay cari', 'aylık özet',
      'son 3 ay', 'son 3 ayda', 'aylık cari', 'dönem özeti',
    ],
    extractParams: (msg, memory) => {
      const name = extractCurrentAccountName(msg);
      return { currentAccountQuery: name, currentAccountId: name ? null : memory?.lastReferencedCurrentAccountId };
    },
    needsParam: (p) => !p.currentAccountQuery && !p.currentAccountId,
    clarification: 'Hangi cari hesap için aylık özeti görmek istiyorsunuz?',
  },
  {
    id: 'low_stock',
    tool: 'get_low_stock_products',
    keywords: [
      'düşük stok', 'düşük stoktaki', 'stoktaki ürünleri', 'ürünleri listele',
      'azalan stok', 'stok uyarısı', 'stok bitiyor', 'eksik ürün', 'minimum stok',
    ],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  {
    id: 'critical_stock',
    tool: 'get_critical_stock',
    keywords: ['kritik stok', 'stok bitti', 'stok tükendi', 'acil stok', 'sıfır stok'],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  {
    id: 'stock_movement_summary',
    tool: 'get_stock_movement_summary',
    keywords: ['stok hareketi', 'stok giriş çıkış', 'stok hareketleri', 'stok özeti'],
    extractParams: () => ({}),
    needsParam: () => false,
  },
  {
    id: 'last_stock_entry',
    tool: 'get_last_stock_entry',
    keywords: ['son stok girişi', 'son stok giriş', 'en son giriş', 'stok girişi ne zaman'],
    extractParams: (msg) => ({ productQuery: extractProductQuery(msg) || '' }),
    needsParam: () => false,
  },
  {
    id: 'product_quantity',
    tool: 'get_product_quantity',
    keywords: ['ürün miktarı', 'stok miktarı', 'kaç adet', 'ne kadar var', 'ürün kaç tane'],
    extractParams: (msg) => ({ productQuery: extractProductQuery(msg) || extractSearchQuery(msg) || '' }),
    needsParam: (p) => !p.productQuery || p.productQuery.length < 2,
    clarification: 'Hangi ürünün miktarını görmek istiyorsunuz?',
  },
  {
    id: 'lab_materials',
    tool: 'get_lab_materials',
    keywords: ['lab malzemeleri', 'laboratuvar malzemeleri', 'lab malzeme', 'laboratuvar malzeme'],
    extractParams: (msg) => ({ supplierQuery: extractCurrentAccountName(msg) || '' }),
    needsParam: () => false,
  },
  {
    id: 'current_account_summary',
    tool: 'get_current_account_summary',
    keywords: ['cari hesap özeti', 'firma özeti', 'tedarikçi özeti', 'cari özet'],
    extractParams: (msg, memory) => {
      const name = extractCurrentAccountName(msg);
      return { currentAccountQuery: name, currentAccountId: name ? null : memory?.lastReferencedCurrentAccountId };
    },
    needsParam: (p) => !p.currentAccountQuery && !p.currentAccountId,
    clarification: 'Hangi cari hesap veya firma için bilgi istiyorsunuz?',
  },
];

function isPatientFollowUp(normalized) {
  return PATIENT_FOLLOWUP_KEYWORDS.some((kw) => normalized.includes(kw));
}
function isDoctorFollowUp(normalized) {
  return DOCTOR_FOLLOWUP_KEYWORDS.some((kw) => normalized.includes(kw));
}
function isCurrentAccountFollowUp(normalized) {
  return CURRENT_ACCOUNT_FOLLOWUP_KEYWORDS.some((kw) => normalized.includes(kw));
}

function normalizeMessage(msg) {
  return (msg || '').trim().toLowerCase();
}

/**
 * Plan intent from message.
 * @param {string} message
 * @param {Object} opts - { history?: Array<{role,content}>, memory?: Object }
 * @returns {{ intent: string, tool: string, params: Object } | { clarification_needed: true, message: string }}
 */
function plan(message, opts = {}) {
  const { history = [], memory = null } = opts;
  const normalized = normalizeMessage(message);
  if (!normalized) {
    return { clarification_needed: true, message: 'Lütfen bir soru veya istek yazın.' };
  }

  const hasExplicitPatient = !!extractPatientName(message);
  const hasExplicitDoctor = !!extractDoctorName(message);
  const hasExplicitCurrentAccount = !!extractCurrentAccountName(message);

  // When no explicit entity but we have current account memory and message is cari follow-up, prefer current account over patient
  const preferCurrentAccount =
    !hasExplicitPatient &&
    !hasExplicitCurrentAccount &&
    memory?.lastReferencedCurrentAccountId &&
    isCurrentAccountFollowUp(normalized);

  let bestMatch = null;
  let bestScore = 0;

  const intentsToCheck = preferCurrentAccount
    ? [...INTENTS].sort((a, b) => {
        const aCari = ['get_current_account_balance', 'get_current_account_last_payment', 'get_current_account_summary', 'get_current_account_last_transaction', 'get_current_account_transaction_summary', 'get_current_account_transactions', 'get_current_account_monthly_summary'].includes(a.tool);
        const bCari = ['get_current_account_balance', 'get_current_account_last_payment', 'get_current_account_summary', 'get_current_account_last_transaction', 'get_current_account_transaction_summary', 'get_current_account_transactions', 'get_current_account_monthly_summary'].includes(b.tool);
        if (aCari && !bCari) return -1;
        if (!aCari && bCari) return 1;
        return 0;
      })
    : INTENTS;

  for (const intent of intentsToCheck) {
    for (const kw of intent.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        const score = kw.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = intent;
        }
      }
    }
  }

  if (!bestMatch) {
    return {
      clarification_needed: true,
      message: 'Bu soruyu şu an anlayamadım, lütfen biraz daha açık yazar mısınız?',
    };
  }

  const extractor = bestMatch.extractParams;
  const params = typeof extractor === 'function' ? extractor(message, memory) : {};

  if (bestMatch.needsParam && bestMatch.needsParam(params)) {
    const needsPatient = [
      'get_patient_summary', 'get_patient_last_payment', 'get_patient_balance',
      'get_patient_financial_history', 'get_patient_upcoming_appointments',
      'get_patient_contact', 'get_patient_last_treatment',
    ].includes(bestMatch.tool);
    const needsDoctor = bestMatch.tool === 'get_doctor_schedule';
    const needsCurrentAccount = [
      'get_current_account_balance', 'get_current_account_last_payment', 'get_current_account_summary',
      'get_current_account_last_transaction', 'get_current_account_transaction_summary',
      'get_current_account_transactions', 'get_current_account_monthly_summary',
    ].includes(bestMatch.tool);

    if (needsPatient && memory?.lastReferencedPatientId && isPatientFollowUp(normalized)) {
      return {
        intent: bestMatch.id,
        tool: bestMatch.tool,
        params: { ...params, patientId: memory.lastReferencedPatientId },
        memoryUsed: true,
      };
    }
    if (needsDoctor && memory?.lastReferencedDoctorId && isDoctorFollowUp(normalized)) {
      return {
        intent: bestMatch.id,
        tool: bestMatch.tool,
        params: { ...params, doctorId: memory.lastReferencedDoctorId, date: new Date().toISOString().slice(0, 10) },
        memoryUsed: true,
      };
    }
    if (needsCurrentAccount && memory?.lastReferencedCurrentAccountId && isCurrentAccountFollowUp(normalized)) {
      return {
        intent: bestMatch.id,
        tool: bestMatch.tool,
        params: { ...params, currentAccountId: memory.lastReferencedCurrentAccountId },
        memoryUsed: true,
      };
    }
    return {
      clarification_needed: true,
      message: bestMatch.clarification,
    };
  }

  return {
    intent: bestMatch.id,
    tool: bestMatch.tool,
    params,
    memoryUsed:
      !!(params.patientId && memory?.lastReferencedPatientId) ||
      !!(params.doctorId && memory?.lastReferencedDoctorId) ||
      !!(params.currentAccountId && memory?.lastReferencedCurrentAccountId),
  };
}

module.exports = { plan, INTENTS, extractPatientName, extractDoctorName, extractCurrentAccountName };
