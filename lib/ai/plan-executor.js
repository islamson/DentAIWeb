const {
  INTENTS,
  METRICS,
  TIME_SCOPES,
  normalizePlannerOutput,
} = require('./assistant-contracts');
const {
  resolvePatientByName,
  resolveDoctorByName,
  resolveCurrentAccountByName,
} = require('./entity-resolver-v2');
const {
  getIntentPolicy,
  selectApprovedRetrieval,
  assertRetrievalPermission,
  FINANCE_RETRIEVAL_CATALOGUE,
} = require('./approved-retrievals');
const { canCompare } = require('./comparison-matrix');

const TIME_BOUND_INTENTS = new Set([
  INTENTS.finance_summary,
  INTENTS.doctor_schedule,
  INTENTS.doctor_appointment_analysis,
  INTENTS.doctor_treatment_performance,
  INTENTS.clinic_appointment_analysis,
  INTENTS.clinic_patient_demographics,
  INTENTS.doctor_revenue_analysis,
  INTENTS.patient_appointment_analysis,
  INTENTS.clinic_treatment_analysis,
  INTENTS.clinic_financial_analytics,
  INTENTS.clinic_operational_analytics,
  INTENTS.clinic_patient_analysis,
]);

function inferClarificationType(question, plan, candidates) {
  const q = (question || '').toLowerCase();
  if (plan?.entityType === 'patient') return 'missing_patient';
  if (plan?.entityType === 'doctor') return 'missing_doctor';
  if (plan?.entityType === 'current_account') return 'missing_current_account';
  if (q.includes('dönem') || q.includes('hangi dönem') || q.includes('ay') || q.includes('tarih')) return 'missing_time_scope';
  if (q.includes('finans') && q.includes('dönem')) return 'missing_time_scope_finance';
  if (q.includes('özel') && q.includes('ay')) return 'missing_custom_range';
  if (q.includes('metrik') || q.includes('neyi')) return 'missing_metric';
  if (q.includes('hasta')) return 'missing_patient';
  if (q.includes('doktor')) return 'missing_doctor';
  if (q.includes('cari') || q.includes('firma')) return 'missing_current_account';
  return 'generic';
}

function defaultMetricForIntent(intent) {
  switch (intent) {
    case INTENTS.finance_summary:
      return null;
    case INTENTS.clinic_patient_analysis:
      return METRICS.patient_count;
    case INTENTS.patient_balance:
    case INTENTS.current_account_balance:
      return METRICS.outstanding_balance_amount;
    case INTENTS.patient_summary:
      return METRICS.summary;
    case INTENTS.patient_last_payment:
      return METRICS.last_payment;
    case INTENTS.patient_treatment_progress:
      return METRICS.completion_percentage;
    case INTENTS.doctor_schedule:
      return METRICS.schedule_list;
    case INTENTS.doctor_appointment_analysis:
    case INTENTS.clinic_appointment_analysis:
    case INTENTS.patient_appointment_analysis:
      return METRICS.appointment_count;
    case INTENTS.clinic_patient_demographics:
      return METRICS.appointment_patient_count_by_gender;
    case INTENTS.doctor_treatment_performance:
      return METRICS.completed_treatment_item_count;
    case INTENTS.current_account_transactions:
      return METRICS.transaction_list;
    case INTENTS.inventory_low_stock:
      return METRICS.low_stock_list;
    case INTENTS.doctor_revenue_analysis:
      return METRICS.doctor_revenue_amount;
    case INTENTS.clinic_treatment_analysis:
      return METRICS.completed_treatment_count;
    case INTENTS.clinic_inventory_analysis:
      return METRICS.low_stock_list;
    case INTENTS.clinic_lab_analysis:
      return METRICS.summary;
    case INTENTS.clinic_financial_analytics:
      return METRICS.summary;
    case INTENTS.clinic_operational_analytics:
      return METRICS.summary;
    default:
      return METRICS.summary;
  }
}

