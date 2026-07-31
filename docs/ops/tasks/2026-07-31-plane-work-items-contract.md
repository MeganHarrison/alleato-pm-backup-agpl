# Task: Plane Work Items URL and Inspector Contract

Status: Ready for Integration
Owner: S20260731-PLANE-WORK-ITEMS-CONTRACT
Created: 2026-07-31
Task ID: AAI-PLANE-WORK-ITEMS-CONTRACT
Linear Issue: Program tracked by parent Plane-to-Alleato implementation task
Related Handoff: Parent agent handoff

## Objective

Provide a reusable, Plane-derived contract for URL-backed Work Items controls,
real task filtering/sorting, responsive inspector behavior, and loud recovery
states without editing concurrently owned Work Items pages.

## Scope

- `frontend/src/features/plane-work-items-contracts`
- URL state for view, search, status, assignee, priority, due date, sort, and peek
- Pure filtering/sorting and responsive inspector/recovery contracts
- Excludes page/shell wiring, API/schema changes, migration, and deployment

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/tasks`
- Existing shared primitives/services: `frontend/src/features/tasks/task-utils.ts`
- Plane reference: `makeplane/plane` v1.3.1 layout, issue filter, ordering,
  and side-peek contracts
- Deprecated or parallel paths: current local state in
  `frontend/src/features/plane-work-items/plane-work-items-page.tsx` remains until
  the parent integration slice adopts this contract

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] All requested Work Items controls have canonical URL representations.
- [x] Filtering and sorting execute against real Alleato task-shaped records.
- [x] Desktop and mobile inspector behavior is explicit and testable.
- [x] Missing, denied, and retryable failures provide distinct recovery actions.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy page-local state removal is explicitly deferred to integration.

## Implementation Checklist

- [x] Files/modules to change were listed by the isolated workspace lease.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] No database, authentication, provider, or delivery contracts changed.

## Integration and Verification

- [x] Targeted unit and formatting checks pass.
- [x] Evidence artifacts are recorded.
- [x] Live user-flow proof is deferred because this slice intentionally owns no UI.
- [x] Publication is delegated to the parent integration/release checkpoint.

## Failure-Loudly Contract

- Cause surfaced as: distinct missing, denied, or unavailable state
- Detection path: contract unit tests and consuming UI recovery branch
- Recovery path: clear the missing peek, leave a denied/missing collection, or retry

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check                 | Command / artifact                                                                                                                                                                                          | Result | Notes                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------- |
| Task setup            | This task file                                                                                                                                                                                              | Pass   | Scope and ownership captured before edits.   |
| Plane provenance      | SPDX headers and source references                                                                                                                                                                          | Pass   | Direct Plane contract lineage retained.      |
| Focused behavior      | `npm run test:unit -- --runInBand --silent --runTestsByPath src/features/plane-work-items-contracts/work-items-query.unit.test.ts src/features/plane-work-items-contracts/work-item-inspector.unit.test.ts` | Pass   | 2 suites, 10 tests.                          |
| Targeted lint         | `eslint src/features/plane-work-items-contracts --ext .ts`                                                                                                                                                  | Pass   | No findings.                                 |
| Format and whitespace | `prettier --write ...` and `git diff --check`                                                                                                                                                               | Pass   | Owned files formatted; no whitespace errors. |

## Remaining Risk

- The concurrently owned Work Items page must adopt this contract in a later
  integration slice; until then its current controls remain page-local.

## Final Status

- [x] All required checklist items are complete for the isolated contract slice.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred wiring names the parent integration owner and next action.
