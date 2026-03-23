const { INTENTS, METRICS, TIME_SCOPES } = require('./assistant-contracts');

const MONTH_MAP = {
  ocak: 1,
  subat: 2,
  şubat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  mayıs: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  ağustos: 8,
  eylul: 9,
  eylül: 9,
  ekim: 10,
  kasim: 11,
  kasım: 11,
  aralik: 12,
  aralık: 12,
};

const APPOINTMENT_LIST_GLOSSARY = [
  {
    id: 'appointment_list',
    metric: METRICS.appointment_list,
    intent: INTENTS.clinic_appointment_analysis,
    patterns: [
      /\brandevulari listele\b/,
      /\brandevuları listele\b/,
      /\brandevulari listeler misin\b/,
      /\brandevuları listeler misin\b/,
      /\brandevulari listeler misiniz\b/,
      /\brandevuları listeler misiniz\b/,
      /\blistele.*randevu\b/,
      /\brandevu.*listele\b/,
      /\brandevu.*isimleriyle\b/,
      /\brandevu.*detayli\b/,
      /\brandevu.*detaylı\b/,
    ],
  },
];

const PATIENT_DEMOGRAPHICS_GLOSSARY = [
  {
    id: 'patient_demographics',
    metric: METRICS.appointment_patient_count_by_gender,
    intent: INTENTS.clinic_patient_demographics,
    patterns: [
      /\bkadin hasta\b/,
      /\bkadın hasta\b/,
      /\berkek hasta\b/,
      /\bgelen hastalardan yuzde kaci\b/,
      /\bgelen hastalardan yüzde kaçı\b/,
      /\bkac tane kadin hasta\b/,
      /\bkaç tane kadın hasta\b/,
      /\bkac tane erkek hasta\b/,
      /\bkaç tane erkek hasta\b/,
      /\bkadin hasta randevu\b/,
      /\bkadın hasta randevu\b/,
      /\bcinsiyete gore\b/,
      /\bcinsiyete göre\b/,
    ],
  },
  {
    id: 'patient_gender_ratio',
    metric: METRICS.patient_gender_ratio,
    intent: INTENTS.clinic_patient_demographics,
    patterns: [
      /\bkadin hasta orani\b/,
      /\bkadın hasta oranı\b/,
      /\berkek hasta orani\b/,
      /\berkek hasta oranı\b/,
      /\bcinsiyet orani\b/,
      /\bcinsiyet oranı\b/,
      /\bkadin erkek orani\b/,
      /\bkadın erkek oranı\b/,
    ],
  },
];

const PATIENT_COUNT_GLOSSARY = [
  {
    id: 'patient_count',
    metric: METRICS.patient_count,
    intent: INTENTS.clinic_patient_analysis,
    patterns: [
      /\bkac adet hasta\b/,
      /\bkaç adet hasta\b/,
      /\bkac hasta\b/,
      /\bkaç hasta\b/,
      /\bhasta sayisi\b/,
      /\bhasta sayısı\b/,
      /\bkayitli hasta\b/,
      /\bkayıtlı hasta\b/,
      /\bklinige kayitli\b/,
      /\bkliniğe kayıtlı\b/,
      /\bklinige kayitli kac\b/,
      /\bkliniğe kayıtlı kaç\b/,
      /\btoplam hasta\b/,
      /\bsistemde toplam kac hasta\b/,
      /\bsistemde toplam kaç hasta\b/,
      /\bbu subede kac hasta\b/,
      /\bbu şubede kaç hasta\b/,
      /\bhasta var mi\b/,
      /\bhasta var mı\b/,
    ],
  },
];

