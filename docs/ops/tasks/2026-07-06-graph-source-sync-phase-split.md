# Task: Graph Source Sync Phase Split

Date: 2026-07-06
Linear: AAI-986
Parent: AAI-636
Status: In Progress

## Objective

Split Microsoft Graph source reconciliation from downstream enrichment so the
backend has one explicit source-sync phase and one explicit post-sync phase,
without changing the existing Outlook webhook + delta behavior or the bounded
Teams reconciliation policy.

## Scope

- `backend/src/services/integrations/microsoft_graph/sync.py`
- `backend/src/services/health/pipeline_alert_notifier.py`
- Focused backend regression tests for Graph sync behavior
- Task/evidence documentation for this slice only

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory existing Graph sync and webhook ownership boundaries.
- [x] Choose one canonical sync owner instead of adding a parallel path.
- [x] Refactor Graph sync into distinct source and downstream phases.
- [x] Preserve current Outlook delta, Teams channel, Teams DM, and SharePoint behavior.
- [x] Return structured phase summaries that distinguish source failures from downstream failures.
- [x] Add focused backend regression tests for the new boundary.
- [x] Add alert guardrail for repeated Microsoft Graph downstream failures.
- [x] Run Python compile/pytest for backend changes.
- [ ] Delegate any expensive broad verification to a cheaper sub-agent if available.
- [x] Update task evidence and residual risk after verification.

## Evidence

Evidence will be recorded here as the slice progresses.

Linear issue:

- AAI-986: https://linear.app/megankharrison/issue/AAI-986/split-microsoft-graph-source-reconciliation-from-downstream-enrichment
- Kickoff comment: `918205a4-5443-4433-a534-9802c5baa85d`

Verification:

- `PYTHONPATH=backend backend/.venv/bin/python -m py_compile backend/src/services/integrations/microsoft_graph/sync.py backend/tests/test_graph_sync_options.py` — PASS
- `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_graph_sync_options.py -q` — PASS, `11 passed, 6 warnings`
- `PYTHONPATH=backend backend/.venv/bin/python -m py_compile backend/src/services/integrations/microsoft_graph/sync.py backend/src/services/health/pipeline_alert_notifier.py backend/tests/test_graph_sync_options.py backend/tests/test_pipeline_alert_notifier.py` — PASS
- `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_graph_sync_options.py backend/tests/test_pipeline_alert_notifier.py -q` — PASS, `16 passed, 6 warnings`

Behavior changes captured:

- `run_graph_sync()` now composes `_run_graph_source_reconciliation(...)` and `_run_graph_downstream_processing(...)` instead of treating source acquisition and post-sync enrichment as one flat operational lane.
- Return payload now includes nested `source_sync` and `downstream` summaries plus explicit `source_sync_errors` and `downstream_errors`, while preserving the existing top-level counters/results for compatibility.
- Regression coverage now proves the new phase split reports downstream embedding failures without marking source reconciliation as failed.
- Graph sync now records coarse `source_sync_runs` phase rows for `microsoft_graph_source_sync` and `microsoft_graph_downstream`.
- Pipeline alerting now labels `microsoft_graph_downstream` separately, so repeated downstream enrichment failure pages as downstream enrichment instead of being masked by a successful Graph source sync.

## Initial Constraints

- The checkout already contains substantial unrelated dirty files; this task
  must stay scoped to the Graph sync backend path, its focused tests, and this
  task ledger.
- Do not introduce a second Graph ingestion owner.
- Do not silently downgrade downstream failures into source-sync success.
- No broad verification sub-agent/tool was exposed in this session, so verification
  stayed targeted and local.

## Root Cause

The current backend Graph sync entrypoint combines source reconciliation with
embedding, OCR, attachment promotion, and intelligence extraction inside one
large function. That makes partial downstream failures read like Microsoft sync
failures and obscures whether the problem is source acquisition or later
processing.

## Residual Risk

- This slice changes the result shape by adding nested summaries; it preserves
  the existing top-level counters and downstream result keys, but any consumer
  that assumed `errors` was the only failure breakdown will need to opt into the
  new source/downstream split explicitly.
- This is a code-structure improvement only. It does not yet convert Teams to a
  push-first path or add new provider infrastructure.

## Final Status

- [x] Required checklist items for this slice are complete.
- [x] Evidence is recorded.
- [x] Remaining work is explicitly scoped as follow-up, not hidden in this slice.

## Failure-Loud Guardrail

This slice is not complete unless the Graph sync result can distinguish source
reconciliation outcomes from downstream enrichment outcomes clearly enough that
health/readback can stop treating all partial failures as the same class of
"sync is broken."