function normalizePlanForExecution(rawPlan, memory = null) {
  const plan = normalizePlannerOutput(rawPlan);
  const next = {
    ...plan,
    filters: { ...(plan.filters || {}) },
  };

  const doctorEntity = next.entityType === 'doctor';
  const currentAccountEntity = next.entityType === 'current_account';

  if (next.intent === INTENTS.clinic_appointment_analysis && doctorEntity) {
    next.intent = INTENTS.doctor_appointment_analysis;
  }
  if (next.intent === INTENTS.patient_balance && currentAccountEntity) {
    next.intent = INTENTS.current_account_balance;
  }

  if (
    next.timeScope === TIME_SCOPES.none &&
    TIME_BOUND_INTENTS.has(next.intent) &&
    memory?.lastQueryState?.timeScope
  ) {
    next.timeScope = memory.lastQueryState.timeScope;
    next.filters = {
      ...(memory.lastQueryState.filters || {}),
      ...next.filters,
    };
  }

  const fallbackMetric = defaultMetricForIntent(next.intent);
  const primaryMetric = next.metric;
  if (
    fallbackMetric &&
    (!primaryMetric || (primaryMetric === METRICS.summary && fallbackMetric !== METRICS.summary))
  ) {
    next.metric = fallbackMetric;
  }

  if (
    memory?.lastQueryState &&
    memory.lastQueryState.intent === next.intent &&
    (next.metric === METRICS.summary || !next.metric || !next.timeScope || next.timeScope === TIME_SCOPES.none)
  ) {
    if (memory.lastQueryState.metric && (!next.metric || next.metric === METRICS.summary)) {
      next.metric = memory.lastQueryState.metric;
    }
    if (memory.lastQueryState.timeScope && (!next.timeScope || next.timeScope === TIME_SCOPES.none)) {
      next.timeScope = memory.lastQueryState.timeScope;
    }
    if (next.entityType === 'none' && memory.lastQueryState.lastEntityType) {
      next.entityType = memory.lastQueryState.lastEntityType;
      if (memory.lastQueryState.lastEntityType === 'doctor' && memory.lastResolvedDoctor?.name) {
        next.entityName = memory.lastResolvedDoctor.name;
      } else if (memory.lastQueryState.lastEntityType === 'patient' && memory.lastResolvedPatient?.name) {
        next.entityName = memory.lastResolvedPatient.name;
      } else if (memory.lastQueryState.lastEntityType === 'current_account' && memory.lastResolvedCurrentAccount?.name) {
        next.entityName = memory.lastResolvedCurrentAccount.name;
      }
    }
    next.filters = {
      ...(memory.lastQueryState.filters || {}),
      ...next.filters,
    };
  }

  return next;
}

function buildClarification(message, candidates = null) {
  return {
    clarificationNeeded: true,
    clarificationQuestion: message,
    candidates: candidates || null,
  };
}

async function resolveEntityReference(ctx, entity, memory = null) {
  if (!entity) return { resolved: null };

  if (entity.type === 'patient') {
    if (entity.name) {
      const result = await resolvePatientByName(ctx, entity.name);
      if (!result) return { clarification: buildClarification('Belirttiğiniz hasta bulunamadı.') };
      if (result.needsClarification) {
        return {
          clarification: buildClarification(
            'Birden fazla hasta eşleşti. Hangisini kastediyorsunuz?',
            result.candidates
          ),
        };
      }
      return { resolved: { type: 'patient', id: result.id, name: result.name } };
    }
    if (memory?.lastResolvedPatient?.id) {
      return {
        resolved: {
          type: 'patient',
          id: memory.lastResolvedPatient.id,
          name: memory.lastResolvedPatient.name,
        },
      };
    }
    return { clarification: buildClarification('Hangi hastayı kastediyorsunuz?') };
  }

  if (entity.type === 'doctor') {
    if (entity.name) {
      const result = await resolveDoctorByName(ctx, entity.name);
      if (!result) return { clarification: buildClarification('Belirttiğiniz doktor bulunamadı.') };
      if (result.needsClarification) {
        return {
          clarification: buildClarification(
            'Birden fazla doktor eşleşti. Hangisini kastediyorsunuz?',
            result.candidates
          ),
        };
      }
      return { resolved: { type: 'doctor', id: result.id, name: result.name } };
    }
    if (memory?.lastResolvedDoctor?.id) {
      return {
        resolved: {
          type: 'doctor',
          id: memory.lastResolvedDoctor.id,
          name: memory.lastResolvedDoctor.name,
        },
      };
    }
    return { clarification: buildClarification('Hangi doktoru kastediyorsunuz?') };
  }

  if (entity.type === 'current_account') {
    if (entity.name) {
      const result = await resolveCurrentAccountByName(ctx, entity.name);
      if (!result) return { clarification: buildClarification('Belirttiğiniz cari hesap bulunamadı.') };
      if (result.needsClarification) {
        return {
          clarification: buildClarification(
            'Birden fazla cari hesap eşleşti. Hangisini kastediyorsunuz?',
            result.candidates
          ),
        };
      }
      return { resolved: { type: 'current_account', id: result.id, name: result.name } };
    }
    if (memory?.lastResolvedCurrentAccount?.id) {
      return {
        resolved: {
          type: 'current_account',
          id: memory.lastResolvedCurrentAccount.id,
          name: memory.lastResolvedCurrentAccount.name,
        },
      };
    }
    return { clarification: buildClarification('Hangi cari hesabı kastediyorsunuz?') };
  }

  return { resolved: null };
}

