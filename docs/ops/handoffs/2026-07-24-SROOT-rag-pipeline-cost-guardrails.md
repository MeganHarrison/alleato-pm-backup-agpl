# RAG pipeline cost guardrails — handoff

Date: 2026-07-24
Delivery lane: High-risk
Task: `docs/ops/tasks/2026-07-24-rag-pipeline-cost-guardrails.md`

## Confirmed cause

The RAG usage ledger recorded 2,453 successful generic `pipeline_chat_completion`
calls ($13.834346) on 2026-07-24. From 11:00–14:00 UTC, 945 documents changed,
mostly SharePoint. The generic-document pipeline performed LLM summary, LLM window
segmentation, and meeting-style structured extraction by default, creating roughly
three optional model calls per source document. Those calls had neither a source
identity nor an operation-level budget in the usage ledger.

## Change

- Generic documents now use deterministic summary/line-window parsing and skip the
  meeting-oriented extractor by default. `PIPELINE_DOCUMENT_LLM_ENRICHMENT_ENABLED=true`
  is the explicit opt-in.
- Signal work is capped at `PIPELINE_DAILY_SIGNAL_BUDGET_USD` (production: $2.00/day)
  before the existing global background budget, so it cannot consume indexing capacity.
- Signal completions are capped at `PIPELINE_SIGNAL_COMPLETION_MAX_TOKENS` (production:
  1,200) with a safe fallback for malformed or non-positive configuration.
- Usage and budget-blocked ledger rows carry operation, source identity, project, and
  budget bucket. Generic-document terminal skips mark both ingestion state and document
  metadata complete, preventing false "embedded but stuck" health findings.

## Production configuration readback

Configured through Render's single-variable update endpoint and read back successfully:

- `alleato-backend`, `alleato-fireflies-sync`, `alleato-domain-packet-compiler`, and
  `alleato-project-synthesis-sweep`: `PIPELINE_DAILY_SIGNAL_BUDGET_USD=2.00` and
  `PIPELINE_SIGNAL_COMPLETION_MAX_TOKENS=1200`.
- `alleato-backend` and `alleato-fireflies-sync`:
  `PIPELINE_DOCUMENT_LLM_ENRICHMENT_ENABLED=false`.

No secret values were read or recorded.

## Verification

- `PYTHONPATH=backend python3 -m pytest backend/tests/test_pipeline_cost_guardrails.py backend/tests/test_pipeline_orchestrator.py backend/tests/test_pipeline_config.py backend/tests/test_document_low_content_pipeline.py backend/tests/test_embed_failover.py -q` — 37 passed.
- `python3 -m compileall -q` for the changed Python modules — passed.
- `git diff --check` — passed.
- Independent review: approved after the initial durable-state and config-validation blockers were fixed and covered by regression tests.

## Remaining production risks

- The existing SharePoint retry/backlog, graph-sync memory failure, and current day's
  already-spent global budget are intentionally not reset or hidden by this change.
- The first production evidence must show new generic SharePoint files producing zero
  signal calls, while embeddings continue until their global budget is reached.
