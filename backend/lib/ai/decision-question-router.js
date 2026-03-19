/**
 * Decision Question Router - Layer 3 product-facing question routing.
 *
 * Routes natural language user questions to atomic or composite capabilities.
 * This is the product layer that maps real-world user intent patterns to
 * the technical capability system underneath.
 *
 * Key responsibilities:
 *  - Match question families to capability chains
 *  - Handle follow-up rerouting (e.g. "listele" → re-routes to list variant)
 *  - Detect composite intent (comparison, trend, risk analysis)
 *  - Pass-through to planner when no deterministic match
 */

const { INTENTS, METRICS } = require('./assistant-contracts');
const { getCapability, getListVariantMetric } = require('./capability-catalog');
const { detectComposite } = require('./composite-catalog');

/**
 * Question families define product-level question patterns and their capability mappings.
 * Each family has:
 *  - patterns: Turkish phrases that trigger this family
 *  - routes: what atomic/composite capability to invoke
 *  - followUpHints: how to handle follow-ups after this family
 */
const QUESTION_FAMILIES = [
  // ── General health / "how are we doing" ──
  {
    family: 'clinic_health',
    patterns: [
      'işimiz nasıl', 'nasıl gidiyor', 'genel durum', 'klinik durumu',
      'klinik sağlığı', 'özet ver', 'genel özet', 'bu ay nasıl',
    ],
    routes: { composite: 'clinic_health_summary' },
  },

  // ── Revenue ──
  {
    family: 'revenue_query',
    patterns: ['ciro', 'gelir', 'hasılat', 'kazanç'],
    routes: { intent: INTENTS.finance_summary, metric: METRICS.revenue_amount },
    comparisonRoutes: { composite: 'clinic_revenue_comparison' },
  },

  // ── Collection ──
  {
    family: 'collection_query',
    patterns: ['tahsilat', 'tahsil edilen', 'tahsil'],
    routes: { intent: INTENTS.finance_summary, metric: METRICS.collection_amount },
    comparisonRoutes: { composite: 'clinic_collection_comparison' },
  },

  // ── Pending / overdue ──
  {
    family: 'pending_collection',
    patterns: ['bekleyen tahsilat', 'açık fatura', 'bekleyen alacak'],
    routes: { intent: INTENTS.finance_summary, metric: METRICS.pending_collection_amount },
  },
  {
    family: 'overdue_patients',
    patterns: [
      'borçlu hasta', 'gecikmiş hasta', 'vadesi geçmiş', 'taksit gecikmiş',
      'ödeme gecikmiş', 'borçlu kim', 'borcu olan',
    ],
    routes: { intent: INTENTS.finance_summary, metric: METRICS.overdue_patient_list },
  },

  // ── Appointments ──
  {
    family: 'appointment_count',
    patterns: ['kaç randevu', 'randevu sayısı', 'randevu kaç'],
    routes: { intent: INTENTS.clinic_appointment_analysis, metric: METRICS.appointment_count },
    comparisonRoutes: { composite: 'clinic_appointment_comparison' },
    listVariant: { metric: METRICS.appointment_list },
  },
  {
    family: 'no_show',
    patterns: ['gelmeme', 'gelmeyen', 'no-show', 'noshow', 'randevuya gelmedi'],
    routes: { intent: INTENTS.clinic_appointment_analysis, metric: METRICS.no_show_rate },
    listVariant: { metric: METRICS.no_show_patients_list },
    trendRoutes: { composite: 'no_show_trend' },
  },
  {
    family: 'cancellation',
    patterns: ['iptal', 'iptal edilen', 'randevu iptal'],
    routes: { intent: INTENTS.clinic_appointment_analysis, metric: METRICS.cancellation_rate },
    listVariant: { metric: METRICS.cancelled_appointments_list },
    trendRoutes: { composite: 'cancellation_trend' },
  },

  // ── Patients ──
  {
    family: 'patient_count',
    patterns: ['kaç hasta', 'hasta sayısı', 'toplam hasta', 'hastamız'],
    routes: { intent: INTENTS.clinic_patient_analysis, metric: METRICS.patient_count },
  },
  {
    family: 'new_patients',
    patterns: ['yeni hasta', 'yeni gelen', 'ilk kez gelen'],
    routes: { intent: INTENTS.clinic_patient_analysis, metric: METRICS.new_patient_count },
    listVariant: { metric: METRICS.new_patients_list },
    trendRoutes: { composite: 'patient_growth_summary' },
  },

  // ── Doctor performance ──
  {
    family: 'doctor_performance',
    patterns: ['doktor performans', 'performansım', 'en iyi doktor', 'hangi doktor'],
    routes: { composite: 'doctor_performance_summary' },
  },
  {
    family: 'doctor_revenue',
    patterns: ['doktor gelir', 'doktor ciro', 'doktorlar karşılaştır'],
    routes: { composite: 'doctor_revenue_comparison' },
  },

  // ── Treatment ──
  {
    family: 'treatment_stats',
    patterns: ['tedavi tamamla', 'tamamlanan tedavi', 'tedavi sayısı', 'yarım tedavi'],
    routes: { intent: INTENTS.clinic_treatment_analysis, metric: METRICS.treatment_completion_rate },
  },

  // ── Stock / Inventory ──
  {
    family: 'stock_risk',
    patterns: ['stok riski', 'stok durumu', 'stok problemi', 'stok sağlığı', 'eksik malzeme'],
    routes: { composite: 'stock_risk_summary' },
  },
  {
    family: 'low_stock',
    patterns: ['düşük stok', 'azalan stok', 'biten stok', 'kritik stok'],
    routes: { intent: INTENTS.inventory_low_stock, metric: METRICS.low_stock_list },
  },
  {
    family: 'expiring_stock',
    patterns: ['son kullanım', 'son kullanma', 'tarihi geçen', 'süresi dolan'],
    routes: { intent: INTENTS.clinic_inventory_analysis, metric: METRICS.expiring_stock_list },
  },

  // ── Lab ──
  {
    family: 'lab_pending',
    patterns: ['bekleyen lab', 'lab işi', 'laboratuvar bekleyen', 'protez bekleyen'],
    routes: { intent: INTENTS.clinic_lab_analysis, metric: METRICS.pending_lab_list },
  },

  // ── Financial risk ──
  {
    family: 'financial_risk',
    patterns: ['finansal risk', 'nakit akışı', 'para riski', 'en büyük risk'],
    routes: { composite: 'financial_risk_summary' },
  },

  // ── Efficiency ──
  {
    family: 'efficiency',
    patterns: ['verimlilik', 'verimli miyiz', 'operasyonel', 'kapasite'],
    routes: { composite: 'operational_efficiency_summary' },
  },
];