const FINANCE_METRIC_GLOSSARY = [
  {
    id: 'pending_collection_amount',
    metric: METRICS.pending_collection_amount,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bbekleyen tahsilat(?:i)?\b/,
      /\bbekleyen odeme\b/,
      /\bbekleyen ödeme\b/,
      /\btahsil edilmemis\b/,
      /\btahsil edilmemiş\b/,
      /\bacik fatura bakiyesi\b/,
      /\baçık fatura bakiyesi\b/,
      /\btoplanacak\b/,
    ],
  },
  {
    id: 'overdue_installment_patient_list',
    metric: METRICS.overdue_installment_patient_list,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bgecikmis taksiti olan hastalar\b/,
      /\bgecikmiş taksiti olan hastalar\b/,
      /\bvadesi gecmis taksiti olan hastalar\b/,
      /\bvadesi geçmiş taksiti olan hastalar\b/,
      /\btaksiti geciken hastalar\b/,
      /\btaksiti gecikmis hastalar\b/,
      /\btaksiti gecikmiş hastalar\b/,
      /\bgecikmis taksitli hastalar\b/,
      /\bgecikmiş taksitli hastalar\b/,
      /\bvadesi gecmis taksitli hastalar\b/,
      /\bvadesi geçmiş taksitli hastalar\b/,
    ],
  },
  {
    id: 'overdue_installment_patient_count',
    metric: METRICS.overdue_installment_patient_count,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bgecikmis taksiti olan hasta\b/,
      /\bgecikmiş taksiti olan hasta\b/,
      /\bvadesi gecmis taksiti olan hasta\b/,
      /\bvadesi geçmiş taksiti olan hasta\b/,
      /\bkac hastanin gecikmis taksiti var\b/,
      /\bkaç hastanın gecikmiş taksiti var\b/,
      /\bgecikmis taksitli hasta sayisi\b/,
      /\bgecikmiş taksitli hasta sayısı\b/,
      /\bvadesi gecmis taksitli hasta sayisi\b/,
      /\bvadesi geçmiş taksitli hasta sayısı\b/,
    ],
  },
  {
    id: 'overdue_installment_count',
    metric: METRICS.overdue_installment_count,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bgecikmis taksit sayisi\b/,
      /\bgecikmiş taksit sayısı\b/,
      /\bvadesi gecmis taksit sayisi\b/,
      /\bvadesi geçmiş taksit sayısı\b/,
      /\bkac gecikmis taksit var\b/,
      /\bkaç gecikmiş taksit var\b/,
      /\bkac vadesi gecmis taksit var\b/,
      /\bkaç vadesi geçmiş taksit var\b/,
      /\bvadesi gecmis taksitlerin sayisi\b/,
      /\bvadesi geçmiş taksitlerin sayısı\b/,
    ],
  },
  {
    id: 'overdue_installment_amount',
    metric: METRICS.overdue_installment_amount,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bgecikmis taksitlerin toplam tutari\b/,
      /\bgecikmiş taksitlerin toplam tutarı\b/,
      /\bvadesi gecmis taksitlerin toplam tutari\b/,
      /\bvadesi geçmiş taksitlerin toplam tutarı\b/,
      /\bgecikmis taksit tutari\b/,
      /\bgecikmiş taksit tutarı\b/,
      /\bvadesi gecmis taksit tutari\b/,
      /\bvadesi geçmiş taksit tutarı\b/,
      /\bgecikmis taksitlerden ne kadar\b/,
      /\bgecikmiş taksitlerden ne kadar\b/,
    ],
  },
  {
    id: 'overdue_installment_ratio',
    metric: METRICS.overdue_installment_ratio,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bgecikmis taksitli hastalarin orani\b/,
      /\bgecikmiş taksitli hastaların oranı\b/,
      /\bvadesi gecmis taksitli hastalarin orani\b/,
      /\bvadesi geçmiş taksitli hastaların oranı\b/,
      /\bgecikmis taksiti olan hastalarin olmayana orani\b/,
      /\bgecikmiş taksiti olan hastaların olmayana oranı\b/,
      /\bgecikmis taksit odemesi olan hastalarin olmayana orani\b/,
      /\bgecikmiş taksit ödemesi olan hastaların olmayana oranı\b/,
      /\btum taksitli hastalara orani\b/,
      /\btüm taksitli hastalara oranı\b/,
    ],
  },
  {
    id: 'doctor_overdue_installment_ratio',
    metric: METRICS.doctor_overdue_installment_ratio,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bdr\.?.*hastalarinin.*gecikmis taksit.*oran\b/,
      /\bdr\.?.*hastalarının.*gecikmiş taksit.*oran\b/,
      /\bdoktor.*hastalarinin.*gecikmis taksit.*oran\b/,
      /\bdoktor.*hastalarının.*gecikmiş taksit.*oran\b/,
      /\bdr\.?.*hastalarinin.*vadesi gecmis taksit.*oran\b/,
      /\bdr\.?.*hastalarının.*vadesi geçmiş taksit.*oran\b/,
    ],
  },
  {
    id: 'overdue_patient_list',
    metric: METRICS.overdue_patient_list,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bvadesi gecmis borclu hastalar\b/,
      /\bvadesi geçmiş borçlu hastalar\b/,
      /\bgenel gecikmis borclu hasta listesi\b/,
      /\bgenel gecikmiş borçlu hasta listesi\b/,
      /\boverdue patients\b/,
    ],
  },
  {
    id: 'overdue_receivables_amount',
    metric: METRICS.overdue_receivables_amount,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bvadesi gecmis alacak\b/,
      /\bvadesi geçmiş alacak\b/,
      /\bvadesi gecmis toplam alacak\b/,
      /\bvadesi geçmiş toplam alacak\b/,
      /\bgecikmis alacak\b/,
      /\bgecikmiş alacak\b/,
      /\boverdue receivable\b/,
      /\boverdue balance\b/,
    ],
  },
  {
    id: 'outstanding_balance_amount',
    metric: METRICS.outstanding_balance_amount,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bkalan alacak\b/,
      /\ba(c|ç)ik alacak\b/,
      /\ba(c|ç)ik bakiye\b/,
      /\btoplam alacagimiz\b/,
      /\btoplam alacağımız\b/,
      /\boutstanding balance\b/,
    ],
  },
  {
    id: 'collection_amount',
    metric: METRICS.collection_amount,
    intent: INTENTS.finance_summary,
    patterns: [
      /\btoplam tahsilat\b/,
      /\bodenen tutar\b/,
      /\bödenen tutar\b/,
      /\bodeme aldik\b/,
      /\bödeme aldık\b/,
      /\btahsil edilen\b/,
      /\btahsilat\b/,
    ],
  },
  {
    id: 'revenue_amount',
    metric: METRICS.revenue_amount,
    intent: INTENTS.finance_summary,
    patterns: [
      /\bciro\b/,
      /\bgelir\b/,
      /\brevenue\b/,
    ],
  },
];

