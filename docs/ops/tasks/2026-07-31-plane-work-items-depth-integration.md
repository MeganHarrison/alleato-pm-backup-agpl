# Task: Plane Work Items Depth Integration

Status: Implementation Complete; Batch Browser Proof Pending
Owner: S20260731-PLANE-WORK-ITEMS-DEPTH
Created: 2026-07-31
Task ID: AAI-PLANE-WORK-ITEMS-DEPTH
Linear Issue: Parent migration program AAI-1288; no new issue requested for this bounded slice.
Related Handoff: N/A for a single-session Standard slice.

## Objective

Make the Plane-derived Work Items replacement preserve its complete view,
search, filter, assignee, sort, and inspector state in the URL while continuing
to read and mutate the existing Supabase-backed Tasks workflow.

## Scope

- `frontend/src/features/plane-work-items/plane-work-items-page.tsx`
- `frontend/src/features/plane-work-items/plane-work-items-page.unit.test.tsx`
- `frontend/src/features/plane-work-items-contracts/**`
- No migrations, production deployment, or legacy-route retirement.

## Source of Truth

- Canonical runtime/data owner: `/api/tasks` and the existing `tasks` lifecycle.
- Existing shared primitives/services: `apiFetch`, `Button`, `Checkbox`,
  `ExpandableSearch`, `Popover`, `Select`, and the existing Radix dialog.
- Deprecated or parallel paths: legacy Tasks pages remain until the replacement
  has batched browser and production parity evidence.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] List, board, calendar, spreadsheet, and Gantt selections are URL-backed.
- [x] Search, state, assignee, priority, due-date, sort, and direction are URL-backed.
- [x] Filtering and sorting operate on real task records returned by `/api/tasks`.
- [x] The inspector is deep-linkable with `peek`, adjacent on desktop, and a
  focus-trapped dialog sheet on mobile.
- [x] Create and status mutation paths continue to use the existing Tasks APIs.
- [x] Missing, denied, and unavailable states have explicit recovery behavior.
- [x] Focused tests and lint pass.
- [ ] Batched authenticated browser parity is recorded by the release owner.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared query and inspector contracts own cross-cutting behavior.
- [x] Existing mutation mutex, rollback, retry, focus restore, and validation
  behavior is preserved.
- [x] No database, authentication, permission, or delivery contract changed.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Actual user-flow readback is recorded at the batch release checkpoint.
- [ ] Evidence artifacts are recorded.
- [x] Known unrelated failures are excluded from this focused slice.
- [ ] Task-owned files are published by the release owner.

## Failure-Loudly Contract

- Cause surfaced as: distinct missing, access-denied, or transient-unavailable
  recovery copy; mutations retain their existing actionable rollback/retry states.
- Detection path: focused unit tests plus the authenticated Work Items route.
- Recovery path: clear the missing peek, return to the project, or retry the
  collection request according to the failure class.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: URL contract unit coverage protects deep links and deterministic
  filtering/sorting; inspector contract coverage protects breakpoint behavior.
- Guardrail evidence: focused Jest tests listed below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and completion gate captured before release. |
| Focused lint | `eslint` on the page, contracts, and tests | Pass | Zero errors; the pre-existing Plane parity warnings remain. |
| Focused Jest | Four `--runTestsByPath` suites | Pass | 42/42 URL, legacy date-range compatibility, auth recovery, filter/sort, inspector focus, controls, page, and mutation tests passed with clean console output. |
| Independent review | Reviewer audit of the owned diff | Pass after fixes | Preserved `due_from`/`due_to`, added collection 401 sign-in recovery, and restored desktop origin focus. |
| Diff integrity | `git diff --check` | Pass | No whitespace errors. |

## Remaining Risk

- Authenticated desktop/mobile screenshots and exact Plane side-by-side
  comparison are intentionally batched with the release checkpoint.
- The page continues to use the existing Tasks domain rather than the deferred
  Cycles/Modules schema foundations.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred browser/release work names its owner and next action.