/**
 * Follow-up intent patterns that reroute the previous capability.
 */
const FOLLOW_UP_REROUTERS = {
  list: {
    patterns: ['listele', 'isimleriyle', 'detaylı', 'kimler', 'hangileri', 'listesini ver'],
    action: 'reroute_to_list',
  },
  compare: {
    patterns: ['karşılaştır', 'geçen ay', 'geçen aya göre', 'artış mı', 'arttı mı', 'düştü mü', 'fark ne'],
    action: 'reroute_to_comparison',
  },
  trend: {
    patterns: ['trend', 'artıyor mu', 'yükseliyor mu', 'düşüyor mu', 'değişimi', 'seyri'],
    action: 'reroute_to_trend',
  },
  detail: {
    patterns: ['detay ver', 'daha fazla', 'açıkla', 'neden', 'niye'],
    action: 'reroute_to_summary',
  },
};

/**
 * Route a user query through the decision question layer.
 *
 * @param {string} query - Raw user query (Turkish)
 * @param {Object} plan - Normalized planner output (or null for pre-planner routing)
 * @param {Object} memory - Conversation memory for follow-up context
 * @returns {Object|null} - Route result or null if no deterministic match
 *   { type: 'atomic'|'composite', intent, metric, composite, isFollowUp }
 */