const APPOINTMENT_RATE_GLOSSARY = [
  {
    id: 'no_show_rate',
    metric: METRICS.no_show_rate,
    intent: INTENTS.clinic_appointment_analysis,
    patterns: [
      /\bgelmeme orani\b/,
      /\bgelmeme oranı\b/,
      /\bgelmeyen hasta\b/,
      /\bgelmedi randevu\b/,
      /\bno.?show\b/,
      /\brandevuya gelmeyen\b/,
      /\bgelmeme yuzdesi\b/,
      /\bgelmeme yüzdesi\b/,
    ],
  },
  {
    id: 'cancellation_rate',
    metric: METRICS.cancellation_rate,
    intent: INTENTS.clinic_appointment_analysis,
    patterns: [
      /\biptal orani\b/,
      /\biptal oranı\b/,
      /\biptal edilen randevu\b/,
      /\brandevu iptal\b/,
      /\biptal yuzdesi\b/,
      /\biptal yüzdesi\b/,
    ],
  },
];

const NEW_PATIENT_GLOSSARY = [
  {
    id: 'new_patient_count',
    metric: METRICS.new_patient_count,
    intent: INTENTS.clinic_patient_analysis,
    patterns: [
      /\byeni hasta\b/,
      /\byeni hasta sayisi\b/,
      /\byeni hasta sayısı\b/,
      /\bbu ay kac yeni hasta\b/,
      /\bbu ay kaç yeni hasta\b/,
      /\byeni kayit\b/,
      /\byeni kayıt\b/,
      /\bilk kez gelen\b/,
    ],
  },
];

const CORRECTION_PATTERNS = [
  /\bemin misin\b/,
  /\byanlis anladin\b/,
  /\byanlış anladın\b/,
  /\bben .* soruyorum\b/,
  /\bo toplam tahsilat idi\b/,
  /\bonu degil\b/,
  /\bonu değil\b/,
  /\bdogrusu\b/,
  /\bdoğrusu\b/,
];

const LIST_HINT_PATTERNS = [
  /\bhangi\b/,
  /\bkimler\b/,
  /\blistele\b/,
  /\blisteler misin\b/,
  /\blisteler misiniz\b/,
  /\bliste\b/,
  /\bisimleriyle\b/,
  /\bhasta ismi\b/,
  /\bdoktor ismi\b/,
  /\btarih saati ile\b/,
  /\bdetayli goster\b/,
  /\bdetaylı göster\b/,
  /\bhangi hastalar\b/,
  /\bhangi randevular\b/,
  /\bhasta var mi\b/,
  /\bhasta var mı\b/,
];

