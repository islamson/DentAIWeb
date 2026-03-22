/**
 * Read Pipeline — Unified entry point for the guarded text-to-SQL pipeline.
 *
 * Pipeline stages:
 * 1. Semantic Read Planner → structured read plan
 * 2. Schema Slicer → relevant schema subset
 * 3. SQL Generator → SELECT query from plan + schema
 * 4. SQL Validator (schema-aware) → reject unsafe/invalid SQL
 * 5. Scope Injector → add tenant constraints
 * 6. SQL Runner → execute safely
 * 7. Result Validator → validate shape
 * 8. Answer Renderer → final NL answer
 *
 * Debug logging: every request logs semantic plan, schema slice,
 * generated SQL, validation results, and final SQL.
 */

'use strict';

const { generateReadPlan } = require('./semantic-read-planner');
const { buildSchemaSlice, inferDomainsFromPlan } = require('./schema-slicer');
const { generateSql } = require('./sql-generator');
const { validateSql, repairSql } = require('./sql-validator');
const { injectScope } = require('./scope-injector');
const { executeSql } = require('./sql-runner');
const { validateResult, getFallbackMessage } = require('./result-validator');
const { renderAnswer } = require('./answer-renderer');

/**
 * Log a structured debug line for the read pipeline stage.
 */
function logStage(tag, data) {
  console.log(`[ReadPipeline][${tag}]`, JSON.stringify(data, null, 0));
}

/**
 * Execute the full guarded text-to-SQL pipeline.
 *
 * @param {Object} params
 * @param {Object} params.ctx - AI context { organizationId, branchId, userId, role }
 * @param {string} params.message - user's message
 * @param {Object} params.memory - conversation memory
 * @param {Object[]} params.history - chat history
 * @param {Object} params.semanticContext - from business-ontology analysis
 * @returns {Promise<{ answer: string, readPlan: Object, sqlUsed: string, debug: Object }>}
 */
