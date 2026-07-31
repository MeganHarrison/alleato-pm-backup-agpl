# Task: Repair production RAG vector handoff

Status: In Progress
Owner: SRAG0731
Created: 2026-07-31
Task ID: LOCAL-20260731-RAG-VECTOR-HANDOFF
Linear Issue: Existing production incident; no new issue requested
Related Handoff: `docs/ops/handoffs/2026-07-31-SRAG0731-rag-vector-handoff-repair.md`

## Objective

Restore the production metadata-to-vector handoff and vectorize only July 31 affected Email, Teams, and SharePoint records.

## Scope

- Dedicated RAG metadata ownership, Graph scheduling, orchestration timeout, and lifecycle-state guardrails.
- Narrow July 31 production replay and affected Project Intelligence refresh.
- Excludes broad historical resync.

## Source of Truth

- Canonical runtime/data owner: Render FastAPI backend and dedicated RAG Supabase database.
- Existing shared services: `backend/src/services/integrations/microsoft_graph/**`, `backend/src/services/supabase_helpers.py`.
- Deprecated or parallel paths: retired worker/Railway paths are excluded.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Missing RAG metadata ownership is repaired and fails loudly.
- [x] Teams DM rotation uses its durable `user:` state key.
- [x] Graph phases cannot silently starve OCR/embedding.
- [x] `workflow_queued` is accepted by the production lifecycle constraint.
- [x] Focused regression tests and independent review pass.
- [ ] July 31 source backlog has nonzero vectors per document and no zero-vector source.
- [ ] Retrieval smoke returns evidence from replayed records.
- [ ] Affected Project Intelligence packets are regenerated and read back.

## Failure-Loudly Contract

- Cause surfaced as: missing RAG replica warning, phase timeout exit 124, or lifecycle constraint failure.
- Detection path: Render logs plus source-level metadata/chunk/status readback.
- Recovery path: exact-ID replay through `/api/pipeline/process`; no unbounded backlog drain.

## Incident Learning

- Failure fingerprint: `ai.sharepoint-static-scope-and-stale-content`
- Root cause: Render lacked the dedicated RAG connection; unchanged SharePoint fast paths assumed a replica; Teams queried the wrong state-key shape; orchestration could terminate before embedding.
- Detection gap: HTTP/process health did not assert source-level vector coverage or retrieval.
- Prevention: dual-write invariant, source-specific scheduler IDs, bounded phases, lifecycle constraint, focused regressions.
- Guardrail evidence: `91 passed, 1 skipped` and independent review with no findings.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | six focused backend test modules | Pass | 91 passed, 1 skipped |
| Published hotfix | staged `run_graph_sync.py` compile | Pass | Corrected timeout-block indentation exposed by the first scoped one-off job |
| Production RAG env | Render env readback | Pass | Dedicated URL and service role configured; values not printed |
| Lifecycle migration | RAG ledger and constraint readback | Pass | Version `20260731183000`; `workflow_queued` accepted |
| Independent review | `docs/ops/tasks/2026-07-31-rag-vector-handoff-repair.independent-review.md` | Pass | No findings |
| End-to-end vector/retrieval | Pending scoped replay | Pending | Required before completion |

## Remaining Risk

- Exact July 31 replay, retrieval, and packet regeneration remain in progress.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in through the code/deployment boundary.
- [x] Deferred production proof is named with the exact next action.