async function resolvePlanEntities(ctx, plan, memory = null) {
  const resolvedEntities = {};
  const entities = [];
  if (plan.entityType && plan.entityType !== 'none') {
    entities.push({
      type: plan.entityType,
      name: plan.entityName || null,
    });
  }
  for (const entity of entities) {
    const result = await resolveEntityReference(ctx, entity, memory);
    if (result.clarification) {
      return {
        clarification: result.clarification,
        resolvedEntities,
      };
    }
    if (result.resolved) {
      if (result.resolved.type === 'patient') resolvedEntities.patient = result.resolved;
      if (result.resolved.type === 'doctor') resolvedEntities.doctor = result.resolved;
      if (result.resolved.type === 'current_account') resolvedEntities.currentAccount = result.resolved;
    }
  }

  const policy = getIntentPolicy(plan.intent);
  if (policy?.requiredEntityType === 'patient' && !resolvedEntities.patient) {
    const fallback = await resolveEntityReference(ctx, { type: 'patient', name: null }, memory);
    if (fallback.clarification) return { clarification: fallback.clarification, resolvedEntities };
    resolvedEntities.patient = fallback.resolved;
  }
  if (policy?.requiredEntityType === 'doctor' && !resolvedEntities.doctor) {
    const fallback = await resolveEntityReference(ctx, { type: 'doctor', name: null }, memory);
    if (fallback.clarification) return { clarification: fallback.clarification, resolvedEntities };
    resolvedEntities.doctor = fallback.resolved;
  }
  if (policy?.requiredEntityType === 'current_account' && !resolvedEntities.currentAccount) {
    const fallback = await resolveEntityReference(ctx, { type: 'current_account', name: null }, memory);
    if (fallback.clarification) return { clarification: fallback.clarification, resolvedEntities };
    resolvedEntities.currentAccount = fallback.resolved;
  }

  return { resolvedEntities };
}

function validatePlanAgainstPolicy(plan) {
  const policy = getIntentPolicy(plan.intent);
  if (!policy) {
    return {
      valid: false,
      unsupported: true,
      reasonCode: 'intent_unknown',
      message: 'Bu sorgu türü henüz desteklenmiyor.',
    };
  }

  const primaryMetric = plan.metric || defaultMetricForIntent(plan.intent);
  if (!primaryMetric) {
    return {
      valid: false,
      clarificationNeeded: true,
      reasonCode: 'missing_metric',
      message: 'Hangi metriği kastettiğinizi netleştirir misiniz?',
    };
  }
  if (!policy.allowedMetrics.includes(primaryMetric)) {
    return {
      valid: false,
      unsupported: true,
      reasonCode: 'intent_metric_mismatch',
      message: 'Bu metric ve intent kombinasyonu henüz desteklenmiyor.',
    };
  }

  if (plan.intent === INTENTS.finance_summary) {
    const metricEntry = FINANCE_RETRIEVAL_CATALOGUE[primaryMetric];
    if (!metricEntry) {
      return {
        valid: false,
        unsupported: true,
        reasonCode: 'finance_metric_unknown',
        message: 'Bu finans metriği henüz desteklenmiyor.',
      };
    }
    if (!metricEntry.supportedTimeScopes.includes(plan.timeScope)) {
      if (plan.timeScope === TIME_SCOPES.none) {
        return {
          valid: false,
          clarificationNeeded: true,
          reasonCode: 'missing_time_scope',
          message: 'Bu finans metriği için hangi dönemi istediğinizi belirtir misiniz?',
        };
      }
      return {
        valid: false,
        unsupported: true,
        reasonCode: 'time_scope_unsupported',
        message: 'Bu finans metriği ve zaman kapsamı kombinasyonu henüz desteklenmiyor.',
      };
    }
  }

  if (!policy.allowedTimeScopes.includes(plan.timeScope)) {
    if (TIME_BOUND_INTENTS.has(plan.intent) && plan.timeScope === TIME_SCOPES.none) {
      return {
        valid: false,
        clarificationNeeded: true,
        reasonCode: 'missing_time_scope',
        message: 'Hangi dönem için istediğinizi belirtir misiniz?',
      };
    }
    return {
      valid: false,
      unsupported: true,
      reasonCode: 'time_scope_unsupported',
      message: 'Bu zaman kapsamı henüz desteklenmiyor.',
    };
  }

  if (plan.timeScope === TIME_SCOPES.custom && !plan.filters.month && !(plan.filters.fromDate && plan.filters.toDate)) {
    return {
      valid: false,
      clarificationNeeded: true,
      reasonCode: 'missing_custom_range',
      message: 'Özel dönem için ay/yıl veya tarih aralığı belirtir misiniz?',
    };
  }

  if (
    plan.timeScope === TIME_SCOPES.custom &&
    [
      INTENTS.doctor_appointment_analysis,
      INTENTS.doctor_treatment_performance,
      INTENTS.clinic_appointment_analysis,
      INTENTS.clinic_patient_demographics,
      INTENTS.finance_summary,
    ].includes(plan.intent) &&
    !plan.filters.month
  ) {
    return {
      valid: false,
      clarificationNeeded: true,
      reasonCode: 'missing_custom_range',
      message: 'Bu analiz için özel ay/yıl belirtir misiniz?',
    };
  }

  return {
    valid: true,
    primaryMetric,
    policy,
  };
}

