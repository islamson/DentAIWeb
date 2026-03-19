# AI Architecture Audit and Refactor Summary

## 1. Root Cause Analysis: "Kliniğe kayıtlı kaç adet hasta var?" Failure

**Why it failed before:**

1. **No clinic patient count capability** – `assistant-contracts.js` had no `clinic_patient_analysis` intent or `patient_count` metric. The approved retrieval catalogue had no `getClinicPatientCount`.

2. **Finance-only glossary** – `business-ontology.js` only matched finance terms (ciro, tahsilat, bekleyen tahsilat, etc.). "hasta", "kayıtlı", "kaç adet" were not in any glossary, so `primaryMetricHint` and `intentHint` were null.

3. **Weak semantic validation** – With no `primaryMetricHint`, the validator treated the plan as acceptable. The LLM could output `finance_summary` + `appointment_count` without being corrected.

4. **LLM confusion** – Without backend hints, the LLM mixed "hasta" (patient) with "randevu" (appointment) and produced `finance_summary` + `appointment_count`.

5. **Validation = unsupported** – The plan-executor could not find a retrieval for `finance_summary` + `appointment_count` (invalid combination), so it returned unsupported.

## 2. Canonical AI Files (Active Pipeline)

| File | Role |
|------|------|
| `orchestrator.js` | Entry point, delegates to pipeline |
| `pipeline.js` | Main planner-first pipeline |
| `llm-query-planner.js` | LLM query planning |
| `business-ontology.js` | Semantic analysis, glossary, deterministic pre-parse |
| `semantic-validator.js` | Plan validation and correction |
| `plan-executor.js` | Entity resolution and retrieval execution |
| `approved-retrievals.js` | Metric-specific retrieval catalogue |
| `answer-synthesizer.js` | LLM final answer synthesis |
| `conversation-memory-v2.js` | Analytic conversation memory |
| `entity-resolver-v2.js` | Entity resolution |
| `assistant-contracts.js` | Canonical intents, metrics, entity types, time scopes |
| `data-aggregators.js` | Data fetching for retrievals |
| `query-filter-builder.js` | Filter construction |
| `comparison-matrix.js` | Comparison compatibility |
| `context.js` | Request context and caching |
| `audit.js` | Request logging |

## 3. Deprecated / Legacy AI Files

| File | Status |
|------|--------|
| `planner.js` | Deprecated – replaced by llm-query-planner + hybrid pre-parse |
| `llm-planner.js` | Deprecated – tool-calling planner; pipeline uses plan-first |
| `planning-layer.js` | Deprecated – mode selection; pipeline uses llm-query-planner directly |
| `query-understanding.js` | Deprecated – uses planner.js |
| `query-interpretation.js` | Deprecated – competing METRICS/DOMAINS; use assistant-contracts |
| `answer-generator.js` | Deprecated – pipeline uses answer-synthesizer |
| `response-formatter.js` | Deprecated |
| `conversation-memory.js` | Deprecated – replaced by conversation-memory-v2 |
| `entity-resolver.js` | Deprecated – replaced by entity-resolver-v2 |

See `DEPRECATED_AI_MODULES.md` for details.

## 4. Files Changed

| File | Changes |
|------|---------|
| `assistant-contracts.js` | Added `clinic_patient_analysis`, `patient_count`; updated INTENT_HELP, METRIC_HELP |
| `business-ontology.js` | Added PATIENT_COUNT_GLOSSARY, matchPatientCountGlossary, getDeterministicPlan; updated analyzeBusinessSemantics |
| `data-aggregators.js` | Added buildClinicPatientCountContext |
| `approved-retrievals.js` | Added clinic_patient_analysis registry entry, getClinicPatientCount |
| `plan-executor.js` | Added defaultMetricForIntent for clinic_patient_analysis |
| `pipeline.js` | Hybrid planner (getDeterministicPlan), observability fields |
| `llm-query-planner.js` | Added clinic_patient_analysis example |
| `comparison-matrix.js` | Added patient_count (supportsComparison: false) |
| `planner.js` | Deprecation notice |
| `answer-generator.js` | Deprecation notice, METRICS from assistant-contracts |
| `DEPRECATED_AI_MODULES.md` | New – list of deprecated modules |
| `AUDIT_AND_REFACTOR_SUMMARY.md` | New – this file |

## 5. New clinic_patient_analysis Capability

**Intent:** `clinic_patient_analysis`  
**Metric:** `patient_count`  
**Retrieval:** `getClinicPatientCount`  
**Time scope:** `none` (point-in-time count)  
**Entity:** none (clinic-level)

**Supported queries:**
- "Kliniğe kayıtlı kaç adet hasta var?"
- "Sistemde toplam kaç hasta var?"
- "Bu şubede kaç hasta var?"
- "Kaç hasta var?"

**Data aggregator:** `buildClinicPatientCountContext(filter)` – counts patients by organizationId, optionally branchId.

**Deterministic pre-parse:** When the glossary matches patient count patterns, the pipeline skips the LLM and uses a deterministic plan.

## 6. Before/After: Patient Count Query

| Step | Before | After |
|------|--------|-------|
| Semantic analysis | primaryMetricHint=null, intentHint=null | primaryMetricHint=patient_count, intentHint=clinic_patient_analysis |
| Planner | LLM outputs finance_summary + appointment_count | Deterministic plan: clinic_patient_analysis + patient_count (no LLM) |
| Semantic validation | Passes (no expected metric) | N/A – deterministic plan already correct |
| Retrieval | Unsupported (no match) | getClinicPatientCount |
| Answer | "Bu özellik şu an desteklenmiyor." | "Kliniğe kayıtlı X hasta var." |

## 7. Remaining Unsupported Query Classes

- **Clinic patient count comparison** (e.g. "Geçen aya göre hasta sayısı ne kadar arttı?") – not implemented
- **Generic chatbot / open-domain** – out of scope
- **Multi-step reasoning** – out of scope
- **Queries requiring RAG / vector search** – not implemented

## 8. Observability Fields Added

- `deterministicPreparse` – true when hybrid planner used deterministic plan
- `legacyPathUsed` – false (canonical pipeline only)
- `semanticMismatchDetected` – true when raw query meaning conflicts with plan
- Existing: `inheritedContextUsed`, `comparisonRequested`, `comparisonExecutor`, `previousContext`, `requestContextCacheHit`