const COUNT_HINT_PATTERNS = [
  /\bkac\b/,
  /\bkaç\b/,
  /\bsayi\b/,
  /\bsayı\b/,
  /\badet\b/,
  /\bvar mi\b/,
  /\bvar mı\b/,
  /\btoplam kac\b/,
  /\btoplam kaç\b/,
];

const RATIO_HINT_PATTERNS = [
  /\boran\b/,
  /\borani\b/,
  /\boranı\b/,
  /\byuzde\b/,
  /\byüzde\b/,
  /\bpayi\b/,
  /\bpayı\b/,
  /\bpay\b/,
];

const DOCTOR_HINT_PATTERNS = [
  /\bdr\b/,
  /\bdoktor\b/,
  /\bhekim\b/,
  /\bhastalarinin\b/,
  /\bhastalarının\b/,
  /\bhastalari\b/,
  /\bhastaları\b/,
];

const AMOUNT_HINT_PATTERNS = [
  /\bne kadar\b/,
  /\bkaç tl\b/,
  /\bkaç tl'lik\b/,
  /\bkaç tl lik\b/,
  /\btutar\b/,
];

const COMPARISON_PATTERNS = [
  /\bgecen aya gore\b/,
  /\bgeçen aya göre\b/,
  /\bgecen aya kiyasla\b/,
  /\bgeçen aya kıyasla\b/,
  /\bartti mi\b/,
  /\barttı mı\b/,
  /\bazaldi mi\b/,
  /\bazaldı mı\b/,
  /\bdegisti mi\b/,
  /\bdeğişti mi\b/,
];

const FOLLOW_UP_PATTERNS = [
  /\bpeki\b/,
  /\bbu\b.*\bne\b/,
  /\bgecen aya gore\b/,
  /\bgeçen aya göre\b/,
  /\bne kadar artti\b/,
  /\bne kadar arttı\b/,
  /\bdurum ne\b/,
  /\bbu doktor icin\b/,
  /\bbu doktor için\b/,
  /\bne kadar artti bu peki\b/,
  /\bne kadar arttı bu peki\b/,
  /\blisteler misin\b/,
  /\blisteler misiniz\b/,
  /\bbu randevulari\b/,
  /\bbu randevuları\b/,
];

const PENDING_CLARIFICATION_ANSWER_PATTERNS = [
  /^evet\s*(bekliyorum)?\s*$/i,
  /^tamam\s*$/i,
  /^bu ay\s*$/i,
  /^gecen ay\s*$/i,
  /^geçen ay\s*$/i,
  /^bu hafta\s*$/i,
  /^bugun\s*$/i,
  /^bugün\s*$/i,
  /^hayir\s*$/i,
  /^hayır\s*$/i,
  /^lutfen\s*$/i,
  /^lütfen\s*$/i,
  /^(ocak|subat|şubat|mart|nisan|mayis|mayıs|haziran|temmuz|agustos|ağustos|eylul|eylül|ekim|kasim|kasım|aralik|aralık)\s*(\d{4})?$/i,
  /^dr\.?\s+\S+/i,
  /^\S+\s+\S+$/,
];

function isFollowUpQuery(foldedQuery) {
  return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(foldedQuery));
}

function isPendingClarificationAnswer(query) {
  const trimmed = String(query || '').trim();
  return PENDING_CLARIFICATION_ANSWER_PATTERNS.some((p) => p.test(trimmed));
}

const TIME_SCOPE_PATTERNS = [
  { timeScope: TIME_SCOPES.today, pattern: /\bbugun\b|\bbugün\b/ },
  { timeScope: TIME_SCOPES.yesterday, pattern: /\bdun\b|\bdünkü\b|\bdunku\b/ },
  { timeScope: TIME_SCOPES.this_week, pattern: /\bbu hafta\b/ },
  { timeScope: TIME_SCOPES.last_week, pattern: /\bgecen hafta\b|\bgeçen hafta\b/ },
  { timeScope: TIME_SCOPES.this_month, pattern: /\bbu ay\b|\bayki\b|\baykı\b/ },
  { timeScope: TIME_SCOPES.last_month, pattern: /\bgecen ay\b|\bgeçen ay\b/ },
  { timeScope: TIME_SCOPES.this_quarter, pattern: /\bbu ceyrek\b|\bbu çeyrek\b/ },
  { timeScope: TIME_SCOPES.last_quarter, pattern: /\bgecen ceyrek\b|\bgeçen çeyrek\b/ },
  { timeScope: TIME_SCOPES.this_year, pattern: /\bbu yil\b|\bbu yıl\b/ },
  { timeScope: TIME_SCOPES.last_year, pattern: /\bgecen yil\b|\bgeçen yıl\b/ },
  { timeScope: TIME_SCOPES.last_3_months, pattern: /\bson 3 ay\b/ },
];

