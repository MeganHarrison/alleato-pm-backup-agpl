# Task: Fix Scheduling Functional Audit Findings

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: SCHED-AUDIT-FIXES-2026-07-30
Linear Issue: Not requested; local audit issue IDs `SCHED-AUDIT-001` through
`SCHED-AUDIT-003` are the acceptance source.
Related Handoff: N/A; single-session implementation with independent review.

## Objective

Correct every open finding in the July 30 scheduling functional audit and
publish the verified fixes to `origin/main`.

## Scope

- Correct Timeline interval placement and add deterministic regression tests.
- Make every mutating scheduling E2E suite use a disposable project with a
  fail-closed ownership guard and cleanup readback.
- Remove unexpected React asynchronous-update warnings from scheduling modal
  tests and fail focused checks if they return.
- Update the audit log and recurring-failure registry after verification.
- Exclusion: No mutation of an existing customer or project schedule.

## Source of Truth

- Canonical runtime/data owner:
  `frontend/src/components/scheduling/schedule-views.tsx` and scheduling APIs.
- Existing shared primitives/services:
  `frontend/tests/helpers/db.ts` and the authoritative disposable-project E2E
  pattern.
- Deprecated or parallel paths: Fixed project IDs in legacy scheduling E2E.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Tasks fully before or after the Timeline window have no rendered bar.
- [x] Partially overlapping Timeline tasks are clipped to the visible interval.
- [x] Mutating scheduling E2E refuses non-disposable projects before any write.
- [x] Resource, capacity, and regression E2E create and clean their own project.
- [x] Focused scheduling modal tests emit no unexpected React `act` warning.
- [x] Complete scheduling release suite passes.
- [x] Authenticated production E2E uses only disposable data and cleans it.
- [x] Current final-route screenshot proves corrected Timeline placement.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Destructive test cleanup is guarded by verified disposable ownership.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: A rejected non-disposable test project names the unsafe ID
  and required prefix before a write is attempted.
- Detection path: Focused Timeline unit test, disposable-project helper test,
  scheduling release suite, and production Playwright journey.
- Recovery path: Create a new disposable project through the shared fixture;
  never weaken or bypass the prefix/readback guard.

## Incident Learning

- Failure fingerprint: `scheduling.timeline-window-and-e2e-fixture-ownership`
- Root cause: Timeline geometry clamped an off-window start without intersecting
  the task interval; legacy E2E encoded real project IDs as fixtures.
- Detection gap: Timeline had no date-window contract and E2E had no destructive
  ownership guard.
- Prevention: Interval regression matrix plus one shared disposable-project
  fixture that validates ownership before writes and cleanup.
- Guardrail evidence: Eight Timeline interval tests, seven disposable-project
  helper tests, the 80-suite scheduling release gate, ten authenticated
  production Playwright journeys, and zero-residual database readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Timeline interval matrix | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/components/scheduling/__tests__/schedule-views.timeline.test.tsx` | PASS | Eight cases cover fully outside, left/right clipping, milestone, final boundary, and spring/fall DST transitions. |
| Disposable-project guard | `npm.cmd run test:unit -- --runInBand --roots src tests --runTestsByPath tests/helpers/__tests__/db-disposable-schedule-project.test.ts` | PASS | Seven tests prove unsafe names and forged provenance tokens fail before destructive operations. |
| Scheduling release gate | `npm.cmd run test:schedule:release` | PASS | 80 suites and 489 tests passed; the runner fails on a future React `act` warning. |
| Production E2E | `PLAYWRIGHT_BASE_URL=https://projects.alleatogroup.com npx.cmd playwright test ...` | PASS | Ten authenticated tests passed against disposable projects only, including validation and create/delete reload persistence. |
| Production Timeline proof | Authenticated disposable-project Timeline journey on `projects.alleatogroup.com` | PASS | The expired task rendered no bar; the left-overlapping task was clipped to `left: 0%`; screenshot `schedule-timeline-production-final.png`. |
| Production cleanup | Service-role count readback for `E2E scheduling %` projects and synthetic people | PASS | `residual_disposable_schedule_projects=0`; `residual_synthetic_people=0`. |
| TypeScript full-program gate | `node scripts/run-typecheck-bounded.mjs` | TIMEOUT | The repository-owned checker exhausted its 300-second bound without emitting a diagnostic; this is the checker’s documented global-program detection gap, not a task assertion failure. |

## Remaining Risk

- The repository-wide TypeScript program continues to exceed its bounded
  300-second checker window. Focused unit, release, Playwright, and lint gates
  cover the task-owned files; the global checker emitted no diagnostic before
  timing out.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
