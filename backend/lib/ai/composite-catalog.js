/**
 * Composite Capability Catalog - Layer 2 analytical capabilities.
 *
 * Composite capabilities combine multiple atomic capabilities to produce
 * higher-level business analysis: comparisons, trends, distributions,
 * risk scores, and cross-domain summaries.
 *
 * Each composite defines:
 *  - composite name
 *  - dependsOn: array of atomic capability names it requires
 *  - intent: which intent triggers this composite
 *  - outputShape: what shape the combined result takes
 *  - description: human-readable purpose
 *  - executor: function name in composite-executor.js
 */

const { INTENTS, METRICS, OUTPUT_SHAPES } = require('./assistant-contracts');

const COMPOSITE_CATALOG = {
  // ═══════════════════════════════════════════════════════════════
  // REVENUE / FINANCE ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  clinic_revenue_comparison: {
    composite: 'clinic_revenue_comparison',
    dependsOn: ['clinic_revenue_amount'],
    intent: INTENTS.clinic_financial_analytics,
    metric: METRICS.revenue_amount,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Ciro geçen döneme göre karşılaştırma (delta, yüzde)',
    executor: 'executeRevenueComparison',
    triggerPatterns: ['ciro arttı mı', 'gelir değişimi', 'ciro karşılaştır', 'geçen aya göre ciro'],
  },
  clinic_collection_comparison: {
    composite: 'clinic_collection_comparison',
    dependsOn: ['clinic_collection_amount'],
    intent: INTENTS.clinic_financial_analytics,
    metric: METRICS.collection_amount,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Tahsilat geçen döneme göre karşılaştırma',
    executor: 'executeCollectionComparison',
    triggerPatterns: ['tahsilat arttı mı', 'tahsilat değişimi', 'tahsilat karşılaştır'],
  },
  collection_efficiency_summary: {
    composite: 'collection_efficiency_summary',
    dependsOn: ['clinic_collection_amount', 'clinic_revenue_amount'],
    intent: INTENTS.clinic_financial_analytics,
    metric: METRICS.collection_rate,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Tahsilat verimliliği: tahsilat/ciro oranı + değerlendirme',
    executor: 'executeCollectionEfficiency',
    triggerPatterns: ['tahsilat verimliliği', 'tahsilat oranı nasıl', 'tahsilat iyi mi'],
  },
  receivables_risk_summary: {
    composite: 'receivables_risk_summary',
    dependsOn: ['clinic_overdue_receivables_amount', 'clinic_outstanding_balance_amount', 'clinic_overdue_patient_list'],
    intent: INTENTS.clinic_financial_analytics,
    metric: METRICS.overdue_ratio,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Alacak risk özeti: gecikmiş alacak oranı, risk skoru, borçlu segment',
    executor: 'executeReceivablesRisk',
    triggerPatterns: ['alacak riski', 'tahsilat riski', 'borç riski', 'finansal risk'],
  },
  doctor_revenue_comparison: {
    composite: 'doctor_revenue_comparison',
    dependsOn: ['doctor_revenue_amount'],
    intent: INTENTS.clinic_financial_analytics,
    metric: METRICS.top_revenue_doctors,
    outputShape: OUTPUT_SHAPES.list,
    description: 'Doktor bazlı gelir sıralaması ve karşılaştırma',
    executor: 'executeDoctorRevenueComparison',
    triggerPatterns: ['doktor gelir karşılaştır', 'hangi doktor daha çok', 'doktor ciro sırala'],
  },

  // ═══════════════════════════════════════════════════════════════
  // APPOINTMENT ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  clinic_appointment_comparison: {
    composite: 'clinic_appointment_comparison',
    dependsOn: ['clinic_appointment_count'],
    intent: INTENTS.clinic_operational_analytics,
    metric: METRICS.appointment_count,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Randevu sayısı dönem karşılaştırması',
    executor: 'executeAppointmentComparison',
    triggerPatterns: ['randevu arttı mı', 'randevu karşılaştır', 'randevu geçen ay'],
  },
  cancellation_trend: {
    composite: 'cancellation_trend',
    dependsOn: ['clinic_cancellation_rate'],
    intent: INTENTS.clinic_operational_analytics,
    metric: METRICS.cancellation_rate,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'İptal trendi: oran değişimi üzerinden trend analizi',
    executor: 'executeCancellationTrend',
    triggerPatterns: ['iptal artıyor mu', 'iptal trendi', 'iptaller yükseliyor mu'],
  },
  no_show_trend: {
    composite: 'no_show_trend',
    dependsOn: ['clinic_no_show_rate'],
    intent: INTENTS.clinic_operational_analytics,
    metric: METRICS.no_show_rate,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Gelmeme trendi: oran değişimi',
    executor: 'executeNoShowTrend',
    triggerPatterns: ['gelmeme artıyor mu', 'no-show trendi', 'gelmeme yükseliyor mu'],
  },
  appointment_status_distribution: {
    composite: 'appointment_status_distribution',
    dependsOn: ['clinic_appointment_count', 'clinic_completed_appointment_count', 'clinic_cancelled_appointment_count', 'clinic_no_show_count'],
    intent: INTENTS.clinic_operational_analytics,
    metric: METRICS.appointment_count,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Randevu durum dağılımı: tamamlanan, iptal, gelmeme',
    executor: 'executeAppointmentStatusDistribution',
    triggerPatterns: ['randevu dağılımı', 'randevu durumu', 'kaçı tamamlandı kaçı iptal'],
  },
  doctor_utilization_summary: {
    composite: 'doctor_utilization_summary',
    dependsOn: ['doctor_appointment_count'],
    intent: INTENTS.clinic_operational_analytics,
    metric: METRICS.appointment_count,
    outputShape: OUTPUT_SHAPES.list,
    description: 'Doktor bazlı yoğunluk sıralaması',
    executor: 'executeDoctorUtilization',
    triggerPatterns: ['doktor yoğunluğu', 'en yoğun doktor', 'doktor takvim'],
  },

  // ═══════════════════════════════════════════════════════════════
  // PATIENT ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  patient_growth_summary: {
    composite: 'patient_growth_summary',
    dependsOn: ['clinic_new_patient_count', 'clinic_patient_count'],
    intent: INTENTS.clinic_operational_analytics,
    metric: METRICS.new_patient_count,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Hasta büyüme trendi: yeni hasta sayısı dönemsel karşılaştırma',
    executor: 'executePatientGrowth',
    triggerPatterns: ['hasta büyümesi', 'hasta artıyor mu', 'yeni hasta trendi', 'hasta kazanımı'],
  },
  patient_demographic_breakdown: {
    composite: 'patient_demographic_breakdown',
    dependsOn: ['clinic_patient_gender_ratio', 'clinic_patient_count_by_gender'],
    intent: INTENTS.clinic_patient_demographics,
    metric: METRICS.patient_gender_ratio,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Hasta cinsiyet dağılım özeti',
    executor: 'executePatientDemographicBreakdown',
    triggerPatterns: ['hasta demografisi', 'cinsiyet dağılımı', 'kadın erkek dağılımı'],
  },
  high_risk_debtors_summary: {
    composite: 'high_risk_debtors_summary',
    dependsOn: ['clinic_overdue_patient_list'],
    intent: INTENTS.clinic_financial_analytics,
    metric: METRICS.overdue_patient_list,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Yüksek riskli borçlu hasta segmenti',
    executor: 'executeHighRiskDebtors',
    triggerPatterns: ['riskli borçlu', 'en borçlu hastalar', 'borçlu segment'],
  },

  // ═══════════════════════════════════════════════════════════════
  // DOCTOR PERFORMANCE ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  doctor_performance_summary: {
    composite: 'doctor_performance_summary',
    dependsOn: ['doctor_completed_treatment_item_count', 'doctor_revenue_amount', 'doctor_appointment_count'],
    intent: INTENTS.doctor_revenue_analysis,
    metric: METRICS.summary,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Doktor performans özeti: tedavi, gelir, randevu',
    executor: 'executeDoctorPerformance',
    triggerPatterns: ['doktor performansı', 'performansım nasıl', 'doktor durumu'],
  },
  doctor_completed_treatment_comparison: {
    composite: 'doctor_completed_treatment_comparison',
    dependsOn: ['doctor_completed_treatment_item_count'],
    intent: INTENTS.doctor_treatment_performance,
    metric: METRICS.completed_treatment_item_count,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Doktor tedavi tamamlama dönem karşılaştırması',
    executor: 'executeDoctorTreatmentComparison',
    triggerPatterns: ['tedavi karşılaştır', 'doktor tedavi geçen ay'],
  },

  // ═══════════════════════════════════════════════════════════════
  // TREATMENT ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  treatment_completion_summary: {
    composite: 'treatment_completion_summary',
    dependsOn: ['clinic_treatment_item_count', 'clinic_completed_treatment_item_count'],
    intent: INTENTS.clinic_treatment_analysis,
    metric: METRICS.treatment_completion_rate,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Tedavi tamamlama özeti: oran, toplam, tamamlanan',
    executor: 'executeTreatmentCompletion',
    triggerPatterns: ['tedavi tamamlama', 'tedaviler tamamlanıyor mu', 'yarım tedavi'],
  },

  // ═══════════════════════════════════════════════════════════════
  // INVENTORY / STOCK ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  stock_risk_summary: {
    composite: 'stock_risk_summary',
    dependsOn: ['clinic_low_stock_item_count', 'clinic_expiring_stock_count', 'clinic_inventory_item_count'],
    intent: INTENTS.clinic_inventory_analysis,
    metric: METRICS.low_stock_ratio,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Stok risk özeti: düşük stok + son kullanım',
    executor: 'executeStockRisk',
    triggerPatterns: ['stok riski', 'stok durumu', 'stok problemi', 'stok sağlığı'],
  },

  // ═══════════════════════════════════════════════════════════════
  // CROSS-DOMAIN ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  clinic_health_summary: {
    composite: 'clinic_health_summary',
    dependsOn: ['clinic_revenue_amount', 'clinic_appointment_count', 'clinic_new_patient_count', 'clinic_collection_amount'],
    intent: INTENTS.clinic_operational_analytics,
    metric: METRICS.summary,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Klinik genel sağlık: ciro, randevu, hasta, tahsilat KPI özeti',
    executor: 'executeClinicHealth',
    triggerPatterns: ['işimiz nasıl', 'klinik sağlığı', 'genel durum', 'klinik özet', 'bu ay nasıl gidiyor'],
  },
  operational_efficiency_summary: {
    composite: 'operational_efficiency_summary',
    dependsOn: ['clinic_appointment_count', 'clinic_no_show_rate', 'clinic_cancellation_rate'],
    intent: INTENTS.clinic_operational_analytics,
    metric: METRICS.appointment_fill_rate,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Operasyonel verimlilik: doluluk, gelmeme, iptal',
    executor: 'executeOperationalEfficiency',
    triggerPatterns: ['operasyonel verimlilik', 'verimli miyiz', 'takvim verimi'],
  },
  financial_risk_summary: {
    composite: 'financial_risk_summary',
    dependsOn: ['clinic_overdue_receivables_amount', 'clinic_outstanding_balance_amount', 'clinic_collection_amount', 'clinic_revenue_amount'],
    intent: INTENTS.clinic_financial_analytics,
    metric: METRICS.overdue_ratio,
    outputShape: OUTPUT_SHAPES.summary,
    description: 'Finansal risk haritası: gecikmiş alacak, tahsilat oranı, nakit akış riski',
    executor: 'executeFinancialRisk',
    triggerPatterns: ['finansal risk', 'nakit akışı', 'en büyük risk', 'para riski'],
  },
};

