# Task: Plane Work Items mutation reliability

Status: Pending Review
Owner: S20260731-PLANE-CUTOVER
Created: 2026-07-31
Task ID: AAI-1289 / AAI-1290
Linear Issue: AAI-1289 / AAI-1290
Related Handoff: N/A

## Objective

Make Plane Work Items create and status-change interactions fail visibly,
preserve user work, and remain safe when responses arrive out of order.

## Scope

- Own mutation state and interaction behavior in
  `frontend/src/features/plane-work-items/plane-work-items-page.tsx`.
- Own focused deterministic tests in
  `frontend/src/features/plane-work-items/plane-work-items-page.unit.test.tsx`.
- Preserve existing query, view, filter, and inspector state.
- Exclude API route changes, schema changes, production data mutations,
  deployment, and publication.

## Source of Truth

- Canonical runtime/data owner: existing `/api/tasks` POST and
  `/api/tasks/[taskId]` PATCH contracts.
- Existing shared primitives/services: `apiFetch`, `ApiError`, `Button`, and
  `Input`.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Create validates the title field and preserves the draft on validation or
  request failure.
- [x] Create exposes saving, retryable failure, and permission-denied states.
- [x] Status changes update optimistically and expose a saving indicator.
- [x] A current rejected status request rolls back both the work surface and an
  open inspector.
- [x] A stale success or failure cannot overwrite or roll back a newer request.
- [x] Per-task status writes are serialized across selects, keyboard use, retry,
  and board drag-and-drop.
- [x] Rapid create submission is synchronously mutexed to one POST.
- [x] Retry reuses the rejected target status.
- [x] Expired authentication offers sign-in recovery separately from
  non-retryable permission denial.
- [x] List and board surfaces provide a keyboard-accessible status select in
  addition to board drag-and-drop.
- [x] The inspector is an aria-modal dialog with focus entry/trapping, Escape
  close, background inerting, focus restoration, and an accessible status
  label.
- [x] Mutation behavior does not rewrite active query or filter state.

## Implementation Checklist

- [x] Files/modules to change were listed before edits.
- [x] Shared mutation helpers own error classification and stale-response
  behavior.
- [x] Errors are specific, actionable, and rendered with live/alert semantics.
- [x] No database, provider, API, or permission contract was changed.

## Integration and Verification

- [x] Focused unit tests cover success, validation, rejected create draft
  preservation/retry, current rollback across list and inspector, stale
  success/failure, deferred concurrency, authentication recovery, permission
  denial, and rendered modal interactions.
- [x] Focused ESLint passes with zero errors.
- [x] `git diff --check` passes.
- [ ] Independent review is recorded.
- [x] No production data call or deployment was performed.

## Failure-Loudly Contract

- Cause surfaced as: field validation beside the create input, a visible
  `Saving…` state, or a specific inline request/permission error.
- Detection path: focused unit tests exercise each transition and the UI exposes
  retry only for retryable failures.
- Recovery path: correct the field, retry the preserved create draft or rejected
  status target, or request project permission when access is denied.

## Incident Learning

- Failure fingerprint: concurrent create/status requests could be admitted
  before React committed the disabled state; the inspector overlay lacked the
  shared modal interaction contract.
- Root cause: request IDs discarded stale client responses but did not prevent
  the backend from committing concurrent writes in reverse order, and the
  inspector used a visual overlay instead of the canonical dialog primitive.
- Detection gap: the original tests called mutation helpers serially and used
  static markup, so they could not observe same-tick duplicate admission,
  rendered two-surface rollback, or modal focus behavior.
- Prevention: synchronous mutation mutexes reject duplicate admission before
  React state updates; the shared Dialog primitive owns focus/inert behavior;
  deferred and rendered interaction tests guard both boundaries.
- Guardrail evidence: Commands recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused Work Items tests | `node node_modules/jest/bin/jest.js --no-cache --runInBand --silent --runTestsByPath 'src/features/plane-work-items/plane-work-items-page.unit.test.tsx'` | Passed | 24 tests passed, including deferred concurrency, board drag locking, and rendered interactions. |
| Focused navigation tests | `node node_modules/jest/bin/jest.js --runInBand --silent --runTestsByPath 'src/lib/__tests__/navigation-config.unit.test.ts'` | Passed | 29 tests passed. |
| Focused lint | `npx eslint 'src/features/plane-work-items/plane-work-items-page.tsx' 'src/features/plane-work-items/plane-work-items-page.unit.test.tsx' --quiet` | Passed | Zero errors. |
| Whitespace | `git diff --check` | Passed | No whitespace errors. |
| Production safety | No browser/API mutation command executed | Passed | Verification is deterministic and local only. |

## Remaining Risk

- Authenticated browser mutation verification is deliberately deferred to the
  program’s next batch verification checkpoint; this slice performs no
  production writes.
- The installed Jest dependency tree cannot start `jest-environment-jsdom`
  because its runtime and mock internals are mismatched. This focused test
  installs an isolated JSDOM document under the default Node environment, so
  the rendered React/Radix interactions remain covered without changing shared
  dependencies.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning records the concurrency and modal-contract gaps.
- [x] Deferred authenticated verification is documented.
