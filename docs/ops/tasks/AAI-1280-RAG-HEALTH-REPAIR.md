# Task: Repair retired RAG source health ownership

Status: In Progress
Owner: Codex S20260730-RAGHEALTH-PROD
Created: 2026-07-30
Task ID: AAI-1280-RAG-HEALTH-REPAIR
Linear Issue: Continuation of the user-requested repair
Related Handoff: `docs/ops/handoffs/2026-07-30-S20260730-RAGHEALTH-rag-health-repair.md`

## Objective

Exclude retired Microsoft Graph source identities from production RAG health without hiding any current owner failure.

## Scope

- `backend/src/services/health/source_sync_health.py`
- Focused regression coverage
- External source backlog repair remains a separate bounded operational step

## Source of Truth

- Canonical runtime/data owner: Render ingestion services and `source_sync_health.py`
- Existing shared primitives/services: current `teams_chat_export` source identity
- Deprecated or parallel paths: `graph_sync_state.source='teams_chat'`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy source identity is excluded from active health.
- [x] Production recompute proves the retired identity no longer consumes alerts.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared inactive-resource predicate owns both live and snapshot filtering.
- [x] Current source errors remain unchanged and actionable.

## Integration and Verification

- [x] Targeted regression test passes.
- [ ] Live-system readback proves the result.
- [ ] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: exact current source/resource alert
- Detection path: authenticated `/api/health/source-sync`
- Recovery path: execute or repair the named current source owner

## Incident Learning

- Failure fingerprint: `rag.retired-source-health-owner-drift`
- Root cause: The API accepted a retired Graph identity that the integration verifier already excluded.
- Detection gap: No health aggregation regression joined source identity to executable ownership.
- Prevention: One inactive-resource predicate filters both live state and snapshots.
- Guardrail evidence: `backend/tests/test_source_sync_health.py`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live localization | Authenticated `GET /api/health/source-sync` | Failed boundary identified | 77 returned critical rows use retired `teams_chat`. |
| Focused regression | `python -m pytest -q backend/tests/test_source_sync_health.py` | Pass, 28 tests | Current sources remain covered; retired live and snapshot rows are excluded. |
| Production recompute | Authenticated `POST /api/health/source-sync/recompute` | Pass for retired-owner repair | Sources fell from 344 to 61 and alerts from 289 to 6; returned `teams_chat` rows fell from 77 to 0. |
| Parent freshness localization | Production recompute plus source-run audit | Failed boundary identified and repaired | Health expected `microsoft_graph`, while the canonical source receipt is `microsoft_graph_source_sync`; the aggregate Graph row was therefore falsely stale. |

## Remaining Risk

- Active SharePoint bootstrap, vectorization, subscription reconciliation, promotion, and Acumatica GI issues remain visible after this repair.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Any deferred work names its owner and next action.
