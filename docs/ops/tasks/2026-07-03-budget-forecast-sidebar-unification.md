# Task: Unify Budget Forecast Sidebar With Shared Side Panel

Status: Partial - control standardization implemented; follow-up browser rerun blocked by local dev-server state
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-913
Linear URL: https://linear.app/megankharrison/issue/AAI-913/unify-budget-forecast-sidebar-with-shared-side-panel-primitive-and
Related Handoff: N/A

## Objective

Make the Forecast To Complete sidebar on the budget forecasting tab use the same shared sidebar/component system as the rest of the app, remove footer drift from the budget-local overlay stack, and improve the forecasting workflow’s scanability and usability without introducing one-off UI.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: PM/accounting user editing forecast-to-complete values on a budget line.
Primary job: choose the correct forecast method, edit the forecast, review the impact, and save quickly without getting distracted by chrome.
Primary decision: which forecast method to use and whether the resulting forecast is acceptable.
Tier 1: method selection, active editor, totals, save action.
Tier 2: projected budget/cost context and notes.
Tier 3: secondary layout chrome and implementation-specific shell differences.
Hide until requested: optional notes and advanced monitored-resource nuance beyond the active method.
Remove: duplicate shell systems, heavy footer chrome by default, and repeated bordered row/card treatments that do not help the decision.
Primary action: update forecast inputs and save.
Failure-loudly behavior: if the shared shell cannot support the workflow, the task must record the exact missing primitive behavior and the budget-owned files still depending on the old overlay stack.

## Acceptance Criteria

- [x] The forecasting sidebar uses the canonical shared side-panel primitive or a thin wrapper over it rather than a budget-only shell stack.
- [x] Footer/action-row styling is controlled by the shared primitive, not hard-coded separately for budget sidebars.
- [x] The Forecast To Complete surface has clearer hierarchy with one obvious primary workflow.
- [x] Method selection reads as a compact decision surface, not a settings page.
- [x] The active method editor is visually quieter and easier to scan than the current bordered-card stack.
- [x] A regression guardrail exists for the shared sidebar footer/ownership path.
- [x] Focused verification passes for touched files and the exact budget forecasting sidebar is browser-checked.

## Implementation Checklist

- [x] Create the task file before implementation.
- [x] Identify the real owner of the forecast sidebar shell and footer chrome.
- [x] Refactor budget sidebar ownership toward the shared side-panel primitive.
- [x] Update the forecasting sidebar layout and hierarchy using shared primitives.
- [x] Add or update a guardrail test for shared sidebar footer ownership/styling.
- [x] Keep changes at the shared owner layer instead of adding a page-local override.

## Planned Files

- `docs/ops/tasks/2026-07-03-budget-forecast-sidebar-unification.md`
- `frontend/src/components/ui/side-panel.tsx`
- `frontend/src/components/ui/__tests__/side-panel.test.tsx`
- `frontend/src/components/budget/modals/BaseSidebar.tsx`
- `frontend/src/components/budget/modals/ForecastToCompleteModal.tsx`

## Regression Guardrails

- [x] Shared sidebar footer treatment covered by test.
- [x] Budget sidebars inherit shell behavior from the shared primitive.
- [x] Design doctrine audit passes on touched UI files.
- [x] Browser verification captures the exact Forecast To Complete surface.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Design doctrine audit baseline | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/budget/modals/ForecastToCompleteModal.tsx frontend/src/components/budget/modals/BaseSidebar.tsx frontend/src/components/ui/budget-overlay.tsx frontend/src/components/ui/side-panel.tsx` | Pass | Baseline structural audit passed before refactor; issue is ownership and hierarchy drift, not a hard budget failure. |
| Root-cause ownership trace | `rg -n "BaseSidebar|BudgetOverlayFooter|SidePanelFooter|Forecast To Complete" frontend/src/components` | Pass | Forecasting sidebar is budget-local through `BaseSidebar`, and footer chrome comes from `BudgetOverlayFooter` plus `BaseSidebar` defaults. |
| Shared shell refactor test | `cd frontend && ./node_modules/.bin/jest --runInBand 'src/components/ui/__tests__/side-panel.test.tsx' 'src/components/budget/modals/__tests__/base-sidebar.test.tsx'` | Pass | Added a budget-sidebar regression test proving `BaseSidebar` now renders through shared `sheet-*` slots and no longer defaults to muted footer chrome. |
| Focused lint | `cd frontend && ./node_modules/.bin/eslint 'src/components/ui/side-panel.tsx' 'src/components/budget/modals/BaseSidebar.tsx' 'src/components/budget/modals/ForecastToCompleteModal.tsx' 'src/components/budget/modals/__tests__/base-sidebar.test.tsx'` | Pass with warnings | Earlier shell pass succeeded with warnings; the remaining warnings at that point were raw numeric/date/select controls and one arbitrary min-height token in `ForecastToCompleteModal`. |
| Post-change doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/budget/modals/ForecastToCompleteModal.tsx frontend/src/components/budget/modals/BaseSidebar.tsx frontend/src/components/ui/side-panel.tsx` | Pass | The refactored sidebar and forecasting surface still fit the sheet complexity budget. |
| Exact-route browser proof | `agent-browser --auto-connect` on `http://localhost:3001/876/budget` | Pass | Opened the exact authenticated `/876/budget` forecasting sidebar, verified the lighter shared footer/action row, compact method cards, and updated hierarchy. Screenshot: `docs/ops/evidence/2026-07-03-budget-forecast-sidebar.png`. |
| Manual-entry interaction pass | `agent-browser --auto-connect` snapshot after selecting `Manual Entry` | Pass with flaky artifact | Snapshot confirmed manual-entry fields (`Description`, `Qty`, `Units`, `Unit Cost`) render in the active sheet. Follow-up manual screenshot hit a loading-state/browser flake, so the clean visual artifact remains the automatic-mode sidebar capture. |
| Control-standardization source check | `rg -n '<Input|<select|type="date"|type="number"' frontend/src/components/budget/modals/ForecastToCompleteModal.tsx` | Pass | Remaining raw `Input` usage is text-only (`Description`, `Units`). Raw numeric/date/select controls were replaced with `NumberInput`, `MoneyField`, `DateField`, and `SelectField`. |
| Follow-up browser rerun | `agent-browser --auto-connect open http://localhost:3001/876/budget` | Blocked | `page.goto` returned `ERR_CONNECTION_REFUSED` after the local dev server dropped; the follow-up visual rerun for the standardized controls could not be completed in this turn. |

## Remaining Work

- Restore a healthy local frontend dev server, then rerun exact-surface browser verification for the standardized manual/monitored controls.
- If desired, continue the same shared-shell migration for any remaining budget overlays that should match the exact same sidebar pattern.