function toResolvedParams(plan, resolvedEntities) {
  return {
    patientId: resolvedEntities.patient?.id || null,
    doctorId: resolvedEntities.doctor?.id || null,
    currentAccountId: resolvedEntities.currentAccount?.id || null,
    month: plan.filters?.month,
    year: plan.filters?.year,
    date: plan.filters?.fromDate || null,
  };
}

async function validateAndExecutePlan(ctx, rawPlan, memory = null) {
  const plan = normalizePlanForExecution(rawPlan, memory);

  if (plan.requiresClarification) {
    return {
      plan,
      clarificationNeeded: true,
      clarificationQuestion: plan.clarificationQuestion || 'Lütfen sorunuzu biraz daha netleştirin.',
      clarificationType: inferClarificationType(plan.clarificationQuestion, plan),
      resolvedEntities: {},
      validationResult: 'clarification',
    };
  }

  if (plan.intent === INTENTS.unsupported) {
    return {
      plan,
      unsupported: true,
      message: plan.unsupportedReason || 'Bu özellik şu an desteklenmiyor.',
      reasonCode: 'intent_unknown',
      resolvedEntities: {},
      validationResult: 'unsupported',
    };
  }

  const validation = validatePlanAgainstPolicy(plan);
  if (!validation.valid) {
    return {
      plan,
      clarificationNeeded: !!validation.clarificationNeeded,
      clarificationQuestion: validation.clarificationNeeded ? validation.message : null,
      unsupported: !!validation.unsupported,
      message: validation.unsupported ? validation.message : null,
      reasonCode: validation.reasonCode || null,
      resolvedEntities: {},
      validationResult: validation.clarificationNeeded ? 'clarification' : 'unsupported',
    };
  }

  const resolution = await resolvePlanEntities(ctx, plan, memory);
  if (resolution.clarification) {
    const clarificationType = inferClarificationType(
      resolution.clarification.clarificationQuestion,
      plan,
      resolution.clarification.candidates
    );
    return {
      plan,
      clarificationNeeded: true,
      clarificationQuestion: resolution.clarification.clarificationQuestion,
      clarificationCandidates: resolution.clarification.candidates || null,
      clarificationType,
      resolvedEntities: resolution.resolvedEntities || {},
      validationResult: 'clarification',
    };
  }

  assertRetrievalPermission(ctx, plan);

  if (plan.filters?.compareToPrevious) {
    const comparisonPeriod = plan.filters.comparisonPeriod || 'previous_month';
    const entityType = plan.entityType || 'none';
    if (!canCompare(plan.metric, comparisonPeriod, entityType)) {
      return {
        plan,
        unsupported: true,
        reasonCode: 'comparison_unsupported',
        message: 'Bu metrik için karşılaştırma desteklenmiyor.',
        resolvedEntities: resolution.resolvedEntities || {},
        validationResult: 'unsupported',
      };
    }
  }

  const retrieval = selectApprovedRetrieval(plan);
  if (!retrieval) {
    return {
      plan,
      unsupported: true,
      reasonCode: 'retrieval_not_found',
      message: `Bu metric ve zaman kapsamı kombinasyonu henüz desteklenmiyor: ${plan.metric}/${plan.timeScope}.`,
      resolvedEntities: resolution.resolvedEntities || {},
      validationResult: 'unsupported',
    };
  }

  const resolvedParams = toResolvedParams(plan, resolution.resolvedEntities || {});
  const finalFilter = retrieval.buildFilter(ctx, resolvedParams);
  const structuredContext = await retrieval.execute({
    ctx,
    plan,
    resolvedEntities: resolution.resolvedEntities || {},
    filter: finalFilter,
  });

  return {
    plan,
    resolvedEntities: resolution.resolvedEntities || {},
    retrievalName: retrieval.retrievalName,
    finalFilter,
    structuredContext,
    contextSizeChars: JSON.stringify(structuredContext || {}).length,
    validationResult: 'validated',
  };
}

module.exports = {
  normalizePlanForExecution,
  validatePlanAgainstPolicy,
  resolvePlanEntities,
  validateAndExecutePlan,
};