function foldTurkish(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/['’`]/g, "'")
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[.,!?;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUserQuery(query) {
  const rawQuery = String(query || '').trim();
  const normalizedQuery = rawQuery
    .toLocaleLowerCase('tr-TR')
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  const foldedQuery = foldTurkish(rawQuery);
  return { rawQuery, normalizedQuery, foldedQuery };
}

function detectTimeScopeHints(foldedQuery) {
  const matched = TIME_SCOPE_PATTERNS.find((entry) => entry.pattern.test(foldedQuery));
  if (matched) {
    return {
      timeScope: matched.timeScope,
      filters: {},
    };
  }

  const monthMatch = foldedQuery.match(
    /\b(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)\b/
  );
  if (monthMatch) {
    const month = MONTH_MAP[monthMatch[1]];
    if (month) {
      return {
        timeScope: TIME_SCOPES.custom,
        filters: {
          month,
          year: new Date().getFullYear(),
        },
      };
    }
  }

  return {
    timeScope: TIME_SCOPES.none,
    filters: {},
  };
}

function matchGlossaryRules(foldedQuery, rules) {
  const matches = [];
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const match = foldedQuery.match(pattern);
      if (!match) continue;
      matches.push({
        id: rule.id,
        metric: rule.metric,
        intent: rule.intent,
        matchedText: match[0],
        specificity: match[0].length,
      });
    }
  }
  matches.sort((a, b) => b.specificity - a.specificity);
  return matches;
}

function matchPatientCountGlossary(foldedQuery) {
  return matchGlossaryRules(foldedQuery, PATIENT_COUNT_GLOSSARY);
}

function matchPatientDemographicsGlossary(foldedQuery) {
  return matchGlossaryRules(foldedQuery, PATIENT_DEMOGRAPHICS_GLOSSARY);
}

function matchAppointmentListGlossary(foldedQuery) {
  return matchGlossaryRules(foldedQuery, APPOINTMENT_LIST_GLOSSARY);
}

function matchFinanceGlossary(foldedQuery) {
  return matchGlossaryRules(foldedQuery, FINANCE_METRIC_GLOSSARY);
}

function choosePrimaryFinanceMetric(foldedQuery, glossaryMatches) {
  if (!glossaryMatches.length) return null;

  const hasListHint = LIST_HINT_PATTERNS.some((pattern) => pattern.test(foldedQuery));
  const hasAmountHint = AMOUNT_HINT_PATTERNS.some((pattern) => pattern.test(foldedQuery));
  const hasCountHint = COUNT_HINT_PATTERNS.some((pattern) => pattern.test(foldedQuery));
  const hasRatioHint = RATIO_HINT_PATTERNS.some((pattern) => pattern.test(foldedQuery));
  const hasDoctorHint = DOCTOR_HINT_PATTERNS.some((pattern) => pattern.test(foldedQuery));

  const metricsInMatches = new Set(glossaryMatches.map((m) => m.metric));

  // Doktor + overdue installment + oran
  if (
    hasDoctorHint &&
    hasRatioHint &&
    (
      metricsInMatches.has(METRICS.doctor_overdue_installment_ratio) ||
      metricsInMatches.has(METRICS.overdue_installment_ratio) ||
      foldedQuery.includes('gecikmis taksit') ||
      foldedQuery.includes('gecikmiş taksit') ||
      foldedQuery.includes('vadesi gecmis taksit') ||
      foldedQuery.includes('vadesi geçmiş taksit')
    )
  ) {
    return METRICS.doctor_overdue_installment_ratio;
  }

  // Overdue installment domain
  if (
    metricsInMatches.has(METRICS.overdue_installment_amount) ||
    metricsInMatches.has(METRICS.overdue_installment_count) ||
    metricsInMatches.has(METRICS.overdue_installment_patient_count) ||
    metricsInMatches.has(METRICS.overdue_installment_patient_list) ||
    metricsInMatches.has(METRICS.overdue_installment_ratio)
  ) {
    if (hasRatioHint) return METRICS.overdue_installment_ratio;
    if (hasListHint) return METRICS.overdue_installment_patient_list;
    if (hasAmountHint) return METRICS.overdue_installment_amount;
    if (hasCountHint) {
      if (foldedQuery.includes('hasta')) return METRICS.overdue_installment_patient_count;
      return METRICS.overdue_installment_count;
    }

    const explicitPriority = [
      METRICS.doctor_overdue_installment_ratio,
      METRICS.overdue_installment_ratio,
      METRICS.overdue_installment_patient_list,
      METRICS.overdue_installment_patient_count,
      METRICS.overdue_installment_count,
      METRICS.overdue_installment_amount,
    ];

    const explicitMatch = explicitPriority.find((metric) => metricsInMatches.has(metric));
    if (explicitMatch) return explicitMatch;
  }

  // Generic overdue receivables
  const overdueMatch = glossaryMatches.find((match) =>
    [METRICS.overdue_receivables_amount, METRICS.overdue_patient_list].includes(match.metric)
  );
  if (overdueMatch) {
    if (hasListHint) return METRICS.overdue_patient_list;
    if (hasAmountHint) return METRICS.overdue_receivables_amount;
  }

  return glossaryMatches[0].metric;
}

function analyzeBusinessSemantics(query, memory = null) {
  const normalized = normalizeUserQuery(query);
  const patientCountMatches = matchPatientCountGlossary(normalized.foldedQuery);
  const patientDemographicsMatches = matchPatientDemographicsGlossary(normalized.foldedQuery);
  const appointmentListMatches = matchAppointmentListGlossary(normalized.foldedQuery);
  const financeMatches = matchFinanceGlossary(normalized.foldedQuery);
  const appointmentRateMatches = matchGlossaryRules(normalized.foldedQuery, APPOINTMENT_RATE_GLOSSARY);
  const newPatientMatches = matchGlossaryRules(normalized.foldedQuery, NEW_PATIENT_GLOSSARY);

  let primaryMetricHint = null;
  let intentHint = null;
  let glossaryMatches = [];

  const bestPatientMatch = patientCountMatches[0];
  const bestDemographicsMatch = patientDemographicsMatches[0];
  const bestAppointmentListMatch = appointmentListMatches[0];
  const bestFinanceMatch = financeMatches[0];
  const bestAppointmentRateMatch = appointmentRateMatches[0];
  const bestNewPatientMatch = newPatientMatches[0];
  const patientSpecificity = bestPatientMatch?.specificity ?? 0;
  const demographicsSpecificity = bestDemographicsMatch?.specificity ?? 0;
  const appointmentListSpecificity = bestAppointmentListMatch?.specificity ?? 0;
  const financeSpecificity = bestFinanceMatch?.specificity ?? 0;
  const rateSpecificity = bestAppointmentRateMatch?.specificity ?? 0;
  const newPatientSpecificity = bestNewPatientMatch?.specificity ?? 0;

  // Priority resolution: most specific match wins across ALL domains
  // Finance matches go through choosePrimaryFinanceMetric for list/amount disambiguation
  const financeMetric = financeMatches.length > 0
    ? choosePrimaryFinanceMetric(normalized.foldedQuery, financeMatches)
    : null;

  const candidates = [
    { spec: rateSpecificity, metric: bestAppointmentRateMatch?.metric, intent: bestAppointmentRateMatch?.intent, matches: appointmentRateMatches },
    { spec: newPatientSpecificity, metric: bestNewPatientMatch?.metric, intent: bestNewPatientMatch?.intent, matches: newPatientMatches },
    { spec: appointmentListSpecificity, metric: METRICS.appointment_list, intent: INTENTS.clinic_appointment_analysis, matches: appointmentListMatches },
    { spec: demographicsSpecificity, metric: bestDemographicsMatch?.metric, intent: INTENTS.clinic_patient_demographics, matches: patientDemographicsMatches },
    { spec: patientSpecificity, metric: METRICS.patient_count, intent: INTENTS.clinic_patient_analysis, matches: patientCountMatches },
    { spec: financeSpecificity, metric: financeMetric, intent: financeMetric ? INTENTS.finance_summary : null, matches: financeMatches },
  ].filter(c => c.spec > 0 && c.metric);

  // Sort by specificity descending
  candidates.sort((a, b) => b.spec - a.spec);
  const topCandidate = candidates[0];

  if (topCandidate) {
    primaryMetricHint = topCandidate.metric;
    intentHint = topCandidate.intent;
    glossaryMatches = topCandidate.matches;
  }

  const listIntent = LIST_HINT_PATTERNS.some((p) => p.test(normalized.foldedQuery));

  const timeScopeHint = detectTimeScopeHints(normalized.foldedQuery);
  const isCorrection = CORRECTION_PATTERNS.some((pattern) => pattern.test(normalized.foldedQuery));
  const compareToPrevious = COMPARISON_PATTERNS.some((pattern) => pattern.test(normalized.foldedQuery));

  const filtersHint = {
    ...(timeScopeHint.filters || {}),
  };
  if (compareToPrevious) {
    filtersHint.compareToPrevious = true;
    filtersHint.comparisonPeriod = 'previous_month';
  }
  const correctionContext =
    isCorrection && memory?.lastQueryState
      ? {
          previousIntent: memory.lastQueryState.intent || null,
          previousMetric: memory.lastQueryState.metric || null,
          previousTimeScope: memory.lastQueryState.timeScope || null,
          previousFilters: memory.lastQueryState.filters || {},
        }
      : null;

  const followUp = isFollowUpQuery(normalized.foldedQuery);
  const hasLastState = memory?.lastQueryState;
  const inheritanceHint =
    followUp && !primaryMetricHint && hasLastState
      ? {
          inheritedMetric: memory.lastQueryState.metric || null,
          inheritedIntent: memory.lastQueryState.intent || null,
          inheritedEntityType: memory.lastQueryState.lastEntityType || null,
          inheritedEntityId: memory.lastQueryState.lastEntityId || null,
          inheritedTimeScope: memory.lastQueryState.timeScope || null,
          inheritedFilters: memory.lastQueryState.filters || {},
        }
      : null;

  const listFollowUpInheritance =
    followUp && intentHint === INTENTS.clinic_appointment_analysis && primaryMetricHint === METRICS.appointment_list && hasLastState && memory.lastQueryState.intent === INTENTS.clinic_appointment_analysis
      ? {
          inheritedTimeScope: memory.lastQueryState.timeScope || null,
          inheritedFilters: memory.lastQueryState.filters || {},
        }
      : null;

  if (inheritanceHint && compareToPrevious) {
    filtersHint.compareToPrevious = true;
    filtersHint.comparisonPeriod = filtersHint.comparisonPeriod || 'previous_month';
  }

  let forcedMetric = null;
  let forcedIntent = null;

  const hasListHint = LIST_HINT_PATTERNS.some((p) => p.test(normalized.foldedQuery));

  if (intentHint === INTENTS.clinic_appointment_analysis && hasListHint) {
    forcedMetric = METRICS.appointment_list;
    forcedIntent = INTENTS.clinic_appointment_analysis;
  }

  if (inheritanceHint && inheritanceHint?.inheritedIntent === INTENTS.clinic_appointment_analysis && hasListHint) {
    forcedMetric = METRICS.appointment_list;
    forcedIntent = INTENTS.clinic_appointment_analysis;
  }

  if (intentHint === INTENTS.clinic_patient_analysis) {
    const genderPhrases = [
      /\bkadin hasta\b/,
      /\bkadın hasta\b/,
      /\berkek hasta\b/,
      /\bcinsiyet\b/,
      /\byuzde kaci\b/,
      /\byüzde kaçı\b/,
      /\byuzde kac\b/,
      /\byüzde kaç\b/,
      /\bkac tane kadin\b/,
      /\bkaç tane kadın\b/,
      /\bkac tane erkek\b/,
      /\bkaç tane erkek\b/,
    ];
    if (genderPhrases.some((p) => p.test(normalized.foldedQuery))) {
      forcedIntent = INTENTS.clinic_patient_demographics;
      forcedMetric = METRICS.appointment_patient_count_by_gender;
    }
  }

  const effectiveInheritedTimeScope =
    listFollowUpInheritance?.inheritedTimeScope || inheritanceHint?.inheritedTimeScope || null;
  const effectiveInheritedFilters =
    listFollowUpInheritance?.inheritedFilters || inheritanceHint?.inheritedFilters || {};

  return {
    ...normalized,
    glossaryMatches,
    primaryMetricHint: forcedMetric || primaryMetricHint,
    intentHint: forcedIntent || intentHint,
    forcedMetric: forcedMetric || null,
    forcedIntent: forcedIntent || null,
    timeScopeHint: compareToPrevious && timeScopeHint.timeScope === TIME_SCOPES.none
      ? TIME_SCOPES.this_month
      : timeScopeHint.timeScope,
    filtersHint: Object.keys(effectiveInheritedFilters).length ? { ...filtersHint, ...effectiveInheritedFilters } : filtersHint,
    compareToPrevious,
    isCorrection,
    correctionContext,
    inheritanceHint: !!inheritanceHint || !!listFollowUpInheritance,
    inheritedMetric: inheritanceHint?.inheritedMetric || null,
    inheritedIntent: inheritanceHint?.inheritedIntent || null,
    inheritedEntityType: inheritanceHint?.inheritedEntityType || null,
    inheritedEntityId: inheritanceHint?.inheritedEntityId || null,
    inheritedTimeScope: effectiveInheritedTimeScope,
    inheritedFilters: effectiveInheritedFilters,
    listIntent,
  };
}

/**
 * When we have a strong deterministic match, return a plan without LLM.
 * Used for hybrid planner - reduces latency and improves correctness.
 */
function getDeterministicPlan(analysis) {
  if (!analysis.primaryMetricHint || !analysis.intentHint) return null;

  if (analysis.intentHint === INTENTS.clinic_patient_analysis && analysis.primaryMetricHint === METRICS.patient_count) {
    return {
      intent: INTENTS.clinic_patient_analysis,
      metric: METRICS.patient_count,
      entityType: 'none',
      entityName: null,
      timeScope: TIME_SCOPES.none,
      filters: {},
      requiresClarification: false,
      clarificationQuestion: null,
      unsupportedReason: null,
      confidence: 0.95,
    };
  }

  if (analysis.intentHint === INTENTS.clinic_patient_demographics) {
    const timeScope =
      (analysis.timeScopeHint && analysis.timeScopeHint !== TIME_SCOPES.none)
        ? analysis.timeScopeHint
        : (analysis.inheritedTimeScope || TIME_SCOPES.this_month);
    const filters = analysis.filtersHint || analysis.inheritedFilters || {};
    return {
      intent: INTENTS.clinic_patient_demographics,
      metric: analysis.primaryMetricHint || METRICS.appointment_patient_count_by_gender,
      entityType: 'none',
      entityName: null,
      timeScope,
      filters,
      requiresClarification: false,
      clarificationQuestion: null,
      unsupportedReason: null,
      confidence: 0.95,
    };
  }

  if (analysis.intentHint === INTENTS.clinic_appointment_analysis && analysis.primaryMetricHint === METRICS.appointment_list) {
    const timeScope =
      (analysis.timeScopeHint && analysis.timeScopeHint !== TIME_SCOPES.none)
        ? analysis.timeScopeHint
        : (analysis.inheritedTimeScope || TIME_SCOPES.this_month);
    const filters = analysis.filtersHint || analysis.inheritedFilters || {};
    return {
      intent: INTENTS.clinic_appointment_analysis,
      metric: METRICS.appointment_list,
      entityType: 'none',
      entityName: null,
      timeScope,
      filters,
      requiresClarification: false,
      clarificationQuestion: null,
      unsupportedReason: null,
      confidence: 0.95,
    };
  }

  return null;
}

module.exports = {
  FINANCE_METRIC_GLOSSARY,
  PATIENT_COUNT_GLOSSARY,
  PATIENT_DEMOGRAPHICS_GLOSSARY,
  APPOINTMENT_LIST_GLOSSARY,
  normalizeUserQuery,
  matchFinanceGlossary,
  matchPatientCountGlossary,
  matchPatientDemographicsGlossary,
  matchAppointmentListGlossary,
  analyzeBusinessSemantics,
  getDeterministicPlan,
  detectTimeScopeHints,
  isFollowUpQuery,
  isPendingClarificationAnswer,
  CORRECTION_PATTERNS,
  COMPARISON_PATTERNS,
  FOLLOW_UP_PATTERNS,
};
