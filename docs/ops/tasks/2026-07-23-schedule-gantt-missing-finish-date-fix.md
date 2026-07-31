# Task: Fix Gantt Dependency Line Detached From Task Bar (Missing Finish Date)

Status: Completed
Owner: Claude Code
Created: 2026-07-23
Task ID: ALL-6 (follow-up fix)
Linear Issue: ALL-6 - https://linear.app/alleato-group/issue/ALL-6/auto-scheduling-cascade-successor-dates-from-dependency-changes-slice
Related: `docs/ops/tasks/2026-07-23-schedule-auto-scheduler-missing-dates-fix.md` (same
root-cause class, different code path)

## Objective

Fix a visual bug reported live on production project 1144: the dependency connector
line on the Gantt chart between "Mobilization" and "Material Delivery" did not
originate from Mobilization's actual bar position.

## Debugging (per `.claude/rules/DEBUGGING-GATE.md`)

**Observation.** Queried `schedule_tasks` for project 1144: `Mobilization` has
`start_date=2026-08-03`, `finish_date=NULL`, `duration_days=1` — expected, since the
auto-scheduler (previous fix) deliberately never writes a predecessor's own finish
date, only its successors'.

**Localization.** `SchedulingService.getGanttData` built each Gantt item with
`finish_date: task.finish_date || today`. With `finish_date` null and `today` (the
session date) being `2026-07-23` — well before Mobilization's real `2026-08-03` start —
the API returned an **inverted interval** (`finish < start`) for Mobilization. The
Gantt renderer positions bars and dependency-line anchors from this interval, so an
inverted one produces a detached/misplaced bar and a connector line that doesn't
originate from the true start position. Boundary: the API layer's date-fallback logic,
not the Gantt rendering component itself and not the dependency data (which was
correct).

## Fix

`scheduling-service.ts`: new private `deriveGanttDates(task, calendar, today)`. When a
date is missing but `duration_days` is present, derives it from the other date using
the same working-day math (`addWorkingDays`) already used by the auto-scheduler,
instead of defaulting straight to `today`. Falls back to `today` only when truly
nothing can be derived (both dates and duration missing). Read-time only — no data
backfill needed, unlike the auto-scheduler fix (that one only fires on write events).

## Acceptance Criteria

- [x] A task with only `start_date` + `duration_days` gets a derived `finish_date` on
      the Gantt feed, never one before its start.
- [x] A task with only `finish_date` + `duration_days` gets a derived `start_date`
      symmetrically.
- [x] A task with genuinely no dates and no duration still falls back to `today` (no
      behavior change for that edge case).
- [x] Existing `getGanttData` tests (dependency/deadline pass-through, calendar
      exception handling) unaffected.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| New regression test | `npx jest --runInBand --runTestsByPath src/lib/services/__tests__/scheduling-service.gantt.test.ts` | 3/3 passed |
| Full scheduling suite | `npx jest --runInBand src/lib/scheduling src/lib/services/__tests__/scheduling src/components/scheduling` | 241/245 passed (4 pre-existing, unrelated failures — same as prior schedule PRs) |

## Final Status

- [x] Root cause localized via direct DB observation before any product-code edit.
- [x] Fix is read-time only; no data backfill required (unlike the auto-scheduler fix).
- [x] Regression test reproduces the exact live failure.