/**
 * Look up a composite capability by name.
 */
function getComposite(name) {
  return COMPOSITE_CATALOG[name] || null;
}

/**
 * List all composite capabilities.
 */
function listComposites() {
  return Object.values(COMPOSITE_CATALOG);
}

/**
 * Find composite capabilities that match the given intent + metric combination.
 * Also checks trigger patterns against the user query for composite detection.
 */
function findMatchingComposite(intent, metric, query) {
  const foldedQuery = (query || '').toLowerCase();
  const composites = Object.values(COMPOSITE_CATALOG);

  // 1. Exact intent + metric match
  const exactMatch = composites.find(
    (c) => c.intent === intent && c.metric === metric
  );
  if (exactMatch) return exactMatch;

  // 2. Trigger pattern match against query
  for (const c of composites) {
    if (!c.triggerPatterns) continue;
    for (const pattern of c.triggerPatterns) {
      if (foldedQuery.includes(pattern)) return c;
    }
  }

  return null;
}

/**
 * Check if a plan should be routed to a composite instead of atomic.
 * Returns the composite entry or null.
 */
function detectComposite(plan, query) {
  if (!plan) return null;

  // Comparison queries always try composite first
  if (plan.filters?.compareToPrevious) {
    const composites = Object.values(COMPOSITE_CATALOG);
    const compMatch = composites.find(
      (c) => c.metric === plan.metric && c.composite.includes('comparison')
    );
    if (compMatch) return compMatch;
  }

  return findMatchingComposite(plan.intent, plan.metric, query);
}

module.exports = {
  COMPOSITE_CATALOG,
  getComposite,
  listComposites,
  findMatchingComposite,
  detectComposite,
};
