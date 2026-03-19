const { z } = require('zod');

const INTENTS = {
  finance_summary: 'finance_summary',
  clinic_patient_analysis: 'clinic_patient_analysis',
  patient_balance: 'patient_balance',
  patient_summary: 'patient_summary',
  patient_last_payment: 'patient_last_payment',
  patient_treatment_progress: 'patient_treatment_progress',
  patient_appointment_analysis: 'patient_appointment_analysis',
  doctor_schedule: 'doctor_schedule',
  doctor_appointment_analysis: 'doctor_appointment_analysis',
  doctor_treatment_performance: 'doctor_treatment_performance',
  doctor_revenue_analysis: 'doctor_revenue_analysis',
  clinic_appointment_analysis: 'clinic_appointment_analysis',
  clinic_patient_demographics: 'clinic_patient_demographics',
  clinic_treatment_analysis: 'clinic_treatment_analysis',
  clinic_inventory_analysis: 'clinic_inventory_analysis',
  clinic_lab_analysis: 'clinic_lab_analysis',
  clinic_financial_analytics: 'clinic_financial_analytics',
  clinic_operational_analytics: 'clinic_operational_analytics',
  current_account_balance: 'current_account_balance',
  current_account_transactions: 'current_account_transactions',
  inventory_low_stock: 'inventory_low_stock',
  unsupported: 'unsupported',
};

const ENTITY_TYPES = {
  patient: 'patient',
  doctor: 'doctor',
  current_account: 'current_account',
  inventory_item: 'inventory_item',
  clinic: 'clinic',
  none: 'none',
};

const OUTPUT_SHAPES = {
  count: 'count',
  amount: 'amount',
  ratio: 'ratio',
  list: 'list',
  summary: 'summary',
};


const TIME_SCOPES = {
  today: 'today',
  yesterday: 'yesterday',
  this_week: 'this_week',
  last_week: 'last_week',
  this_month: 'this_month',
  last_month: 'last_month',
  this_quarter: 'this_quarter',
  last_quarter: 'last_quarter',
  this_year: 'this_year',
  last_year: 'last_year',
  last_3_months: 'last_3_months',
  custom: 'custom',
  none: 'none',
};

const METRICS = {
  // ── Finance / Money ──
  revenue_amount: 'revenue_amount',
  collection_amount: 'collection_amount',
  pending_collection_amount: 'pending_collection_amount',
  outstanding_balance_amount: 'outstanding_balance_amount',
  overdue_receivables_amount: 'overdue_receivables_amount',
  stock_value_total: 'stock_value_total',
  lab_cost_total: 'lab_cost_total',
  discount_total_amount: 'discount_total_amount',
  expense_total_amount: 'expense_total_amount',
  avg_invoice_amount: 'avg_invoice_amount',
  avg_payment_amount: 'avg_payment_amount',
  doctor_revenue_amount: 'doctor_revenue_amount',
  doctor_collection_amount: 'doctor_collection_amount',
  patient_invoice_amount: 'patient_invoice_amount',
  patient_paid_amount: 'patient_paid_amount',
  ca_overdue_amount: 'ca_overdue_amount',
  completed_treatment_value: 'completed_treatment_value',

  // ── Counts ──
  patient_count: 'patient_count',
  new_patient_count: 'new_patient_count',
  active_patient_count: 'active_patient_count',
  inactive_patient_count: 'inactive_patient_count',
  appointment_count: 'appointment_count',
  completed_appointment_count: 'completed_appointment_count',
  cancelled_appointment_count: 'cancelled_appointment_count',
  no_show_count: 'no_show_count',
  invoice_count: 'invoice_count',
  payment_count: 'payment_count',
  current_account_count: 'current_account_count',
  inventory_item_count: 'inventory_item_count',
  low_stock_item_count: 'low_stock_item_count',
  expiring_stock_count: 'expiring_stock_count',
  treatment_item_count: 'treatment_item_count',
  completed_treatment_item_count: 'completed_treatment_item_count',
  completed_treatment_count: 'completed_treatment_count',
  lab_case_count: 'lab_case_count',
  completed_lab_case_count: 'completed_lab_case_count',
  pending_lab_case_count: 'pending_lab_case_count',
  doctor_patient_count: 'doctor_patient_count',
  doctor_cancel_count: 'doctor_cancel_count',
  doctor_no_show_count: 'doctor_no_show_count',

  // ── Lists ──
  appointment_list: 'appointment_list',
  patient_appointment_list: 'patient_appointment_list',
  overdue_patient_list: 'overdue_patient_list',
  overdue_ca_list: 'overdue_ca_list',
  debtor_patient_list: 'debtor_patient_list',
  top_revenue_patients: 'top_revenue_patients',
  top_revenue_doctors: 'top_revenue_doctors',
  new_patients_list: 'new_patients_list',
  no_show_patients_list: 'no_show_patients_list',
  cancelled_appointments_list: 'cancelled_appointments_list',
  pending_lab_list: 'pending_lab_list',
  completed_treatment_list: 'completed_treatment_list',
  patient_treatment_list: 'patient_treatment_list',
  ca_list_by_type: 'ca_list_by_type',
  stock_by_category: 'stock_by_category',
  low_stock_list: 'low_stock_list',
  expiring_stock_list: 'expiring_stock_list',
  transaction_list: 'transaction_list',
  schedule_list: 'schedule_list',

  // ── Ratios / Percentages ──
  no_show_rate: 'no_show_rate',
  cancellation_rate: 'cancellation_rate',
  collection_rate: 'collection_rate',
  appointment_fill_rate: 'appointment_fill_rate',
  treatment_completion_rate: 'treatment_completion_rate',
  lab_completion_rate: 'lab_completion_rate',
  payment_invoice_ratio: 'payment_invoice_ratio',
  overdue_ratio: 'overdue_ratio',
  low_stock_ratio: 'low_stock_ratio',
  retention_rate: 'retention_rate',
  new_patient_ratio: 'new_patient_ratio',
  patient_gender_ratio: 'patient_gender_ratio',
  completion_percentage: 'completion_percentage',
  appointment_patient_count_by_gender: 'appointment_patient_count_by_gender',
  new_patient_count_by_gender: 'new_patient_count_by_gender',

  // ── Summaries ──
  summary: 'summary',
  last_payment: 'last_payment',
};

const PlannerFiltersSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  fromDate: z.string().trim().min(8).optional(),
  toDate: z.string().trim().min(8).optional(),
  status: z.string().trim().min(1).optional(),
  gender: z.enum(['male', 'female', 'all']).optional(),
  category: z.string().trim().min(1).optional(),
  accountType: z.string().trim().min(1).optional(),
  paymentMethod: z.string().trim().min(1).optional(),
  compareToPrevious: z.boolean().optional(),
  comparisonPeriod: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  sortBy: z.string().trim().min(1).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).passthrough().default({});

const LEGACY_INTENTS = {
  clinic_collection_summary: 'clinic_collection_summary',
  overdue_receivables_summary: 'overdue_receivables_summary',
};

const LEGACY_METRICS = {
  outstanding_balance: 'outstanding_balance',
  completed_value: 'completed_value',
  completed_item_count: 'completed_item_count',
};

const PlannerEntitySchema = z.object({
  type: z.enum(Object.values(ENTITY_TYPES)),
  name: z.string().trim().min(1).nullable().optional().default(null),
});

const RawPlannerOutputSchema = z.object({
  intent: z.enum([...Object.values(INTENTS), ...Object.values(LEGACY_INTENTS)]),
  metric: z
    .enum([...Object.values(METRICS), ...Object.values(LEGACY_METRICS)])
    .optional(),
  metrics: z
    .array(z.enum([...Object.values(METRICS), ...Object.values(LEGACY_METRICS)]))
    .max(3)
    .optional(),
  entityType: z.enum(Object.values(ENTITY_TYPES)).optional(),
  entityName: z.string().trim().nullable().optional(),
  entities: z.array(PlannerEntitySchema).max(3).optional(),
  timeScope: z.enum(Object.values(TIME_SCOPES)).default(TIME_SCOPES.none),
  filters: PlannerFiltersSchema,
  outputShape: z.enum(Object.values(OUTPUT_SHAPES)).optional(),
  requiresClarification: z.boolean().default(false),
  clarificationQuestion: z.string().trim().nullable().optional().default(null),
  unsupportedReason: z.string().trim().nullable().optional().default(null),
  confidence: z.number().min(0).max(1).optional(),
});

