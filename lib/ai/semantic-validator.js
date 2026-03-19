const { INTENTS, METRICS, TIME_SCOPES, OUTPUT_SHAPES, inferOutputShapeFromMetric } = require('./assistant-contracts');

function clonePlan(plan) {
  return {
    ...plan,
    filters: { ...(plan?.filters || {}) },
  };
}

/**
 * Deterministic pre-hint overrides.
 * Catches gross mismatches between user query patterns and planner output
 * BEFORE applying semantic hints.
 * Returns the corrected plan (mutated clone).
 */
function applyDeterministicOverrides(plan, analysis) {
  const next = clonePlan(plan);
  const metricHint = analysis?.primaryMetricHint;
  const intentHint = analysis?.intentHint;
  const currentShape = inferOutputShapeFromMetric(next.metric);

  // 1. User says "hasta sayısı" but planner picked appointment_count → force patient_count
  if (
    metricHint === METRICS.patient_count &&
    next.metric === METRICS.appointment_count
  ) {
    next.metric = METRICS.patient_count;
    next.intent = INTENTS.clinic_patient_analysis;
    next.outputShape = OUTPUT_SHAPES.count;
    next._deterministicOverride = 'patient_count_forced';
  }

  // 2. User says "listele" but plan has a count shape → switch to list variant
  if (
    analysis?.listIntent &&
    currentShape === OUTPUT_SHAPES.count &&
    next.metric?.endsWith('_count')
  ) {
    const listMetric = next.metric.replace('_count', '_list');
    // Only override if the list metric exists
    if (Object.values(METRICS).includes(listMetric)) {
      next.metric = listMetric;
      next.outputShape = OUTPUT_SHAPES.list;
      next._deterministicOverride = 'list_from_count_forced';
    }
  }

  // 3. User says "kadın hasta oranı" but planner picked patient_count → demographics
  if (
    metricHint === METRICS.patient_gender_ratio &&
    (next.metric === METRICS.patient_count || next.metric === METRICS.appointment_count)
  ) {
    next.metric = METRICS.patient_gender_ratio;
    next.intent = intentHint || INTENTS.clinic_patient_demographics;
    next.outputShape = OUTPUT_SHAPES.ratio;
    next._deterministicOverride = 'gender_ratio_forced';
  }

  // 4. User says "gelmeme oranı" or "no-show" but planner picked appointment_count
  if (
    metricHint === METRICS.no_show_rate &&
    next.metric !== METRICS.no_show_rate
  ) {
    next.metric = METRICS.no_show_rate;
    next.intent = INTENTS.clinic_appointment_analysis;
    next.outputShape = OUTPUT_SHAPES.ratio;
    next._deterministicOverride = 'no_show_rate_forced';
  }

  // 5. User says "iptal oranı" but planner picked appointment_count
  if (
    metricHint === METRICS.cancellation_rate &&
    next.metric !== METRICS.cancellation_rate
  ) {
    next.metric = METRICS.cancellation_rate;
    next.intent = INTENTS.clinic_appointment_analysis;
    next.outputShape = OUTPUT_SHAPES.ratio;
    next._deterministicOverride = 'cancellation_rate_forced';
  }

  return next;
}

function isFinancePlan(plan) {
  return plan?.intent === INTENTS.finance_summary;
}

