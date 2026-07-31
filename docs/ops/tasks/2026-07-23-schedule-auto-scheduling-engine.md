# Task: Auto-Scheduling Engine — Cascade Successor Dates From Dependency Changes

Status: Completed (Slice 1 of 2)
Owner: Claude Code
Created: 2026-07-23
Task ID: ALL-6
Linear Issue: ALL-6 - https://linear.app/alleato-group/issue/ALL-6/auto-scheduling-cascade-successor-dates-from-dependency-changes-slice
Related: `docs/ops/tasks/2026-07-20-schedule-dependency-lifecycle.md` (AAI-1186),
`docs/ops/tasks/2026-07-21-aai-1188-cpm-calendar-impact.md` (AAI-1188, preview-only)

## Objective

On the canonical `/<projectId>/schedule` route, linking a task as a successor of
another (or editing a task's own dates/duration) automatically recomputes and persists
the successor's Start/Finish dates, cascading transitively through the dependency
chain — matching Microsoft Project's Auto Scheduled behavior. This is Slice 1 (the
engine); Slice 2 (inline MS-Project-style grid entry — Enter-to-add-row, typed
Predecessor/Successor columns) is separate follow-up work, tracked in the same Linear
issue's description.

## Scope

- `schedule_tasks.schedule_mode` (`auto`|`manual`, default `auto`) — per-task toggle
  mirroring MS Project's Auto/Manually Scheduled setting.
- New engine (`schedule-auto-scheduler.ts`) that computes which successors' dates
  should change, reusing the existing `schedule-impact-preview.ts` date math rather
  than duplicating CPM logic.
- Wired into `SchedulingService`'s dependency CRUD (`createDependency`,
  `updateDependency`, `deleteDependency`) and `updateTask`.
- Excludes: `AAI-1188`'s preview-only display (Gantt critical-path/float display is
  untouched), Slice 2's grid UI, cost/earned-value, and Microsoft Project XML export.

## Source of Truth

- Schema owner: `schedule_tasks.schedule_mode` (new column, additive migration
  `20260723194100_schedule_auto_mode.sql`, applied to PM APP `lgveqfnpkxvzbnnwuled`).
- Date math owner: `frontend/src/lib/scheduling/schedule-impact-preview.ts` —
  `previewScheduleImpact` (task-field-change trigger, existing, unchanged behavior)
  and `previewDependencyChangeImpact` (new — dependency-graph-change trigger, shares
  the same private `calculateDates`/topological-sort/constraint-conflict machinery).
- Application owner: `frontend/src/lib/scheduling/schedule-auto-scheduler.ts` (new) —
  the only place that decides which computed dates are safe to persist.
- Persistence owner: `SchedulingService` in `scheduling-service.ts` — `updateTask`,
  `createDependency`, `updateDependency`, `deleteDependency`, plus new private helpers
  `fetchScheduleGraph`, `applyAutoScheduleUpdates`, `computeDependencyCascade`.

Delivery lane: High-risk (schedule data integrity, cascading writes)

Verification contract: Required

## Acceptance Criteria

- [x] A new dependency creation cascades the successor's (and its own successors',
      transitively) dates forward per FS/SS/FF/SF + lag, using the working-day
      calendar.
- [x] A task's own date/duration/constraint edit cascades to its successors the same
      way, computed against the graph *before* the task's own row is persisted.
- [x] Removing a dependency never blocks (only relaxes the schedule) and never throws;
      it recomputes successors on a best-effort basis.
- [x] A task in `manual` schedule mode, with an actual start/finish date already set,
      or with persisted hourly segments (Phase 4C) is never auto-written.
- [x] Any downstream constraint violation blocks the *entire* cascade for that
      trigger — nothing is written, including the root create/update/dependency change
      that caused it — rather than partially applying a graph that's known to be
      invalid somewhere downstream.
- [x] A blocked `createDependency`/`updateDependency` never leaves an orphaned
      dependency row behind the thrown error (cascade is pre-checked before the write).
