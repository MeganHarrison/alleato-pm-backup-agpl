# Task: Gantt Task-Name Labels Next to Bars

Status: Completed
Owner: Claude Code
Created: 2026-07-23
Task ID: ALL-6 (follow-up)
Linear Issue: ALL-6 - https://linear.app/alleato-group/issue/ALL-6/auto-scheduling-cascade-successor-dates-from-dependency-changes-slice

## Objective

Match Microsoft Project's convention (per a reference screenshot Brandon supplied): the
task name renders directly next to its bar in the timeline area, not only in the
left-side task-list panel. Placement defaults to the right of the bar and flips to the
left when there isn't room, so the label never runs off the visible chart.

## Scope

- `gantt-chart.tsx`: `TaskBar` now renders an SVG `<text>` label next to both regular
  bars and milestone diamonds.
- Placement is computed per-task from an estimated label width (character count ×
  average glyph width — no DOM text measurement available in this render pass) versus
  the chart's total scrollable width (`totalWidth`, already computed by the parent for
  the "today" line and grid). Right by default; left (`text-anchor="end"`) when the
  label would overflow.
- Purely additive/visual — no data model or API change.

## Acceptance Criteria

- [x] A task's name renders as a label next to its bar in the timeline, not just in
      the left list panel.
- [x] The label sits to the right of the bar by default.
- [x] A label that would run past the chart's right edge flips to the left instead of
      being clipped or overflowing.
- [x] A milestone's name label renders next to its diamond marker the same way.
- [x] Existing Gantt tests (baseline overlay, calendar exceptions) unaffected.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| New label tests | `npx jest --runInBand --runTestsByPath src/components/scheduling/__tests__/gantt-chart-task-label.test.tsx` | 3/3 passed (right-default, left-flip via an intentionally oversized name, milestone label) |
| Existing Gantt suites unaffected | `npx jest --runInBand --runTestsByPath src/components/scheduling/__tests__/gantt-chart.baseline.test.tsx src/components/scheduling/__tests__/gantt-chart.calendar.test.tsx` | 3/3 passed |
| Full scheduling suite | `npx jest --runInBand src/lib/scheduling src/lib/services/__tests__/scheduling src/components/scheduling` | 244/248 passed (4 pre-existing, unrelated failures — same as every other schedule PR this session) |

## Remaining Risk

- Label width is estimated (character count × average glyph width), not measured from
  the actual rendered font — a reasonable approximation for a monospace-ish sans-serif
  at this size, but not pixel-exact. Could misjudge the flip point by a few characters
  in either direction; low-severity (worst case, a label sits slightly closer to the
  edge than ideal, never clipped entirely since the flip logic is symmetric).
- No authenticated browser proof yet — same environment gap as `#102`/prior schedule
  PRs this session.

## Final Status

- [x] All acceptance criteria complete.
- [x] Evidence filled in.
- [x] No data/API changes — purely additive rendering.