const INTENT_HELP = {
  [INTENTS.finance_summary]:
    'Klinik geneli finans özeti. Metric: revenue_amount, collection_amount, pending_collection_amount, outstanding_balance_amount, overdue_receivables_amount, overdue_patient_list, avg_invoice_amount, avg_payment_amount, discount_total_amount, expense_total_amount.',
  [INTENTS.clinic_patient_analysis]:
    'Klinik geneli hasta sayısı / analizi. Metric: patient_count, new_patient_count, active_patient_count, inactive_patient_count, new_patients_list, debtor_patient_list.',
  [INTENTS.patient_balance]: 'Hasta borcu/bakiyesi. Hasta gerekir. Metric: outstanding_balance_amount, patient_invoice_amount, patient_paid_amount.',
  [INTENTS.patient_summary]: 'Hasta özeti. Hasta gerekir. Metric: summary.',
  [INTENTS.patient_last_payment]: 'Hastanın son ödemesi. Hasta gerekir. Metric: last_payment.',
  [INTENTS.patient_treatment_progress]: 'Hastanın tedavi ilerleyişi. Hasta gerekir. Metric: completion_percentage, completed_treatment_value.',
  [INTENTS.patient_appointment_analysis]: 'Hasta randevu analizi. Hasta gerekir. Metric: appointment_count, patient_appointment_list, patient_treatment_list.',
  [INTENTS.doctor_schedule]: 'Doktor programı. Doktor gerekir. Metric: schedule_list.',
  [INTENTS.doctor_appointment_analysis]: 'Doktor randevu analizi. Doktor gerekir. Metric: appointment_count, appointment_list.',
  [INTENTS.doctor_treatment_performance]: 'Doktor tedavi performansı. Doktor gerekir. Metric: completed_treatment_item_count, completed_treatment_value.',
  [INTENTS.doctor_revenue_analysis]: 'Doktor gelir analizi. Doktor gerekir. Metric: doctor_revenue_amount, doctor_collection_amount, doctor_patient_count.',
  [INTENTS.clinic_appointment_analysis]: 'Klinik randevu analizi. Metric: appointment_count, appointment_list, completed_appointment_count, cancelled_appointment_count, no_show_count, no_show_rate, cancellation_rate, appointment_fill_rate, cancelled_appointments_list, no_show_patients_list.',
  [INTENTS.clinic_patient_demographics]: 'Hasta demografisi. Metric: patient_gender_ratio, appointment_patient_count_by_gender.',
  [INTENTS.clinic_treatment_analysis]: 'Tedavi analizi. Metric: treatment_item_count, completed_treatment_item_count, treatment_completion_rate, completed_treatment_list.',
  [INTENTS.clinic_inventory_analysis]: 'Stok analizi. Metric: inventory_item_count, low_stock_item_count, expiring_stock_count, stock_value_total, low_stock_list, expiring_stock_list, stock_by_category, low_stock_ratio.',
  [INTENTS.clinic_lab_analysis]: 'Lab analizi. Metric: lab_case_count, completed_lab_case_count, pending_lab_case_count, lab_cost_total, lab_completion_rate, pending_lab_list.',
  [INTENTS.clinic_financial_analytics]: 'Finansal analitik (karşılaştırma, trend, risk). Composite capabilities.',
  [INTENTS.clinic_operational_analytics]: 'Operasyonel analitik (verimlilik, kapasite). Composite capabilities.',
  [INTENTS.current_account_balance]: 'Cari hesap bakiyesi. Current account gerekir. Metric: outstanding_balance_amount, ca_overdue_amount.',
  [INTENTS.current_account_transactions]: 'Cari hesap işlem listesi. Current account gerekir. Metric: transaction_list.',
  [INTENTS.inventory_low_stock]: 'Düşük stok ürünleri. Metric: low_stock_list.',
  [INTENTS.unsupported]: 'Desteklenmeyen veya ERP dışı soru.',
};

