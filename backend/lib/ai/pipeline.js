/**
 * AI Pipeline - guarded text-to-SQL architecture for READ queries.
 *
 * READ path (primary):
 * 1) Backend authorization layer
 * 2) Query normalization + glossary matching
 * 3) R/W gate — classifies query as READ or WRITE
 * 4) Guarded text-to-SQL pipeline (schema slice → SQL gen → validate → scope inject → execute → render)
 *
 * WRITE path (legacy, unchanged):
 * 1-3) Same as READ
 * 4) LLM query interpretation / planning
 * 5) Semantic validation / constrained replan
 * 6) Backend validation + entity resolution
 * 7) Approved retrieval execution
 * 8) LLM final answer synthesis
 *
 * 9) Logging / observability
 */

const {
  getOrBuildContext,
  createRequestId,
  clearRequestContext,
  assertCanUseAi,
} = require('./context');
const { buildQueryPlan } = require('./llm-query-planner');
const { validateAndExecutePlan } = require('./plan-executor');
const { synthesizeAnswer } = require('./answer-synthesizer');
const { synthesizeConversationalResponse } = require('./conversational-response');
const {
  analyzeBusinessSemantics,
  getDeterministicPlan,
  isPendingClarificationAnswer,
  detectTimeScopeHints,
} = require('./business-ontology');
const { validateSemanticAlignment, buildSemanticFallbackPlan } = require('./semantic-validator');
const {
  getMemory,
  setResolvedEntity,
  setLastQueryState,
  getAnalyticContext,
  getPendingClarification,
  setPendingClarification,
  clearPendingClarification,
} = require('./conversation-memory-v2');
const { logAiRequest } = require('./audit');
const { checkGrounding, handleGroundingFailure } = require('./grounding-guard');
const { getListVariantMetric } = require('./capability-catalog');
const { selectApprovedRetrieval } = require('./approved-retrievals');
const { executeReadPipeline } = require('./read-pipeline');
const { METRICS } = require('./assistant-contracts');

require('./tools');

// ── R/W Gate ─────────────────────────────────────────────────────────────────
// WRITE patterns: explicit mutation keywords only.
// Everything else is READ (default-to-SQL).
const WRITE_PATTERNS = [
  /\b(randevu\s+oluştur|randevu\s+al|randevu\s+ekle)\b/i,
  /\b(hasta\s+ekle|hasta\s+kaydet|hasta\s+oluştur)\b/i,
  /\b(ödeme\s+yap|ödeme\s+al|ödeme\s+kaydet|ödeme\s+ekle)\b/i,
  /\b(fatura\s+kes|fatura\s+oluştur|fatura\s+ekle)\b/i,
  /\b(tedavi\s+planı\s+oluştur|plan\s+ekle)\b/i,
  /\b(iptal\s+et|sil|güncelle|düzenle|değiştir)\b/i,
  /\b(stok\s+ekle|stok\s+çıkış|stok\s+giriş)\b/i,
  /\b(taksit\s+oluştur|taksit\s+ekle)\b/i,
  /\b(görev\s+oluştur|görev\s+ata)\b/i,
];

function classifyReadWrite(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return 'READ';
  for (const pattern of WRITE_PATTERNS) {
    if (pattern.test(text)) return 'WRITE';
  }
  return 'READ';
}

