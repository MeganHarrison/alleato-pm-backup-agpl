# Task: Honor the configured Graph embedding batch

Status: Complete
Owner: Codex S20260730-RAGBACKLOG
Created: 2026-07-30
Task ID: AAI-1280-RAG-BACKLOG-DRAIN
Linear Issue: Continuation of the user-requested RAG repair
Related Handoff: `docs/ops/handoffs/2026-07-30-S20260730-RAGBACKLOG-rag-backlog-drain.md`

## Objective

Make the Graph cron honor its existing 100-document embedding configuration so the active vector backlog drains at the intended rate without bypassing the daily model budget.

## Scope

- Graph cron runner limit, Render source contract, and focused parity test
- Direct Render cron execution is excluded because no Render API credential is available in this session

## Source of Truth

- Canonical runtime/data owner: Render `alleato-graph-sync`
- Existing shared primitives/services: `backend/scripts/run_graph_sync.py`, `render.yaml`
- Deprecated or parallel paths: hard-coded 25-document runner cap

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The runner and Render environment share one 100-document maximum.
- [x] Daily model budget enforcement remains required.
- [x] Every tested service that calls the PM Supabase client declares the required service-role key.
- [x] Focused regression passes.
- [x] Canonical production source contains the corrected runner.

## Failure-Loudly Contract

- Cause surfaced as: blueprint/runner parity test failure
- Detection path: `backend/tests/test_render_sync_blueprints.py`
- Recovery path: align `GRAPH_EMBEDDING_LIMIT`, runner default, and runner maximum

## Incident Learning

- Failure fingerprint: `operations.provider-runtime-drift`
- Root cause: Render configured 100 candidates while the runner silently clamped the value to 25.
- Detection gap: The parity test asserted only the stale 25 value and never inspected the runner cap.
- Prevention: Assert the configured value and runner bound together; retain the
  deployment contract test for required service credentials.
- Guardrail evidence: `backend/tests/test_render_sync_blueprints.py`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live backlog | Authenticated `/api/health/source-sync` | 2,036 sampled documents lack chunks | Motivates bounded drain repair. |
| Focused deployment contract | `python -m pytest -q backend/tests/test_render_sync_blueprints.py` | 12 passed | Proves 100-item runner/config parity, required budget controls, and Supabase credential declarations. |
| Independent review | `C:\Users\KimiClaw\AppData\Local\Temp\AAI-1280-backlog-independent-review.md` | Approved, no findings | Reviewer repeated the focused test and audited env key scope/duplicates. |

## Remaining Risk

- The budget guard may stop a cycle before 100 candidates if the $10 daily limit is reached. That is intentional.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Task-owned files are published through the required `codex:finish` flow.