function routeDecisionQuestion(query, plan, memory) {
  const foldedQuery = (query || '').toLocaleLowerCase('tr');

  // 1. Check follow-up rerouting if we have memory of a previous capability
  if (memory?.lastCapability) {
    const followUp = detectFollowUp(foldedQuery, memory.lastCapability, plan);
    if (followUp) return followUp;
  }

  // 2. Match against question families
  for (const family of QUESTION_FAMILIES) {
    const matched = family.patterns.some((p) => foldedQuery.includes(p));
    if (!matched) continue;

    // Check for comparison sub-intent
    if (family.comparisonRoutes && isComparisonQuery(foldedQuery)) {
      return {
        type: 'composite',
        composite: family.comparisonRoutes.composite,
        family: family.family,
        isFollowUp: false,
      };
    }

    // Check for trend sub-intent
    if (family.trendRoutes && isTrendQuery(foldedQuery)) {
      return {
        type: 'composite',
        composite: family.trendRoutes.composite,
        family: family.family,
        isFollowUp: false,
      };
    }

    // Check for list request
    if (family.listVariant && isListRequest(foldedQuery)) {
      return {
        type: 'atomic',
        intent: family.routes.intent || plan?.intent,
        metric: family.listVariant.metric,
        family: family.family,
        isFollowUp: false,
      };
    }

    // Default route
    if (family.routes.composite) {
      return {
        type: 'composite',
        composite: family.routes.composite,
        family: family.family,
        isFollowUp: false,
      };
    }

    return {
      type: 'atomic',
      intent: family.routes.intent,
      metric: family.routes.metric,
      family: family.family,
      isFollowUp: false,
    };
  }

  // 3. Check composite detection from plan
  if (plan) {
    const comp = detectComposite(plan, query);
    if (comp) {
      return {
        type: 'composite',
        composite: comp.composite,
        family: null,
        isFollowUp: false,
      };
    }
  }

  return null; // No deterministic match — let planner handle it
}

/**
 * Detect if the query is a follow-up that should reroute the previous capability.
 */
function detectFollowUp(foldedQuery, lastCapability, plan) {
  for (const [key, rerouter] of Object.entries(FOLLOW_UP_REROUTERS)) {
    const matched = rerouter.patterns.some((p) => foldedQuery.includes(p));
    if (!matched) continue;

    switch (rerouter.action) {
      case 'reroute_to_list': {
        const listMetric = getListVariantMetric(lastCapability.intent, lastCapability.metric);
        if (listMetric) {
          return {
            type: 'atomic',
            intent: lastCapability.intent,
            metric: listMetric,
            isFollowUp: true,
            followUpType: 'list',
          };
        }
        break;
      }
      case 'reroute_to_comparison': {
        const comp = detectComposite(
          { ...lastCapability, filters: { compareToPrevious: true } },
          foldedQuery
        );
        if (comp) {
          return {
            type: 'composite',
            composite: comp.composite,
            isFollowUp: true,
            followUpType: 'comparison',
          };
        }
        break;
      }
      case 'reroute_to_trend': {
        // Find matching trend composite for the last capability's metric
        const comp = detectComposite(lastCapability, foldedQuery);
        if (comp) {
          return {
            type: 'composite',
            composite: comp.composite,
            isFollowUp: true,
            followUpType: 'trend',
          };
        }
        break;
      }
      case 'reroute_to_summary': {
        return {
          type: 'atomic',
          intent: lastCapability.intent,
          metric: lastCapability.metric,
          isFollowUp: true,
          followUpType: 'detail',
        };
      }
    }
  }
  return null;
}

// ── Helper functions ──

function isComparisonQuery(foldedQuery) {
  const COMPARISON_PATTERNS = [
    'karşılaştır', 'geçen aya göre', 'geçen ay', 'artış', 'düşüş',
    'değişim', 'fark', 'arttı mı', 'düştü mü', 'artmış mı',
  ];
  return COMPARISON_PATTERNS.some((p) => foldedQuery.includes(p));
}

function isTrendQuery(foldedQuery) {
  const TREND_PATTERNS = [
    'trend', 'artıyor mu', 'yükseliyor mu', 'düşüyor mu', 'seyri',
    'gidişat', 'son aylar', 'aylık değişim',
  ];
  return TREND_PATTERNS.some((p) => foldedQuery.includes(p));
}

function isListRequest(foldedQuery) {
  const LIST_PATTERNS = [
    'listele', 'listesini', 'isimleriyle', 'kimler', 'hangileri',
    'sırala', 'göster', 'detaylı',
  ];
  return LIST_PATTERNS.some((p) => foldedQuery.includes(p));
}

module.exports = {
  QUESTION_FAMILIES,
  FOLLOW_UP_REROUTERS,
  routeDecisionQuestion,
  detectFollowUp,
  isComparisonQuery,
  isTrendQuery,
  isListRequest,
};
