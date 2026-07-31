# Task: Fix Critical-Path Exclusion for Tasks With Only a Start Date + Duration

Status: Completed
Owner: Claude Code
Created: 2026-07-23
Task ID: ALL-6 (follow-up fix)
Linear Issue: ALL-6 - https://linear.app/alleato-group/issue/ALL-6/auto-scheduling-cascade-successor-dates-from-dependency-changes-slice
Related: `docs/ops/tasks/2026-07-23-schedule-auto-scheduler-missing-dates-fix.md`,
`docs/ops/tasks/2026-07-23-schedule-gantt-missing-finish-date-fix.md` — same root-cause
class, third distinct consumer.

## Objective

Fix a live inconsistency reported on production project 1144: "Material Delivery"
showed a "Critical" badge but its own predecessor "Mobilization" did not, even though
Mobilization genuinely has zero float (the whole two-task chain is the critical path).

## Debugging (per `.claude/rules/DEBUGGING-GATE.md`)

**Observation.** Queried `schedule_tasks`/`schedule_dependencies` for project 1144
directly: `Mobilization` has `start_date=2026-08-03`, `finish_date=NULL`,
`duration_days=1` — same state as the prior two fixes, expected since the
auto-scheduler deliberately never writes a predecessor's own finish date.

**Localization.** `analyzeScheduleNetwork` flags a task `missing_dates` whenever
`toUtcDay(task.start_date) === null || toUtcDay(task.finish_date) === null` —
requiring both fields literally populated. `is_critical_path` explicitly excludes any
task carrying that warning, regardless of its computed float. But `getTaskDuration`
(used a few lines above the guard, in the same file) already treats `duration_days`
as authoritative and never needs `finish_date` when it's present. Hand-verified the
network math independently: with Mobilization→Material Delivery (FS, lag 0),
Mobilization's early/late start are both day 0 — genuinely zero float — so it should
have been marked critical.

**Root cause:** the exact same bug shape as the auto-scheduler fix and the Gantt fix —
a check written when every task was assumed to always have both dates populated,
which breaks once a task legitimately has only a start date + duration (a state the
auto-scheduler itself creates on purpose).

## Fix

`schedule-network-analysis.ts`: new `hasMissingDates(task)` — true only when there
isn't enough information to derive both a start and a finish
(`(start && finish) || (start && duration) || (finish && duration)` — none of those,
true). Replaces the two-field literal-presence check. No other logic changed;
`getTaskDuration`'s own duration-derivation logic was already correct and untouched.

## Acceptance Criteria

- [x] A task with only `start_date` + `duration_days` (no stored `finish_date`) is not
      flagged `missing_dates` and correctly participates in critical-path/float
      calculation.
- [x] A task with neither `start_date` nor `finish_date` (only `duration_days`, or
      nothing at all) is still correctly flagged `missing_dates` — there's no anchor
      point to compute from, same reasoning as the auto-scheduler's anchor exclusion.
- [x] All 19 pre-existing tests in `schedule-network-analysis.test.ts` (critical path,
      float, constraint/dependency/deadline violations, cycles, invalid calendar
      dates) still pass unchanged.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| New regression test + full existing suite | `npx jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-network-analysis.test.ts` | 20/20 passed |
| Full scheduling suite | `npx jest --runInBand src/lib/scheduling src/lib/services/__tests__/scheduling src/components/scheduling` | 245/249 passed (4 pre-existing, unrelated failures — same as every schedule PR this session) |

## Remaining Risk

- A separate, unrelated finding from the same live session: the user's attempt to add
  "Material Delivery" as a predecessor of a third task ("Pipe Prep") did not persist —
  no dependency row exists in `schedule_dependencies` for it, and no server-side error
  was logged for any dependency-mutation route in the prior 3 hours. This means the
  create request likely never reached the server (client-side issue), not a repeat of
  this bug. Tracked separately — needs the user to retry and report exactly what they
  see (which view, any error toast) before it can be localized.

## Final Status

- [x] Root cause localized via direct DB observation and independent hand-verification
      of the network math before any product-code edit.
- [x] Fix is minimal, scoped to one function; no other logic touched.
- [x] Regression test reproduces the exact live inconsistency.
