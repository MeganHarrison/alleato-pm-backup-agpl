# Task: Fix Auto-Scheduler Silently No-Opping on Tasks With No Dates Yet

Status: Completed
Owner: Claude Code
Created: 2026-07-23
Task ID: ALL-6 (follow-up fix)
Linear Issue: ALL-6 - https://linear.app/alleato-group/issue/ALL-6/auto-scheduling-cascade-successor-dates-from-dependency-changes-slice
Related: `docs/ops/tasks/2026-07-23-schedule-auto-scheduling-engine.md` (the engine this
bug is in)

## Objective

Fix a live bug found immediately after shipping the auto-scheduling engine (#106/#107):
linking a task as a successor of another silently did nothing when either task had
only a duration/start date set (no explicit finish date) — the overwhelmingly common
state for a freshly created task, and exactly the scenario Megan/Brandon demonstrated
live on production project 1144 ("Nexcom").

## Debugging (per `.claude/rules/DEBUGGING-GATE.md`)

**Observation, not a guess.** Queried `schedule_tasks` for project 1144 directly:

```
Mobilization:      start_date=2026-08-03  finish_date=NULL  duration_days=1
Material Delivery: start_date=NULL        finish_date=NULL  duration_days=5
```

The dependency row itself existed (create succeeded) but neither task's dates moved.

**Localization.** `calculateDates` (`schedule-impact-preview.ts`) aborts the entire
computation with `reason: "missing_dates"` if ANY task in the affected closure lacks a
parseable `start_date` AND `finish_date` — regardless of whether `duration_days` alone
is sufficient to compute one. `resolveAutoScheduleResult` treats that `"unavailable"`
status as a silent `"no_change"`. Boundary: the guard in `calculateDates`, not the
dependency CRUD (which worked correctly) and not the UI (which called the right
functions with the right arguments).

**Root cause, confirmed by reading the computation, not assumption:** every task's
`finish` is *always* recomputed fresh as `dateForFinish(start, duration)` — `finish_date`
is never read by the actual math, only by the guard. A non-anchor task's `start_date`
is only an initial fallback that a real dependency edge always overrides via `later()`
(every non-anchor task in the closure has ≥1 incoming edge, by construction). The only
date that must be genuinely real is the **anchor's own `start_date`** — the one value
nothing derives for it. The guard required all four fields present when only one
(the anchor's start) actually mattered.

## Fix

`schedule-auto-scheduler.ts`: new `seedMissingDatesForCascade(tasks, anchorTaskId)`,
called before handing tasks to `previewScheduleImpact`/`previewDependencyChangeImpact`.
For any task with a valid `duration_days` that's missing a date, seeds a deliberately
ancient placeholder (`1900-01-01`) purely to satisfy the guard — except the anchor's
`start_date`, which is left alone (if genuinely missing, `missing_dates` remains the
correct, honest result — there's nothing to cascade from). The placeholder is never
written anywhere; `resolveAutoScheduleResult` builds the final update list from the
*original*, unseeded task objects.

## Acceptance Criteria

- [x] A successor with only a duration (no start/finish at all) gets both filled in
      when linked to a predecessor.
- [x] A predecessor with only a start date (no finish) can still anchor a cascade.
- [x] A predecessor missing even its own start date still correctly reports no change
      — that's a genuine "nothing to anchor from" case, not a bug.
- [x] All 11 existing `schedule-impact-preview.test.ts` cases (the original preview-only
      modal flow, untouched) still pass — the fix lives entirely in the new
      auto-scheduler module, not the shared date-math file.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| New regression tests | `npx jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-auto-scheduler.test.ts` | 13/13 passed (3 new: successor-no-dates for both triggers, anchor-no-dates negative case) |
| Existing preview suite unchanged | `npx jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-impact-preview.test.ts` | 11/11 passed |
| Full scheduling suite | `npx jest --runInBand src/lib/scheduling src/lib/services/__tests__/scheduling src/components/scheduling` | 240/244 passed (4 pre-existing, unrelated failures — same as Slices 1/2) |

## Remaining Risk

None new. Same documented limitations carried over from the original engine (task doc
above): the excluded-task multi-hop edge case, and no separate point-in-time undo.

## Final Status

- [x] Root cause localized via direct DB observation before any product-code edit.
- [x] Fix is minimal and scoped to the new module; the shared, well-tested
      `schedule-impact-preview.ts` preview logic is untouched.
- [x] Regression tests added reproducing the exact live failure.
- [x] Guardrail: this class of bug (silent no-op when a downstream trigger returns
      "unavailable") is now covered by explicit tests asserting `"applied"`, not just
      absence-of-error — future changes to the missing-dates guard will fail loudly
      here if they regress.
