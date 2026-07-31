# Task: Microsoft Project XML schedule export

Status: Published and deployed; authenticated browser evidence blocked
Owner: Codex
Created: 2026-07-29
Task ID: SCHED-MSPDI
Delivery lane: Standard

## Objective

Add a relationship-aware Microsoft Project XML Data Interchange (MSPDI) export
alongside the intentionally flat CSV and JSON snapshots.

## Acceptance contract

- [x] Export uses the Microsoft Project XML namespace and Project 2007
  `SaveVersion` 12 interchange contract.
- [x] Task hierarchy, deterministic UIDs, dates, durations, progress, actuals,
  remaining duration, deadlines, constraints, work, milestones, dependencies,
  and signed lag export.
- [x] Broken references and lossy fields are surfaced to the operator.
- [x] Duplicate task IDs and cyclic hierarchy fail loudly.
- [x] Focused unit and component tests pass.
- [x] Independent React/accessibility review approves.
- [x] Independent code review approves.
- [ ] Desktop and 390px final-route screenshots are captured.
- [x] Exact owned files publish to `origin/main`.

## Interchange boundary

The MSPDI export preserves task and relationship data that the flat snapshots
omit. Alleato project/resource calendars, assignment rates/costs, leveling
segments, baselines, revisions, risks, and trade alerts remain outside this
export phase. The file declares a standard Monday-Friday, eight-hour calendar
and emits an operator warning that Project can recalculate custom-calendar
schedules differently. Manual-task dates are exported, but the Project 2007
schema does not preserve Alleato's schedule-mode flag.

## Primary schema references

- Microsoft Project XML Data Interchange `Project` schema
- Microsoft Project XML Data Interchange `Tasks` schema
- Microsoft Project XML `PredecessorLink`, `LinkLag`, `LagFormat`,
  `DurationFormat`, and `ConstraintType` elements

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Focused Jest | Pass | 2 suites, 21 tests cover MSPDI integrity, remaining duration, schema limits, calendar disclosure, and the export dialog. |
| Focused ESLint | Pass | Zero warnings or errors in the four changed TypeScript/TSX files. |
| Changed type debt | Pass | `typecheck:changed` reports no new `any` debt. |
| Scheduling release suite | Pass | The later complete scheduling gate passed 72/72 suites and 402/402 tests, including this export and the previously timing-sensitive resource hook. |
| Code review | Approve | Final bounded review found no remaining high/medium integrity defects after the calendar, remaining-duration, and outline-limit fixes. |
| React/accessibility review | Approve | Mobile scrolling, one live result status, and stable warning keys approved. |
| Publication | Pass | Rebasing over the concurrent CRM release was conflict-free; focused tests remained 21/21, and `origin/main` matched `2f61ef463825d4a6add7e7a3d4826b4b45dab3c4`. |
| Canonical deployment | Pass | Vercel deployment `dpl_C9tfWTHswamDnDRKNS47raxLjR65`, which includes the XML export, reached Ready and owns `projects.alleatogroup.com`. |
| Browser screenshots | Blocked | Authenticated Chrome timed out and became unavailable; the replacement in-app browser redirects the schedule route to login and no reusable authenticated storage state exists. No live data was changed. |
