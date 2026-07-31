# Task: Alleato Brain Fireflies Typed Routing

Status: In Progress
Owner: Codex (session SBRAINFIRE)
Created: 2026-07-24
Task ID: ALL-11-FIREFLIES
Linear Issue: ALL-11
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINFIRE-alleato-brain-fireflies-routing.md`

## Objective

Route Fireflies transcripts and chunks to exactly one project or Business Area,
repair persisted fake-project scope on unchanged re-ingests, and fail loudly if
typed assignment is unavailable.

## Scope

- Fireflies ingestion routing and chunk metadata
- Exact app/RAG scope persistence through `SupabaseRagStore`
- Focused Fireflies Business Area regression tests
- Structured meetings temporarily retain the mapped legacy project for existing
  Meetings-tool compatibility; their Business Area schema is a later phase

## Source of Truth

- Assignment: `ProjectAssigner.assign_scope`
- Mapping: `business_area_project_map`
- Persistence: `SupabaseRagStore.set_document_scope`
- Deprecated path: project-only `_infer_project_id_from_context` semantics

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] New mapped Fireflies transcripts persist Business Area-only document scope.
- [x] Chunks carry Business Area scope without a fabricated project ID.
- [x] Existing Business Area scope is authoritative.
- [x] An unchanged mapped legacy transcript bypasses the skip guard once to repair scope.
- [x] Restricted Business Areas persist `access_level='restricted'`.
- [x] Assignment/mapping failures abort ingestion with a specific error.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared assignment and persistence abstractions are reused.
- [x] Errors are specific and actionable.
- [x] App and RAG replicas are written through the exact-scope contract.

## Integration and Verification

- [x] Focused Fireflies tests pass.
- [x] Existing Fireflies regression tests pass.
- [ ] Live Fireflies drift is repaired and the foundation verifier passes.
- [x] Independent review approves the caller contract.
- [x] Test and review evidence artifacts are recorded.
- [ ] Exact owned paths are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: typed assignment, Business Area lookup, or exact-scope
  persistence exception
- Detection path: ingestion job failure, focused tests, and live foundation verifier
- Recovery path: restore the mapping/replica, retry the idempotent transcript,
  and require exact app/RAG parity before closing

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: Fireflies used project-only assignment and skipped unchanged rows
  before checking whether persisted scope was stale.
- Detection gap: the prior verifier used an aggregate snapshot rather than
  exact current per-branch parity.
- Prevention: typed caller, exact persistence, skip-repair regression, live verifier.
- Guardrail evidence: focused and live verification artifacts.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | `pytest -q backend/tests/test_fireflies_business_area.py backend/tests/test_fireflies_action_items.py` | Pass | 64 passed. |
| Independent review | `docs/ops/evidence/2026-07-24-alleato-brain-fireflies-routing/independent-review.md` | Approved | Production wrapper bypass found, fixed, and follow-up approved. |
| Live parity | `node scripts/database/verify-alleato-brain-foundation.mjs` | Pending | Exact production app/RAG proof. |

## Remaining Risk

- Business Area-native meeting/task/file schemas and fake-project archival are
  later plan phases and remain explicitly gated.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Live evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred structured-meeting work names its owner and phase.
