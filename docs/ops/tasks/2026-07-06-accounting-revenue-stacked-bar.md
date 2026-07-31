# Task: Accounting Revenue By Project Stacked Bar Chart

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: N/A
Linear URL: N/A
Related Handoff: N/A

## Objective

Replace the Revenue by Project list on `/accounting` with a stacked bar chart that shows collected versus open by project.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: accounting operators and project financial reviewers.
Primary job: scan project revenue concentration quickly.
Primary decision: which projects have the highest collected versus open balance.
Tier 1: project bars, collected/open stacked segments, and tooltip detail.
Tier 2: ordering, labels, and supporting summary.
Tier 3: implementation details of the revenue series.
Hide until requested: raw invoice rows and backend aggregation internals.
Remove: row-list clutter that does not help the comparison task.
Primary action: compare project bars and inspect the stack split.
Failure-loudly behavior: if the chart cannot render, the section should show a specific empty/error state rather than disappearing.

## Acceptance Criteria

- [x] The accounting dashboard renders Revenue by Project as a stacked bar chart.
- [x] Each project bar shows collected versus open as stacked segments.
- [x] The page remains quiet and readable, without adding noisy dashboard filler.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing accounting dashboard pattern reused before adding new primitives.
- [x] Client-side revenue chart replaced with stacked bars.
- [x] Failure-loudly behavior preserved for load or data errors.

## Planned Files

- `docs/ops/tasks/2026-07-06-accounting-revenue-stacked-bar.md`
- `frontend/src/app/(admin)/accounting/page.tsx`

## Integration Checklist

- [x] Revenue list replaced by a stacked bar chart.
- [x] Tooltip shows invoiced, collected, and open amounts.
- [x] Browser proof captured for the stacked chart rendering.

## Regression Guardrails

- [x] The stacked chart defaults to the top revenue projects.
- [x] The chart updates without a full page reload.
- [x] The dashboard remains readable and quiet.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear tracking | N/A | Not attempted | Team UUID was not available through the connector in this session. |
| ESLint on touched page | `pnpm --dir frontend exec eslint 'src/app/(admin)/accounting/page.tsx'` | Pass with warnings | No errors; existing `design-system/no-raw-page-grid` warnings remain unrelated to this change. |
| Diff check | `git diff --check` | Pass | No whitespace or patch-format issues. |
| Browser proof | `/tmp/accounting-revenue-stacked.png` | Pass | Authenticated on `/accounting` and confirmed the Revenue by Project section contains collected, open, and invoiced values in the stacked chart section. |
| Page verification | `http://localhost:3001/accounting` | Pass | Live page rendered the new stacked revenue chart after login. |

## Files Changed

- `docs/ops/tasks/2026-07-06-accounting-revenue-stacked-bar.md`
- `frontend/src/app/(admin)/accounting/page.tsx`