async function executeReadPipeline({ ctx, message, memory, history, semanticContext }) {
  const debug = {
    stages: [],
    startedAt: Date.now(),
  };

  try {
    // ── Stage 1: Semantic Read Plan ───────────────────────────────────────
    debug.stages.push({ stage: 'planner', status: 'started' });
    const { plan: readPlan, modelUsed } = await generateReadPlan(message, {
      history,
      memory,
      semanticContext,
    });
    debug.stages[debug.stages.length - 1].status = 'completed';
    debug.plannerModel = modelUsed;
    debug.readPlan = readPlan;

    logStage('PLAN', {
      queryType: readPlan.queryType,
      analysisMode: readPlan.analysisMode,
      targetEntities: readPlan.targetEntities,
      requestedMetrics: readPlan.requestedMetrics,
      filters: readPlan.filters,
      needsClarification: readPlan.needsClarification,
    });

    // Check if clarification is needed
    if (readPlan.needsClarification && readPlan.clarificationQuestion) {
      logStage('CLARIFICATION', { question: readPlan.clarificationQuestion });
      return {
        answer: readPlan.clarificationQuestion,
        readPlan,
        sqlUsed: null,
        requiresClarification: true,
        debug,
      };
    }

    // ── Stage 2: Schema Slice ────────────────────────────────────────────
    debug.stages.push({ stage: 'schema_slicer', status: 'started' });
    const domains = inferDomainsFromPlan(readPlan);
    const schemaSlice = buildSchemaSlice(domains);
    debug.stages[debug.stages.length - 1].status = 'completed';
    debug.domains = domains;
    debug.schemaTableCount = schemaSlice.tables.length;
    debug.schemaTables = schemaSlice.tables;

    logStage('SCHEMA_SLICE', {
      domains,
      tables: schemaSlice.tables,
      joinPathCount: schemaSlice.joinPaths.length,
    });

    // ── Stage 3: SQL Generation ──────────────────────────────────────────
    debug.stages.push({ stage: 'sql_generator', status: 'started' });
    const { sql: rawSql } = await generateSql(readPlan, schemaSlice);
    debug.stages[debug.stages.length - 1].status = 'completed';
    debug.rawSql = rawSql;

    logStage('RAW_SQL', { sql: rawSql });

    // ── Stage 4: SQL Validation (schema-aware) ──────────────────────────
    debug.stages.push({ stage: 'sql_validator', status: 'started' });
    const validation = validateSql(rawSql, { schemaAware: true });
    debug.stages[debug.stages.length - 1].status = 'completed';
    debug.sqlValidation = validation;

    logStage('VALIDATION', {
      valid: validation.valid,
      reason: validation.reason || null,
      code: validation.code || null,
      schemaErrors: validation.schemaErrors || null,
    });

    let finalRawSql = rawSql;

    if (!validation.valid) {
      console.warn('[ReadPipeline] SQL validation failed:', validation.reason);
      debug.stages.push({ stage: 'failed', reason: `SQL validation: ${validation.reason}` });

      // 1. Try repair first (e.g. add LIMIT) — preserves valid structure
      const repairedSql = repairSql(rawSql, validation);
      if (repairedSql !== rawSql) {
        debug.repairedSql = repairedSql;
        const repairValidation = validateSql(repairedSql, { schemaAware: true });
        if (repairValidation.valid) {
          finalRawSql = repairedSql;
          debug.stages.push({ stage: 'repair', status: 'completed' });
          logStage('REPAIR', { repaired: true });
        }
      }

      // 2. If repair didn't fix it, retry SQL generation once
      if (finalRawSql === rawSql) {
        debug.stages.push({ stage: 'sql_generator_retry', status: 'started' });
        const { sql: retrySql } = await generateSql(readPlan, schemaSlice);
        debug.stages[debug.stages.length - 1].status = 'completed';
        debug.retrySql = retrySql;

        logStage('RETRY_SQL', { sql: retrySql });

        const retryValidation = validateSql(retrySql, { schemaAware: true });
        debug.retryValidation = retryValidation;

        logStage('RETRY_VALIDATION', {
          valid: retryValidation.valid,
          reason: retryValidation.reason || null,
          code: retryValidation.code || null,
        });

        if (retryValidation.valid) {
          finalRawSql = retrySql;
        } else {
          return {
            answer: 'Bu soruyu güvenli bir şekilde cevaplayamıyorum. Lütfen sorunuzu farklı ifade edin.',
            readPlan,
            sqlUsed: null,
            error: `SQL validation failed: ${retryValidation.reason}`,
            errorCode: retryValidation.code || 'AI_SQL_VALIDATION_FAILED',
            debug,
          };
        }
      }
    }

    // ── Stage 5: Scope Injection ─────────────────────────────────────────
    debug.stages.push({ stage: 'scope_injector', status: 'started' });
    const { sql: scopedSql, params } = injectScope(finalRawSql, ctx);
    debug.stages[debug.stages.length - 1].status = 'completed';
    debug.scopedSql = scopedSql;
    debug.paramCount = params.length;

    logStage('SCOPED_SQL', {
      sql: scopedSql,
      paramCount: params.length,
      // Never log actual param values (they're tenant IDs)
    });

    // ── Stage 6: SQL Execution ───────────────────────────────────────────
    debug.stages.push({ stage: 'sql_runner', status: 'started' });
    const { rows, rowCount, executionTimeMs, truncated } = await executeSql(scopedSql, params);
    debug.stages[debug.stages.length - 1].status = 'completed';
    debug.executionTimeMs = executionTimeMs;
    debug.rowCount = rowCount;
    debug.truncated = truncated;

    logStage('EXECUTION', {
      rowCount,
      executionTimeMs,
      truncated,
    });

    // ── Stage 7: Result Validation ───────────────────────────────────────
    debug.stages.push({ stage: 'result_validator', status: 'started' });
    const resultValidation = validateResult(rows, readPlan);
    debug.stages[debug.stages.length - 1].status = 'completed';
    debug.resultValidation = {
      valid: resultValidation.valid,
      shape: resultValidation.shape,
    };

    if (!resultValidation.valid) {
      const fallbackMsg = getFallbackMessage(resultValidation, readPlan);
      logStage('RESULT_INVALID', { shape: resultValidation.shape });

      return {
        answer: fallbackMsg,
        readPlan,
        sqlUsed: scopedSql,
        error: resultValidation.reason || 'Result validation failed',
        errorCode: 'AI_RESULT_INVALID',
        debug,
      };
    }

    // ── Stage 8: Answer Rendering ────────────────────────────────────────
    debug.stages.push({ stage: 'answer_renderer', status: 'started' });
    const answer = await renderAnswer({
      rows,
      readPlan,
      validation: resultValidation,
      originalQuestion: message,
    });
    debug.stages[debug.stages.length - 1].status = 'completed';
    debug.totalTimeMs = Date.now() - debug.startedAt;

    logStage('COMPLETE', {
      totalTimeMs: debug.totalTimeMs,
      rowCount,
      stages: debug.stages.length,
    });

    return {
      answer,
      readPlan,
      sqlUsed: scopedSql,
      rows, // for memory storage
      debug,
    };
  } catch (err) {
    debug.totalTimeMs = Date.now() - debug.startedAt;
    debug.error = err.message;
    debug.errorCode = err.code;

    logStage('ERROR', {
      code: err.code || 'UNKNOWN',
      message: err.message,
      totalTimeMs: debug.totalTimeMs,
    });

    // User-friendly error messages by error code
    if (err.code === 'AI_LLM_UNAVAILABLE') {
      return {
        answer: 'Yapay zeka servisi şu anda erişilemiyor. Lütfen daha sonra tekrar deneyin.',
        readPlan: null,
        sqlUsed: null,
        error: err.message,
        errorCode: err.code,
        debug,
      };
    }

    if (err.code === 'AI_SQL_INVALID_SCHEMA') {
      return {
        answer: 'Sorgu şema uyumsuzluğu nedeniyle çalıştırılamadı. Lütfen sorunuzu farklı ifade edin.',
        readPlan: debug.readPlan || null,
        sqlUsed: debug.scopedSql || null,
        error: err.message,
        errorCode: err.code,
        debug,
      };
    }

    if (err.code === 'AI_SQL_TIMEOUT') {
      return {
        answer: 'Sorgu çok uzun sürdü. Lütfen daha dar kapsamlı bir soru sorun.',
        readPlan: debug.readPlan || null,
        sqlUsed: debug.scopedSql || null,
        error: err.message,
        errorCode: err.code,
        debug,
      };
    }

    if (err.code === 'AI_SQL_EXECUTION_FAILED') {
      return {
        answer: 'SQL sorgusu çalıştırılamadı. Lütfen sorunuzu farklı ifade edin.',
        readPlan: debug.readPlan || null,
        sqlUsed: debug.scopedSql || null,
        error: err.message,
        errorCode: err.code,
        debug,
      };
    }

    if (err.code === 'AI_SQL_GENERATION_FAILED') {
      return {
        answer: 'SQL sorgusu oluşturulamadı. Lütfen sorunuzu farklı ifade edin.',
        readPlan: debug.readPlan || null,
        sqlUsed: null,
        error: err.message,
        errorCode: err.code,
        debug,
      };
    }

    return {
      answer: 'Bu soruyu şu anda cevaplayamıyorum. Lütfen farklı bir şekilde ifade edin.',
      readPlan: debug.readPlan || null,
      sqlUsed: debug.scopedSql || null,
      error: err.message,
      errorCode: err.code || 'UNKNOWN',
      debug,
    };
  }
}

module.exports = {
  executeReadPipeline,
};