const METRIC_HELP = {
  [METRICS.revenue_amount]: 'Ciro / gelir tutarı',
  [METRICS.collection_amount]: 'Tahsil edilen tutar',
  [METRICS.pending_collection_amount]: 'Bekleyen tahsilat',
  [METRICS.outstanding_balance_amount]: 'Açık bakiye',
  [METRICS.overdue_receivables_amount]: 'Vadesi geçmiş alacak',
  [METRICS.stock_value_total]: 'Toplam stok değeri',
  [METRICS.lab_cost_total]: 'Lab maliyet toplamı',
  [METRICS.discount_total_amount]: 'Toplam indirim',
  [METRICS.expense_total_amount]: 'Toplam gider',
  [METRICS.avg_invoice_amount]: 'Ortalama fatura tutarı',
  [METRICS.avg_payment_amount]: 'Ortalama ödeme tutarı',
  [METRICS.doctor_revenue_amount]: 'Doktor gelir tutarı',
  [METRICS.doctor_collection_amount]: 'Doktor tahsilat tutarı',
  [METRICS.patient_invoice_amount]: 'Hasta fatura toplamı',
  [METRICS.patient_paid_amount]: 'Hasta ödeme toplamı',
  [METRICS.ca_overdue_amount]: 'Cari gecikmiş tutar',
  [METRICS.completed_treatment_value]: 'Tamamlanan tedavi tutarı',
  [METRICS.patient_count]: 'Hasta sayısı',
  [METRICS.new_patient_count]: 'Yeni hasta sayısı',
  [METRICS.active_patient_count]: 'Aktif hasta sayısı',
  [METRICS.inactive_patient_count]: 'Pasif hasta sayısı',
  [METRICS.appointment_count]: 'Randevu sayısı',
  [METRICS.completed_appointment_count]: 'Tamamlanan randevu sayısı',
  [METRICS.cancelled_appointment_count]: 'İptal randevu sayısı',
  [METRICS.no_show_count]: 'Gelmeme sayısı',
  [METRICS.invoice_count]: 'Fatura sayısı',
  [METRICS.payment_count]: 'Ödeme sayısı',
  [METRICS.current_account_count]: 'Cari hesap sayısı',
  [METRICS.inventory_item_count]: 'Stok kalemi sayısı',
  [METRICS.low_stock_item_count]: 'Düşük stok sayısı',
  [METRICS.expiring_stock_count]: 'Son kullanımı yaklaşan sayısı',
  [METRICS.treatment_item_count]: 'Tedavi kalemi sayısı',
  [METRICS.completed_treatment_item_count]: 'Tamamlanan tedavi kalemi sayısı',
  [METRICS.completed_treatment_count]: 'Tamamlanan tedavi sayısı',
  [METRICS.lab_case_count]: 'Lab vakası sayısı',
  [METRICS.completed_lab_case_count]: 'Tamamlanan lab sayısı',
  [METRICS.pending_lab_case_count]: 'Bekleyen lab sayısı',
  [METRICS.doctor_patient_count]: 'Doktor hasta sayısı',
  [METRICS.doctor_cancel_count]: 'Doktor iptal sayısı',
  [METRICS.doctor_no_show_count]: 'Doktor gelmeme sayısı',
  [METRICS.appointment_list]: 'Randevu listesi',
  [METRICS.patient_appointment_list]: 'Hasta randevu listesi',
  [METRICS.overdue_patient_list]: 'Gecikmiş hasta listesi',
  [METRICS.overdue_ca_list]: 'Gecikmiş cari listesi',
  [METRICS.debtor_patient_list]: 'Borçlu hasta listesi',
  [METRICS.top_revenue_patients]: 'En çok gelirli hastalar',
  [METRICS.top_revenue_doctors]: 'En çok gelirli doktorlar',
  [METRICS.new_patients_list]: 'Yeni hasta listesi',
  [METRICS.no_show_patients_list]: 'Gelmeyen hasta listesi',
  [METRICS.cancelled_appointments_list]: 'İptal randevu listesi',
  [METRICS.pending_lab_list]: 'Bekleyen lab listesi',
  [METRICS.completed_treatment_list]: 'Tamamlanan tedavi listesi',
  [METRICS.patient_treatment_list]: 'Hasta tedavi listesi',
  [METRICS.ca_list_by_type]: 'Tip bazlı cari listesi',
  [METRICS.stock_by_category]: 'Kategori bazlı stok listesi',
  [METRICS.low_stock_list]: 'Düşük stok listesi',
  [METRICS.expiring_stock_list]: 'Son kullanımı yaklaşan listesi',
  [METRICS.transaction_list]: 'Cari işlem listesi',
  [METRICS.schedule_list]: 'Program listesi',
  [METRICS.no_show_rate]: 'Gelmeme oranı',
  [METRICS.cancellation_rate]: 'İptal oranı',
  [METRICS.collection_rate]: 'Tahsilat oranı',
  [METRICS.appointment_fill_rate]: 'Randevu doluluk oranı',
  [METRICS.treatment_completion_rate]: 'Tedavi tamamlama oranı',
  [METRICS.lab_completion_rate]: 'Lab tamamlama oranı',
  [METRICS.payment_invoice_ratio]: 'Ödeme/fatura oranı',
  [METRICS.overdue_ratio]: 'Gecikmiş alacak oranı',
  [METRICS.low_stock_ratio]: 'Düşük stok oranı',
  [METRICS.retention_rate]: 'Hasta geri dönme oranı',
  [METRICS.new_patient_ratio]: 'Yeni hasta oranı',
  [METRICS.patient_gender_ratio]: 'Cinsiyet oranı',
  [METRICS.completion_percentage]: 'Tamamlanma yüzdesi',
  [METRICS.appointment_patient_count_by_gender]: 'Cinsiyete göre hasta sayısı',
  [METRICS.new_patient_count_by_gender]: 'Cinsiyete göre yeni hasta sayısı',
  [METRICS.summary]: 'Özet',
  [METRICS.last_payment]: 'Son ödeme',
};