function applySemanticHints(plan, analysis, memory = null) {
  const next = clonePlan(plan);

  if (analysis.inheritanceHint && memory?.lastQueryState) {
    if ((!next.metric || next.metric === 'summary') && analysis.inheritedMetric) {
      next.metric = analysis.inheritedMetric;
    }
    if (analysis.inheritedIntent && (next.intent === INTENTS.unsupported || !next.intent)) {
      next.intent = analysis.inheritedIntent;
    }
    if (next.timeScope === TIME_SCOPES.none && analysis.inheritedTimeScope) {
      next.timeScope = analysis.inheritedTimeScope;
    }
    if (next.entityType === 'none' && analysis.inheritedEntityType) {
      next.entityType = analysis.inheritedEntityType;
      if (analysis.inheritedEntityType === 'doctor' && memory.lastResolvedDoctor?.name) {
        next.entityName = memory.lastResolvedDoctor.name;
      } else if (analysis.inheritedEntityType === 'patient' && memory.lastResolvedPatient?.name) {
        next.entityName = memory.lastResolvedPatient.name;
      } else if (analysis.inheritedEntityType === 'current_account' && memory.lastResolvedCurrentAccount?.name) {
        next.entityName = memory.lastResolvedCurrentAccount.name;
      }
    }
    next.filters = {
      ...(analysis.inheritedFilters || {}),
      ...(next.filters || {}),
    };
  }

  if ((!next.metric || next.metric === 'summary') && analysis.primaryMetricHint) {
    next.metric = analysis.primaryMetricHint;
  }

  if (analysis.timeScopeHint && next.timeScope === TIME_SCOPES.none) {
    next.timeScope = analysis.timeScopeHint;
  }

  if (analysis.filtersHint?.compareToPrevious && !next.filters.compareToPrevious) {
    next.filters.compareToPrevious = true;
    next.filters.comparisonPeriod = analysis.filtersHint.comparisonPeriod || 'previous_month';
  }

  if (analysis.filtersHint?.month && !next.filters.month) {
    next.filters.month = analysis.filtersHint.month;
  }
  if (analysis.filtersHint?.year && !next.filters.year) {
    next.filters.year = analysis.filtersHint.year;
  }

  if (
    analysis.isCorrection &&
    memory?.lastQueryState?.intent === INTENTS.finance_summary &&
    (next.timeScope === TIME_SCOPES.none || !next.timeScope) &&
    memory.lastQueryState.timeScope
  ) {
    next.timeScope = memory.lastQueryState.timeScope;
    next.filters = {
      ...(memory.lastQueryState.filters || {}),
      ...(next.filters || {}),
    };
  }

  return next;
}

function buildCorrectionPlan(plan, analysis, memory = null) {
  const hasCorrection = analysis.isCorrection && analysis.primaryMetricHint;
  const hasInheritance = analysis.inheritanceHint && (analysis.inheritedMetric || analysis.inheritedIntent);
  if (!hasCorrection && !hasInheritance) return null;
  if (hasCorrection && !hasInheritance && memory?.lastQueryState?.intent !== INTENTS.finance_summary) return null;

  const next = applySemanticHints(plan, analysis, memory);
  next.intent = analysis.inheritedIntent || (hasCorrection ? INTENTS.finance_summary : next.intent);
  next.metric = analysis.inheritedMetric || analysis.primaryMetricHint || next.metric;
  next.entityType = plan.entityType || analysis.inheritedEntityType || 'none';
  next.entityName = plan.entityName ?? (analysis.inheritedEntityType === 'doctor' && memory?.lastResolvedDoctor?.name
    ? memory.lastResolvedDoctor.name
    : analysis.inheritedEntityType === 'patient' && memory?.lastResolvedPatient?.name
      ? memory.lastResolvedPatient.name
      : analysis.inheritedEntityType === 'current_account' && memory?.lastResolvedCurrentAccount?.name
        ? memory.lastResolvedCurrentAccount.name
        : null);
  next.requiresClarification = false;
  next.clarificationQuestion = null;
  next.unsupportedReason = null;

  if ((next.timeScope === TIME_SCOPES.none || !next.timeScope) && memory?.lastQueryState?.timeScope) {
    next.timeScope = memory.lastQueryState.timeScope;
  }

  next.filters = {
    ...(memory?.lastQueryState?.filters || {}),
    ...(next.filters || {}),
    ...(analysis.filtersHint || {}),
  };

  return next;
}

