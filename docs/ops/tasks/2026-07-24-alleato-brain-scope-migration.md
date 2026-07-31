# Task: Alleato Brain Existing-Scope Migration Primitive

Status: Complete
Owner: Codex (session SBRAINTARGET)
Created: 2026-07-24
Task ID: ALL-11-SCOPE-MIGRATION
Linear Issue: ALL-11
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINTARGET-alleato-brain-scope-migration.md`

## Objective

Give ingestion callers one shared, explicit way to migrate an existing mapped
legacy-container project into its canonical Business Area without changing
ordinary project attribution.

## Scope

- `ProjectAssigner.assign_scope`
- Focused assignment regression tests
- No caller changes in this slice

## Source of Truth

- Canonical runtime/data owner: `business_area_project_map`
- Existing shared primitive: `backend/src/services/ingestion/project_assignment.py`
- Deprecated or parallel paths: caller-local mapping lookups are prohibited

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Default behavior preserves an existing mapped project for unmigrated callers.
- [x] The explicit migration switch converts only canonical mapped containers.
- [x] Ordinary existing projects remain project-scoped.
- [x] Mapping load failures continue to fail loudly.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] The database mapping remains the only source of truth.

## Integration and Verification

- [x] Focused assignment tests pass.
- [x] Independent review approves the contract.
- [x] Evidence artifacts are recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: mapping-query exception from `assign_scope`
- Detection path: focused unit test and ingestion caller error
- Recovery path: restore Business Area mapping availability; do not duplicate or
  silently fall back to a hard-coded caller map

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: Fireflies preserved an existing fake-project stamp before typed
  Business Area migration had a shared opt-in.
- Detection gap: no caller-safe primitive existed for migrating persisted scope.
- Prevention: explicit shared switch plus project and Business Area regression tests.
- Guardrail evidence: focused test artifact.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | `pytest -q backend/tests/test_project_assignment.py` | Pass | 24 passed. |
| Independent review | `docs/ops/evidence/2026-07-24-alleato-brain-scope-migration/independent-review.md` | Approved | No blocking findings. |

## Remaining Risk

- Callers must opt in deliberately; Fireflies is the first migration consumer.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