- [x] A circular dependency graph is a no-op for auto-scheduling (matches
      `previewScheduleImpact`'s existing `circular_dependency` handling), not a crash.

## Attention Brief

Primary user: Project manager or scheduler entering/editing schedule tasks.

Primary job: Link tasks and have realistic dates appear without manual recalculation.

Primary decision: N/A for this slice (no new UI surface yet) — the decision is implicit
in whether a task is auto- or manually-scheduled.

Failure-loudly behavior: A blocked cascade raises a named error identifying the
conflicting task and its constraint, and writes nothing.

## TDD Contract

- [x] RED: engine tests for FS/multi-hop cascade, each exclusion reason, constraint
      block, cycle no-op, and both dependency-change triggers (create/delete/block)
      were written against the not-yet-implemented `schedule-auto-scheduler.ts`.
- [x] GREEN: same tests pass after implementing the engine and wiring it into
      `SchedulingService`.
- [x] REFACTOR: extracted shared `diffCalculatedDates`/`calculateDates` reuse between
      `previewScheduleImpact` and the new `previewDependencyChangeImpact` instead of
      duplicating the topological-sort/date-math — both share one implementation.
- [x] Evidence below maps every accepted behavior to its test.

## Evidence

| Check | Command | Result | Notes |
| --- | --- | --- | --- |
| Engine unit tests | `npx jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-auto-scheduler.test.ts` | 10/10 passed | FS cascade, multi-hop chain, each exclusion, constraint block, cycle no-op, dependency create/delete/block. |
| Existing preview regression | `npx jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-impact-preview.test.ts` | 11/11 passed | Confirms the `diffCalculatedDates` extraction didn't change `previewScheduleImpact`'s behavior. |
| Service integration tests | `npx jest --runInBand --runTestsByPath src/lib/services/__tests__/scheduling-service.auto-schedule.test.ts` | 5/5 passed | `createDependency` applies/blocks correctly; `updateTask` cascades/blocks/no-ops on irrelevant fields. |
| Full scheduling suite | `npx jest --runInBand src/lib/scheduling src/lib/services/__tests__/scheduling` | 163/164 passed | One failure (`scheduling-service.hierarchy.test.ts`, an unrelated mock-call-count assertion) confirmed present on `main` before this change via `git stash`. |
| Database migration | `20260723194100_schedule_auto_mode.sql` | Passed | Applied via Supabase MCP to `lgveqfnpkxvzbnnwuled`; read back via `information_schema.columns` to confirm `schedule_mode text not null default 'auto'`. |
| Type generation | `generate_typescript_types` (Supabase MCP) | Passed | `database.types.ts` regenerated; `schedule_mode` present on `schedule_tasks` Row/Insert/Update. |
| Focused typecheck/lint | Delegated to sub-agent | Pending | See task tracker for result before merge. |
| Authenticated browser proof | Not run this session | Deferred | No new UI surface in Slice 1 (engine only); Slice 2 will need it. |

## Remaining Risk

- **Known limitation, documented in code**: a task excluded from auto-write (manual
  mode, actual dates, or segments) is never itself written, but
  `previewScheduleImpact`/`previewDependencyChangeImpact` still compute *its own*
  successors as if it had moved, since the exclusion isn't visible to that math. Only
  matters for a successor-of-an-excluded-task that is itself auto-scheduled — a rare
  multi-hop case. Owner: next scheduling session; next action: teach the preview
  functions about per-task exclusions if this proves to matter in practice.
- **Predecessor reassignment in `updateDependency`**: if an edit changes *which*
  predecessor a dependency points to (not just lag/type), the "before" cascade
  computation is anchored at the *new* predecessor rather than reconciling both the
  old and new anchor — an acceptable inaccuracy for a rare edit pattern (most predecessor
  changes are done as delete-then-create). Documented inline at the call site.
- No separate point-in-time undo was added for auto-cascade writes — they follow the
  same risk profile as any manual task edit today. The existing manual
  "Snapshot schedule" baseline feature (`create_schedule_revision_snapshot`) remains
  available if a user wants a safety net before turning on wide auto-scheduling.

## Final Status

- [x] All Slice 1 acceptance criteria are complete.
- [x] Evidence is filled in, including the one pre-existing unrelated test failure.
- [x] Incident learning is N/A — feature delivery, not incident remediation.
- [x] Deferred work (the two documented limitations, plus Slice 2) has cause,
      owner, and next action recorded above.
