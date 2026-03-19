# Deprecated AI Modules

The canonical AI pipeline uses these modules only:

- **orchestrator.js** - Entry point, delegates to pipeline
- **pipeline.js** - Main planner-first pipeline
- **llm-query-planner.js** - LLM-based query planning
- **business-ontology.js** - Semantic analysis, glossary, deterministic pre-parse
- **semantic-validator.js** - Plan validation and correction
- **plan-executor.js** - Entity resolution and retrieval execution
- **approved-retrievals.js** - Metric-specific retrieval catalogue
- **answer-synthesizer.js** - LLM final answer synthesis
- **conversation-memory-v2.js** - Analytic conversation memory
- **entity-resolver-v2.js** - Entity resolution
- **assistant-contracts.js** - Canonical intents, metrics, entity types, time scopes

## Deprecated / Legacy (not in active pipeline)

| File | Reason |
|------|--------|
| planner.js | Old deterministic planner; replaced by llm-query-planner + hybrid pre-parse |
| llm-planner.js | Tool-calling LLM planner; pipeline uses llm-query-planner (plan-first) |
| planning-layer.js | Mode selection layer; pipeline uses llm-query-planner directly |
| query-understanding.js | Entity-centric layer; pipeline uses plan-executor + entity-resolver-v2 |
| query-interpretation.js | Competing METRICS/DOMAINS; use assistant-contracts |
| answer-generator.js | Template-based; pipeline uses answer-synthesizer |
| response-formatter.js | Legacy formatting |
| conversation-memory.js | Replaced by conversation-memory-v2 |
| entity-resolver.js | Replaced by entity-resolver-v2 |

## Migration

- Tests (pipeline-scope, query-interpretation) still reference deprecated modules.
- New code must use assistant-contracts for intents/metrics.
- Do not add dependencies on deprecated modules.
