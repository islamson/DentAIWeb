/**
 * AI orchestrator - delegates to planner-first pipeline.
 * Pipeline: Authorization -> LLM Planner -> Backend Validation/Execution -> LLM Synthesis -> Memory/Audit.
 */

const { processChat } = require('./pipeline');

module.exports = { processChat };