function shouldUseLegacyReadPath(semanticAnalysis, message) {
  const metric = semanticAnalysis?.primaryMetricHint || null;
  const text = String(message || '').toLocaleLowerCase('tr-TR');

  const directMetricHits = [
    METRICS.overdue_patient_list,
    METRICS.debtor_patient_list,
    METRICS.overdue_receivables_amount,
    METRICS.overdue_ratio,
    METRICS.overdue_installment_amount,
    METRICS.overdue_installment_count,
    METRICS.overdue_installment_patient_count,
    METRICS.overdue_installment_patient_list,
    METRICS.overdue_installment_ratio,
    METRICS.doctor_overdue_installment_ratio,
  ];

  if (directMetricHits.includes(metric)) {
    return true;
  }

  const overdueLike =
    /gecikmiş|gecikmis|vadesi geçmiş|vadesi gecmis|overdue/.test(text);

  const installmentLike =
    /taksit|taksiti|taksitin|taksitli|taksitlerin|odeme|ödeme|odemesi|ödemesi|borc|borç|alacak/.test(text);

  const patientLike =
    /hasta|hastasi|hastası|hastalar|hastalari|hastaları|hastalarin|hastaların|hastalarinin|hastalarının/.test(text);

  const doctorLike =
    /\bdr\b|dr\.|doktor|hekim/.test(text);

  const ratioLike =
    /oran|orani|oranı|yuzde|yüzde|payi|payı/.test(text);

  if (overdueLike && installmentLike) return true;
  if (overdueLike && patientLike) return true;
  if (doctorLike && overdueLike && installmentLike) return true;
  if (ratioLike && overdueLike && installmentLike) return true;

  return false;
}

function truncateJson(value, limit = 320) {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}


function summarizePreviousContext(memory) {
  const ac = getAnalyticContext(memory);
  if (!ac) return null;
  return {
    lastIntent: ac.lastIntent,
    lastMetric: ac.lastMetric,
    lastEntityType: ac.lastEntityType,
    lastTimeScope: ac.lastTimeScope,
  };
}

function logPipeline(summary) {
  const parts = [
    '[AI]',
    summary.rawQuery ? `raw="${summary.rawQuery.slice(0, 80)}${summary.rawQuery.length > 80 ? '...' : ''}"` : null,
    summary.normalizedQuery ? `normalized="${summary.normalizedQuery.slice(0, 80)}${summary.normalizedQuery.length > 80 ? '...' : ''}"` : null,
    summary.glossaryMatches ? `glossary=${truncateJson(summary.glossaryMatches)}` : null,
    summary.plannerOutput ? `planner=${truncateJson(summary.plannerOutput)}` : null,
    summary.replanOutput ? `replan=${truncateJson(summary.replanOutput)}` : null,
    summary.semanticValidationResult ? `semantic=${summary.semanticValidationResult}` : null,
    summary.semanticMismatchReason ? `semanticReason=${summary.semanticMismatchReason}` : null,
    summary.selectedMetric ? `metric=${summary.selectedMetric}` : null,
    summary.validationResult ? `validation=${summary.validationResult}` : null,
    summary.resolvedEntities ? `resolved=${truncateJson(summary.resolvedEntities)}` : null,
    summary.retrievalName ? `retrieval=${summary.retrievalName}` : null,
    summary.finalFilter ? `filter=${truncateJson(summary.finalFilter)}` : null,
    summary.contextSizeChars != null ? `contextSize=${summary.contextSizeChars}` : null,
    summary.llmPlanningUsed != null ? `llmPlanningUsed=${summary.llmPlanningUsed}` : null,
    summary.llmAnswerUsed != null ? `llmAnswerUsed=${summary.llmAnswerUsed}` : null,
    summary.fallbackUsed != null ? `fallbackUsed=${summary.fallbackUsed}` : null,
    summary.clarificationNeeded != null ? `clarificationNeeded=${summary.clarificationNeeded}` : null,
    summary.replanHappened != null ? `replanHappened=${summary.replanHappened}` : null,
    summary.inheritedContextUsed != null ? `inheritedContextUsed=${summary.inheritedContextUsed}` : null,
    summary.deterministicPreparse != null ? `deterministicPreparse=${summary.deterministicPreparse}` : null,
    summary.legacyPathUsed != null ? `legacyPathUsed=${summary.legacyPathUsed}` : null,
    summary.semanticMismatchDetected != null ? `semanticMismatchDetected=${summary.semanticMismatchDetected}` : null,
    summary.comparisonRequested != null ? `comparisonRequested=${summary.comparisonRequested}` : null,
    summary.comparisonExecutor ? `comparisonExecutor=${summary.comparisonExecutor}` : null,
    summary.previousContext ? `previousContext=${truncateJson(summary.previousContext)}` : null,
    summary.requestContextCacheHit != null ? `requestContextCacheHit=${summary.requestContextCacheHit}` : null,
    summary.planningMs != null ? `planningMs=${summary.planningMs}` : null,
    summary.replanMs != null ? `replanMs=${summary.replanMs}` : null,
    summary.validationMs != null ? `validationMs=${summary.validationMs}` : null,
    summary.synthesisMs != null ? `synthesisMs=${summary.synthesisMs}` : null,
    summary.totalMs != null ? `totalMs=${summary.totalMs}` : null,
    summary.requestedOutputShape ? `requestedShape=${summary.requestedOutputShape}` : null,
    summary.retrievedDataShape ? `retrievedShape=${summary.retrievedDataShape}` : null,
    summary.groundingGuardPassed != null ? `groundingPassed=${summary.groundingGuardPassed}` : null,
    summary.listCapabilityUsed != null ? `listCapability=${summary.listCapabilityUsed}` : null,
    summary.plannerRetryUsed != null ? `plannerRetry=${summary.plannerRetryUsed}` : null,
    summary.pendingClarificationUsed != null ? `pendingClarification=${summary.pendingClarificationUsed}` : null,
    `status=${summary.status}`,
  ].filter(Boolean);
  console.log(parts.join(' | '));
}

