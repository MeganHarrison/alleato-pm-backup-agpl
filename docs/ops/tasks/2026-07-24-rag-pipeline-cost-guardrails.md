# Task: Stop generic-document LLM fan-out and reserve ingestion budget

Status: In Progress
Owner: Codex
Created: 2026-07-24
Task ID: RAG-COST-GUARDRAILS-20260724
Linear Issue: Not requested; task-owned high-risk operating record
Related Handoff: `docs/ops/handoffs/2026-07-24-SROOT-rag-pipeline-cost-guardrails.md`

## Objective

Prevent ordinary SharePoint document ingestion from multiplying into uncapped chat completions, while preserving embedding capacity and recording every future model call with its source and operation.

## Scope

- `backend/src/services/pipeline/model_usage.py`: bucket-specific background model budget guard.
- `backend/src/services/pipeline/llm.py`: explicit operation/source attribution and bounded completion output.
- `backend/src/services/pipeline/document_parser.py` and `backend/src/services/pipeline/orchestrator.py`: deterministic default for generic-document parsing and extraction.
- Focused regression tests and this operating record.
- Excludes clearing the existing SharePoint backlog and reprocessing previously ingested documents.

## Source of Truth

- Canonical runtime/data owner: FastAPI background pipeline and RAG-side `pipeline_model_usage` ledger.
- Existing shared primitives/services: `ModelUsageContext`, `assert_background_model_budget_available`, `record_model_usage`.
- Deprecated or parallel paths: generic document LLM parsing as the default path for every source document.

Delivery lane: High-risk

Verification contract: Required

## Localization Evidence

- Live `pipeline_model_usage` on 2026-07-24 records 2,453 successful anonymous `pipeline_chat_completion` rows totaling $13.834346.
- From 11:00–14:00 UTC, 945 documents changed (mostly SharePoint). The generic document pipeline invokes LLM summary, LLM window segmentation, and LLM structured extraction, each without a source-attributed usage context or completion cap.
- The divergence is between source-document ingestion and the usage ledger: source documents are identifiable in RAG metadata, but their generic pipeline model calls arrive in the ledger as one anonymous operation. This prevents per-source fan-out detection and lets optional extraction consume the shared budget before embedding.

## Acceptance Criteria

- [x] Generic SharePoint/document ingestion takes no chat-completion calls by default; an explicit opt-in is required for document LLM enrichment.
- [x] Signal extraction has a dedicated daily budget that stops optional signal calls before they can consume the shared background budget.
- [x] Embeddings remain protected by the existing global cap after signal extraction reaches its own cap.
- [x] Every retained generic pipeline model call has an operation name, source identity, and bounded completion limit.
- [x] Unit tests prove the default non-LLM path, signal-budget rejection, and attributed/bounded calls.
- [ ] Actual production readback proves the changed source-health cron deployment is live; no pre-existing backlog is misrepresented as repaired.

## Failure-Loudly Contract

- Cause surfaced as: `PIPELINE_DAILY_SIGNAL_BUDGET_USD reached` with operation and source identity in the durable usage ledger.
- Detection path: `pipeline_model_usage` grouped by `source_system`, `source_item_id`, and operation; focused tests reject anonymous generic-document calls.
- Recovery path: inspect the bounded source/operation ledger, adjust the governed signal budget only after reviewing the workload, and explicitly opt in a scoped enrichment run if warranted.

## Incident Learning

- Failure fingerprint: reliability.side-effect-before-durable-ledger
- Root cause: optional, anonymous document enrichment spent from the same global guard as critical ingestion before the ledger could identify or constrain the workload.
- Detection gap: the ledger grouped every generic document call as `pipeline_chat_completion` with no source identity or per-operation budget.
- Prevention: deterministic generic-document handling by default, a dedicated signal cap, and source/operation-level receipts.
- Guardrail evidence: focused model-usage and document-parser regression tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live localization | RAG `pipeline_model_usage` and `rag_document_metadata` readback | Passed | 2,453 anonymous chat calls and 945 changed documents establish the call fan-out boundary. |
| Focused tests | `PYTHONPATH=backend python3 -m pytest backend/tests/test_pipeline_cost_guardrails.py backend/tests/test_pipeline_orchestrator.py backend/tests/test_pipeline_config.py backend/tests/test_document_low_content_pipeline.py backend/tests/test_embed_failover.py -q` | Passed | 37 passed. |
| Compile/static | `python3 -m compileall -q` for changed modules; `git diff --check` | Passed | No compile or whitespace errors. |
| Production config | Render single-variable update plus readback | Passed | $2 signal budget, 1,200 completion cap, and generic enrichment disabled on applicable services. |
| Independent review | Independent high-risk review | Passed | Initial durable-state and config-validation blockers were corrected; re-review approved the final diff. |

## Remaining Risk

- Existing SharePoint retry/backlog and graph-sync memory failure remain production incidents. This task stops new optional LLM fan-out; it does not delete, replay, or repair those sources.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.