function inferOutputShapeFromMetric(metric) {
  if (!metric) return OUTPUT_SHAPES.summary;
  if (metric.endsWith('_list') || metric === METRICS.schedule_list) return OUTPUT_SHAPES.list;
  if (metric.startsWith('top_revenue_')) return OUTPUT_SHAPES.list;
  if (metric.endsWith('_count')) return OUTPUT_SHAPES.count;
  if (metric.endsWith('_amount') || metric.endsWith('_total') || metric.endsWith('_value')) return OUTPUT_SHAPES.amount;
  if (metric.endsWith('_rate') || metric.endsWith('_ratio') || metric === METRICS.completion_percentage) return OUTPUT_SHAPES.ratio;
  if (metric === METRICS.patient_gender_ratio) return OUTPUT_SHAPES.ratio;
  if (metric === METRICS.summary || metric === METRICS.last_payment) return OUTPUT_SHAPES.summary;
  return OUTPUT_SHAPES.summary;
}

function mapLegacyIntent(intent) {
  if (intent === LEGACY_INTENTS.clinic_collection_summary) return INTENTS.finance_summary;
  if (intent === LEGACY_INTENTS.overdue_receivables_summary) return INTENTS.finance_summary;
  return intent;
}

function mapLegacyMetric(metric, mappedIntent) {
  if (!metric) return null;
  if (metric === LEGACY_METRICS.outstanding_balance) return METRICS.outstanding_balance_amount;
  if (metric === LEGACY_METRICS.completed_value) return METRICS.completed_treatment_value;
  if (metric === LEGACY_METRICS.completed_item_count) return METRICS.completed_treatment_item_count;
  if (
    mappedIntent === INTENTS.finance_summary &&
    metric === METRICS.overdue_patient_list
  ) {
    return METRICS.overdue_patient_list;
  }
  return metric;
}

function normalizePlannerOutput(rawPlan) {
  const parsed = RawPlannerOutputSchema.parse(rawPlan || {});
  const mappedIntent = mapLegacyIntent(parsed.intent);
  const firstEntity = parsed.entities?.[0] || null;
  const metric = mapLegacyMetric(parsed.metric || parsed.metrics?.[0] || null, mappedIntent);
  const effectiveMetric = metric || METRICS.summary;
  return {
    intent: mappedIntent,
    metric: effectiveMetric,
    entityType: parsed.entityType || firstEntity?.type || ENTITY_TYPES.none,
    entityName: parsed.entityName ?? firstEntity?.name ?? null,
    timeScope: parsed.timeScope || TIME_SCOPES.none,
    filters: parsed.filters || {},
    outputShape: parsed.outputShape || inferOutputShapeFromMetric(effectiveMetric),
    requiresClarification: parsed.requiresClarification || false,
    clarificationQuestion: parsed.requiresClarification
      ? parsed.clarificationQuestion || 'Lütfen sorunuzu biraz daha netleştirin.'
      : null,
    unsupportedReason: parsed.unsupportedReason || null,
    confidence: parsed.confidence,
  };
}

module.exports = {
  INTENTS,
  ENTITY_TYPES,
  METRICS,
  TIME_SCOPES,
  OUTPUT_SHAPES,
  LEGACY_INTENTS,
  LEGACY_METRICS,
  INTENT_HELP,
  METRIC_HELP,
  PlannerEntitySchema,
  PlannerFiltersSchema,
  RawPlannerOutputSchema,
  normalizePlannerOutput,
  inferOutputShapeFromMetric,
};