function buildSemanticFallbackPlan(analysis, memory = null) {
  const metricHint = analysis?.primaryMetricHint || analysis?.inheritedMetric;
  const intentHint = analysis?.intentHint || analysis?.inheritedIntent;
  if (!metricHint || !intentHint) return null;

  const filters = {
    ...(analysis.filtersHint || {}),
    ...(analysis.inheritedFilters || {}),
  };
  let timeScope = analysis.timeScopeHint || analysis.inheritedTimeScope || TIME_SCOPES.none;

  if (
    (analysis.isCorrection || analysis.inheritanceHint) &&
    memory?.lastQueryState?.intent === intentHint
  ) {
    timeScope = timeScope === TIME_SCOPES.none ? memory.lastQueryState.timeScope || TIME_SCOPES.none : timeScope;
    Object.assign(filters, memory.lastQueryState.filters || {});
    Object.assign(filters, analysis.filtersHint || {});
  }

  let entityType = analysis.inheritedEntityType || 'none';
  let entityName = null;
  if (entityType === 'doctor' && memory?.lastResolvedDoctor?.name) {
    entityName = memory.lastResolvedDoctor.name;
  } else if (entityType === 'patient' && memory?.lastResolvedPatient?.name) {
    entityName = memory.lastResolvedPatient.name;
  } else if (entityType === 'current_account' && memory?.lastResolvedCurrentAccount?.name) {
    entityName = memory.lastResolvedCurrentAccount.name;
  }

  return {
    intent: intentHint,
    metric: metricHint,
    entityType,
    entityName,
    timeScope,
    filters,
    requiresClarification: false,
    clarificationQuestion: null,
    unsupportedReason: null,
    confidence: 0.7,
  };
}

function validateSemanticAlignment({ analysis, plan, memory = null }) {
  // Apply deterministic overrides first (catches gross mismatches)
  const overriddenPlan = applyDeterministicOverrides(plan, analysis);
  const adjustedPlan = applySemanticHints(overriddenPlan, analysis, memory);
  const planChanged = JSON.stringify(adjustedPlan) !== JSON.stringify(plan);
  const expectedMetric = analysis.primaryMetricHint || null;
  const actualMetric = adjustedPlan.metric || null;

  if (!expectedMetric && !analysis.inheritanceHint) {
    return {
      status: planChanged ? 'patched' : 'ok',
      semanticMismatch: false,
      adjustedPlan,
      replanContext: null,
    };
  }

  if (analysis.inheritanceHint && memory?.lastQueryState && (analysis.inheritedMetric || analysis.inheritedIntent)) {
    const inheritedPlan = buildCorrectionPlan(plan, analysis, memory);
    if (inheritedPlan) {
      return {
        status: 'corrected',
        semanticMismatch: false,
        adjustedPlan: inheritedPlan,
        correctionApplied: true,
        inheritanceApplied: true,
        replanContext: null,
      };
    }
  }

  if (analysis.isCorrection && memory?.lastQueryState?.intent === INTENTS.finance_summary) {
    const correctedPlan = buildCorrectionPlan(adjustedPlan, analysis, memory);
    if (correctedPlan && correctedPlan.metric === expectedMetric) {
      return {
        status: 'corrected',
        semanticMismatch: false,
        adjustedPlan: correctedPlan,
        correctionApplied: true,
        replanContext: null,
      };
    }
  }

  const intentMismatch = analysis.intentHint && adjustedPlan.intent !== analysis.intentHint;
  const metricMismatch = actualMetric !== expectedMetric;

  if (!intentMismatch && !metricMismatch) {
    return {
      status: planChanged ? 'patched' : 'ok',
      semanticMismatch: false,
      adjustedPlan,
      replanContext: null,
    };
  }

  return {
    status: 'semantic_mismatch',
    semanticMismatch: true,
    adjustedPlan,
    expectedMetric,
    actualMetric,
    mismatchReason: intentMismatch
      ? `raw_query_implies_${analysis.intentHint}_not_${adjustedPlan.intent}`
      : `raw_query_implies_${expectedMetric}_not_${actualMetric}`,
    shouldReplan: true,
    replanContext: {
      forcedIntent: analysis.intentHint || adjustedPlan.intent,
      forcedMetric: expectedMetric,
      forceTimeScope:
        adjustedPlan.timeScope === TIME_SCOPES.none ? analysis.timeScopeHint : adjustedPlan.timeScope,
      filters: {
        ...(memory?.lastQueryState?.intent === INTENTS.finance_summary ? memory.lastQueryState.filters || {} : {}),
        ...(adjustedPlan.filters || {}),
        ...(analysis.filtersHint || {}),
      },
      correctionContext: analysis.correctionContext,
      glossaryMatches: analysis.glossaryMatches || [],
    },
  };
}

module.exports = {
  applySemanticHints,
  applyDeterministicOverrides,
  buildCorrectionPlan,
  buildSemanticFallbackPlan,
  validateSemanticAlignment,
};