async function processChat({ user, message, history = [], session = null }) {
  const t0 = Date.now();
  const requestId = createRequestId();
  let ctx;
  let cacheHit = false;
  try {
    const result = getOrBuildContext(user, requestId);
    ctx = result.ctx;
    cacheHit = result.cacheHit;
    assertCanUseAi(ctx);
  } catch (err) {
    clearRequestContext(requestId);
    throw err;
  }

  const memory = getMemory(session, ctx.userId);
  const summary = {
    rawQuery: String(message || '').trim(),
    normalizedQuery: null,
    glossaryMatches: null,
    plannerOutput: null,
    replanOutput: null,
    semanticValidationResult: null,
    semanticMismatchReason: null,
    selectedMetric: null,
    validationResult: null,
    resolvedEntities: null,
    retrievalName: null,
    finalFilter: null,
    contextSizeChars: null,
    llmPlanningUsed: true,
    llmAnswerUsed: false,
    fallbackUsed: false,
    clarificationNeeded: false,
    replanHappened: false,
    inheritedContextUsed: false,
    deterministicPreparse: false,
    legacyPathUsed: false,
    semanticMismatchDetected: false,
    comparisonRequested: false,
    comparisonExecutor: null,
    previousContext: null,
    requestContextCacheHit: cacheHit,
    planningMs: null,
    replanMs: null,
    validationMs: null,
    synthesisMs: null,
    totalMs: null,
    status: 'success',
    modelUsed: null,
    readPipeline: false,
    rwGate: null,
  };

  try {
    let semanticAnalysis = analyzeBusinessSemantics(message, memory);
    summary.normalizedQuery = semanticAnalysis.normalizedQuery;
    summary.glossaryMatches = semanticAnalysis.glossaryMatches || [];
    summary.deterministicPreparse = !!getDeterministicPlan(semanticAnalysis);

    // ── R/W Gate: route READ queries to guarded text-to-SQL pipeline ────
    const rwClassification = classifyReadWrite(message);
    const forceLegacyRead = shouldUseLegacyReadPath(semanticAnalysis, message);
    summary.rwGate = rwClassification;
    summary.forceLegacyRead = forceLegacyRead;

    if (rwClassification === 'READ' && !forceLegacyRead) {
      summary.readPipeline = true;
      const tRead = Date.now();

      try {
        const readResult = await executeReadPipeline({
          ctx,
          message,
          memory,
          history,
          semanticContext: semanticAnalysis,
        });

        if (readResult.error || readResult.errorCode) {
          const err = new Error(readResult.error || 'Read pipeline başarısız sonuç döndürdü.');
          err.code = readResult.errorCode || 'AI_READ_PIPELINE_UNSUCCESSFUL';
          throw err;
        }

        summary.totalMs = Date.now() - t0;
        summary.planningMs = Date.now() - tRead;
        summary.modelUsed = 'ollama';

        // Update conversation memory from read pipeline
        clearPendingClarification(memory);
        if (readResult.readPlan) {
          setLastQueryState(memory, {
            intent: readResult.readPlan.queryType || null,
            metric: readResult.readPlan.requestedMetrics?.[0] || null,
            timeScope: readResult.readPlan.filters?.timeScope || null,
            filters: readResult.readPlan.filters || {},
            retrievalName: 'sql_pipeline',
            entityType: readResult.readPlan.filters?.entityType || null,
            entityId: null,
          });
          // Store read plan in memory for follow-up context
          if (memory) {
            memory.lastReadPlan = readResult.readPlan;
          }
        }

        if (readResult.requiresClarification) {
          summary.clarificationNeeded = true;
          if (readResult.readPlan) {
            setPendingClarification(memory, {
              clarificationType: 'ambiguous_query',
              previousPlan: readResult.readPlan,
              previousQuestion: message,
            });
          }
        }

        logPipeline(summary);
        await logAiRequest({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          message,
          selectedIntent: `sql_read:${readResult.readPlan?.queryType || 'unknown'}`,
          plannerMode: 'sql_pipeline',
          modelUsed: summary.modelUsed,
          toolsCalled: ['sql_pipeline'],
          status: readResult.error ? 'error' : 'success',
          errorMessage: readResult.error || undefined,
        });

        return {
          answer: readResult.answer,
          clarification_needed: !!readResult.requiresClarification,
        };
      } catch (readErr) {
        // If the SQL pipeline fails, log and fall through to legacy path
        console.warn('[AI] SQL read pipeline failed, falling back to legacy:', readErr.message);
        summary.readPipeline = false;
        summary.legacyPathUsed = true;
        // Continue to legacy pipeline below
      }
    }

    if (rwClassification === 'READ' && forceLegacyRead) {
      summary.readPipeline = false;
      summary.legacyPathUsed = true;
      console.log('[AI] Forcing legacy read path for overdue/installment-style query:', message);
    }

    // ── Legacy pipeline (WRITE ops or SQL pipeline fallback) ─────────────
    const pending = getPendingClarification(memory);
    if (isPendingClarificationAnswer(message) && pending?.previousPlan) {
      summary.pendingClarificationUsed = true;
      const timeHint = detectTimeScopeHints(semanticAnalysis.foldedQuery);
      semanticAnalysis = {
        ...semanticAnalysis,
        inheritanceHint: true,
        inheritedIntent: pending.previousPlan.intent,
        inheritedMetric: pending.previousPlan.metric,
        inheritedEntityType: pending.previousPlan.entityType,
        inheritedTimeScope: timeHint.timeScope !== 'none' ? timeHint.timeScope : pending.previousPlan.timeScope,
        inheritedFilters: timeHint.filters && Object.keys(timeHint.filters).length
          ? timeHint.filters
          : pending.previousPlan.filters || {},
      };
    }

    const tPlan = Date.now();
    let plannerResult;
    const deterministicPlan = getDeterministicPlan(semanticAnalysis);
    if (deterministicPlan) {
      plannerResult = {
        plan: deterministicPlan,
        modelUsed: null,
        rawPlannerResponse: null,
      };
      summary.planningMs = Date.now() - tPlan;
    } else {
      try {
        plannerResult = await buildQueryPlan(message, {
          history,
          memory,
          semanticContext: semanticAnalysis,
        });
      } catch (err) {
        const fallbackPlan =
          err.code === 'AI_PLANNER_INVALID_OUTPUT'
            ? buildSemanticFallbackPlan(semanticAnalysis, memory)
            : null;
        if (!fallbackPlan) throw err;
        summary.fallbackUsed = true;
        plannerResult = {
          plan: fallbackPlan,
          modelUsed: null,
          rawPlannerResponse: null,
        };
      }
      summary.planningMs = Date.now() - tPlan;
    }
    summary.plannerOutput = plannerResult.plan;
    summary.modelUsed = plannerResult.modelUsed;
    let effectivePlan = plannerResult.plan;

    let semanticResult = validateSemanticAlignment({
      analysis: semanticAnalysis,
      plan: effectivePlan,
      memory,
    });
    summary.semanticValidationResult = semanticResult.status;
    summary.semanticMismatchReason = semanticResult.mismatchReason || null;

    if (semanticResult.shouldReplan && semanticResult.replanContext) {
      summary.replanHappened = true;
      const tReplan = Date.now();
      let replanResult;
      try {
        replanResult = await buildQueryPlan(message, {
          history,
          memory,
          semanticContext: semanticResult.replanContext,
        });
      } catch (err) {
        const fallbackPlan =
          err.code === 'AI_PLANNER_INVALID_OUTPUT'
            ? buildSemanticFallbackPlan(
                {
                  ...semanticAnalysis,
                  ...semanticResult.replanContext,
                },
                memory
              )
            : null;
        if (!fallbackPlan) throw err;
        summary.fallbackUsed = true;
        replanResult = {
          plan: fallbackPlan,
          modelUsed: null,
          rawPlannerResponse: null,
        };
      }
      summary.replanMs = Date.now() - tReplan;
      summary.replanOutput = replanResult.plan;
      effectivePlan = replanResult.plan;
      semanticResult = validateSemanticAlignment({
        analysis: semanticAnalysis,
        plan: effectivePlan,
        memory,
      });
      summary.semanticValidationResult = semanticResult.status;
      summary.semanticMismatchReason = semanticResult.mismatchReason || null;
    }

    if (semanticResult.adjustedPlan) {
      effectivePlan = semanticResult.adjustedPlan;
    }
    summary.selectedMetric = effectivePlan.metric || null;
    summary.inheritedContextUsed = !!(
      semanticAnalysis.inheritanceHint ||
      semanticResult.correctionApplied ||
      semanticResult.inheritanceApplied
    );
    summary.semanticMismatchDetected = !!semanticResult.semanticMismatch;
    summary.comparisonRequested = !!effectivePlan.filters?.compareToPrevious;
    summary.previousContext = summarizePreviousContext(memory);

    if (semanticResult.semanticMismatch) {
      summary.clarificationNeeded = true;
      summary.semanticMismatchDetected = true;
      summary.totalMs = Date.now() - t0;
      logPipeline(summary);
      await logAiRequest({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        message,
        selectedIntent: `${effectivePlan.intent}:${effectivePlan.metric || 'unknown'}`,
        plannerMode: 'llm_planner',
        modelUsed: summary.modelUsed,
        toolsCalled: [],
        status: 'success',
      });
      const answer = await synthesizeConversationalResponse({
        type: 'semantic_mismatch',
        userMessage: message,
        expectedHints: { finance: true },
      });
      return {
        answer,
        clarification_needed: true,
      };
    }

    const tValidate = Date.now();
    const execution = await validateAndExecutePlan(ctx, effectivePlan, memory);
    summary.validationMs = Date.now() - tValidate;
    summary.validationResult = execution.validationResult;
    summary.resolvedEntities = execution.resolvedEntities || {};
    summary.retrievalName = execution.retrievalName || null;
    summary.comparisonExecutor =
      execution.plan?.filters?.compareToPrevious ? execution.retrievalName || null : null;
    summary.finalFilter = execution.finalFilter || null;
    summary.contextSizeChars = execution.contextSizeChars ?? null;
    summary.selectedMetric = execution.plan?.metric || summary.selectedMetric;

    if (execution.clarificationNeeded) {
      summary.clarificationNeeded = true;
      summary.totalMs = Date.now() - t0;
      logPipeline(summary);
      await logAiRequest({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        message,
        selectedIntent: `${execution.plan?.intent || 'unknown'}:${execution.plan?.metric || 'unknown'}`,
        plannerMode: 'llm_planner',
        modelUsed: summary.modelUsed,
        toolsCalled: execution.retrievalName ? [execution.retrievalName] : [],
        status: 'success',
      });
      setPendingClarification(memory, {
        clarificationType: execution.clarificationType,
        expectedEntityType: execution.plan?.entityType,
        expectedTimeScope: execution.plan?.timeScope,
        expectedMetric: execution.plan?.metric,
        previousPlan: execution.plan,
        previousQuestion: message,
      });
      const answer = await synthesizeConversationalResponse({
        type: 'clarification',
        question: execution.clarificationQuestion || 'Lütfen sorunuzu biraz daha netleştirin.',
        userMessage: message,
        candidates: execution.clarificationCandidates || null,
        plan: execution.plan,
      });
      return {
        answer,
        clarification_needed: true,
      };
    }

    if (execution.unsupported) {
      summary.totalMs = Date.now() - t0;
      logPipeline(summary);
      await logAiRequest({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        message,
        selectedIntent: `${execution.plan?.intent || 'unknown'}:${execution.plan?.metric || 'unknown'}`,
        plannerMode: 'llm_planner',
        modelUsed: summary.modelUsed,
        toolsCalled: execution.retrievalName ? [execution.retrievalName] : [],
        status: 'success',
      });
      const answer = await synthesizeConversationalResponse({
        type: 'unsupported',
        userMessage: message,
        reasonCode: execution.reasonCode || null,
        rawMessage: execution.message || null,
        plan: execution.plan,
      });
      return {
        answer,
        clarification_needed: false,
      };
    }

    if (execution.structuredContext?.error) {
      summary.totalMs = Date.now() - t0;
      logPipeline(summary);
      await logAiRequest({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        message,
        selectedIntent: `${execution.plan?.intent || 'unknown'}:${execution.plan?.metric || 'unknown'}`,
        plannerMode: 'llm_planner',
        modelUsed: summary.modelUsed,
        toolsCalled: execution.retrievalName ? [execution.retrievalName] : [],
        status: 'success',
      });
      const answer = await synthesizeConversationalResponse({
        type: 'data_error',
        userMessage: message,
        errorMessage: execution.structuredContext.error,
      });
      return {
        answer,
        clarification_needed: false,
      };
    }

    const grounding = checkGrounding({
      question: message,
      plan: execution.plan,
      structuredContext: execution.structuredContext,
    });
    summary.requestedOutputShape = grounding.requestedOutputShape;
    summary.retrievedDataShape = grounding.retrievedDataShape;
    summary.groundingGuardPassed = grounding.groundingGuardPassed;
    summary.listCapabilityUsed = execution.plan?.metric === 'appointment_list';

    // ── Grounding Guard Enforcement ──────────────────────────────
    // If user asks for list but we only have count, try re-routing to list capability.
    // If re-routing fails, return a grounded rejection — NEVER proceed to LLM.
    if (!grounding.pass) {
      // Attempt re-route to list variant of same intent
      const listMetric = getListVariantMetric(execution.plan.intent, execution.plan.metric);
      if (listMetric) {
        const listPlan = { ...execution.plan, metric: listMetric };
        const listRetrieval = selectApprovedRetrieval(listPlan);
        if (listRetrieval) {
          try {
            const listFilter = listRetrieval.buildFilter(ctx, {
              patientId: execution.resolvedEntities?.patient?.id || null,
              doctorId: execution.resolvedEntities?.doctor?.id || null,
              currentAccountId: execution.resolvedEntities?.currentAccount?.id || null,
              month: execution.plan.filters?.month,
              year: execution.plan.filters?.year,
              date: execution.plan.filters?.fromDate || null,
            });
            const listContext = await listRetrieval.execute({
              ctx,
              plan: listPlan,
              resolvedEntities: execution.resolvedEntities || {},
              filter: listFilter,
            });
            if (listContext && !listContext.error) {
              // Re-route succeeded - update execution with list data
              execution.structuredContext = listContext;
              execution.plan = listPlan;
              execution.retrievalName = listRetrieval.retrievalName;
              summary.listCapabilityUsed = true;
              summary.groundingGuardPassed = true;
              summary.retrievedDataShape = 'rows';
              summary.retrievalName = listRetrieval.retrievalName;
              // Fall through to synthesis with list data
            }
          } catch (rerouteErr) {
            console.warn('[AI] List re-route failed:', rerouteErr.message);
          }
        }
      }

      // If still not grounded after re-route attempt, block and return grounded message
      if (!summary.groundingGuardPassed) {
        summary.totalMs = Date.now() - t0;
        logPipeline(summary);
        await logAiRequest({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          message,
          selectedIntent: `${execution.plan.intent}:${execution.plan.metric || 'unknown'}`,
          plannerMode: 'llm_planner',
          modelUsed: summary.modelUsed,
          toolsCalled: execution.retrievalName ? [execution.retrievalName] : [],
          status: 'success',
        });
        const answer = await handleGroundingFailure({
          question: message,
          plan: execution.plan,
          userMessage: message,
          reason: grounding.reason,
        });
        return {
          answer,
          clarification_needed: false,
        };
      }
    }

    const tSynth = Date.now();
    const answer = await synthesizeAnswer({
      question: message,
      plan: execution.plan,
      structuredContext: execution.structuredContext,
    });
    summary.synthesisMs = Date.now() - tSynth;
    summary.llmAnswerUsed = true;

    clearPendingClarification(memory);

    if (execution.resolvedEntities?.patient) {
      setResolvedEntity(memory, 'patient', execution.resolvedEntities.patient, execution.plan.intent);
    }
    if (execution.resolvedEntities?.doctor) {
      setResolvedEntity(memory, 'doctor', execution.resolvedEntities.doctor, execution.plan.intent);
    }
    if (execution.resolvedEntities?.currentAccount) {
      setResolvedEntity(memory, 'current_account', execution.resolvedEntities.currentAccount, execution.plan.intent);
    }
    const entityId =
      execution.resolvedEntities?.doctor?.id ||
      execution.resolvedEntities?.patient?.id ||
      execution.resolvedEntities?.currentAccount?.id ||
      null;
    setLastQueryState(memory, {
      intent: execution.plan.intent,
      metric: execution.plan.metric || null,
      timeScope: execution.plan.timeScope,
      filters: execution.plan.filters || {},
      retrievalName: execution.retrievalName,
      entityType: execution.plan.entityType || null,
      entityId,
      comparisonBase: execution.plan.filters?.compareToPrevious
        ? {
            period: execution.plan.filters.comparisonPeriod || 'previous_month',
            baseMetric: execution.plan.metric,
          }
        : null,
    });

    summary.totalMs = Date.now() - t0;
    logPipeline(summary);
    await logAiRequest({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      message,
      selectedIntent: `${execution.plan.intent}:${execution.plan.metric || 'unknown'}`,
      plannerMode: 'llm_planner',
      modelUsed: summary.modelUsed,
      toolsCalled: execution.retrievalName ? [execution.retrievalName] : [],
      status: 'success',
    });

    return {
      answer,
      clarification_needed: false,
    };
  } catch (err) {
    summary.status = 'error';
    summary.totalMs = Date.now() - t0;
    logPipeline(summary);
    await logAiRequest({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      message,
      selectedIntent: `${summary.plannerOutput?.intent || 'unknown'}:${summary.selectedMetric || 'unknown'}`,
      plannerMode: 'llm_planner',
      modelUsed: summary.modelUsed,
      toolsCalled: summary.retrievalName ? [summary.retrievalName] : [],
      status: 'error',
      errorMessage: err.message,
    });
    throw err;
  } finally {
    clearRequestContext(requestId);
  }
}

module.exports = { processChat };
