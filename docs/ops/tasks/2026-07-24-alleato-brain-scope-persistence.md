# Task: Alleato Brain Exact Scope Persistence

Status: Complete
Owner: Codex (session SBRAINSCOPESTORE)
Created: 2026-07-24
Task ID: ALL-11-SCOPE-PERSISTENCE
Linear Issue: ALL-11
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINSCOPESTORE-alleato-brain-scope-persistence.md`

## Objective

Persist one exact document scope across the PM app catalog and AI Database,
including clearing a stale project or Business Area value.

## Scope

- Shared `SupabaseRagStore` persistence boundary
- Focused Business Area storage tests
- No ingestion caller changes in this slice

## Source of Truth

- Canonical app scope: `document_metadata.project_id/business_area_id`
- Canonical RAG replica: `rag_document_metadata.project_id/source_metadata`
- Existing shared primitive: `SupabaseRagStore`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Dual project/Business Area scope is rejected.
- [x] Business Area assignment explicitly clears stale project IDs in both databases.
- [x] Project assignment explicitly clears stale Business Area metadata.
- [x] Missing replica rows fail loudly.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors identify the missing persistence boundary.
- [x] No schema change is required.

## Integration and Verification

- [x] Focused tests pass.
- [x] Independent review approves the cross-database contract.
- [x] Evidence artifacts are recorded.
- [ ] Exact owned paths are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: explicit missing app/RAG row or invalid dual scope exception
- Detection path: caller failure plus exact parity verifier
- Recovery path: retry the idempotent exact-scope write after restoring the
  missing replica; never silently retain the old scope

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: ordinary metadata upserts omit nulls and cannot clear migrated scope.
- Detection gap: no exact two-database scope persistence primitive.
- Prevention: centralized method and focused replica assertions.
- Guardrail evidence: regression test artifact.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | `pytest -q backend/tests/test_business_area_embedder.py` | Pass | 6 passed. |
| Independent review | `docs/ops/evidence/2026-07-24-alleato-brain-scope-persistence/independent-review.md` | Approved | Initial ordering blocker fixed; follow-up approved. |

## Remaining Risk

- Cross-database writes cannot be transactional; a partial provider failure is
  surfaced and the idempotent caller retry plus parity verifier repairs/detects it.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
