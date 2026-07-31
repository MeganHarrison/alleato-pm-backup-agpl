# Task: Enforce Shared Table Settings Dropdown Pattern

Status: Complete
Owner: Codex
Created: 2026-07-14
Task ID: LOCAL-2026-07-14-table-settings-design-system-guardrail
Linear Issue: Unavailable — no Linear connector is exposed in this session.

## Objective

Prevent table filter, layout, and display-settings dropdowns from drifting by
making the shared settings popover and site-wide select primitives the default
implementation path.

## Acceptance Criteria

- [x] Filter and display-settings surfaces use one shared popover shell.
- [x] Dropdown fields use the canonical `@/components/ui/select` primitive.
- [x] A regression test proves the shared shell contract and control labels.
- [x] A guardrail check fails when unified table consumers introduce local
  dropdown/popover composition instead of the shared owner.
- [x] Browser verification confirms consistent settings surfaces on documents.

## Failure-Loudly Contract

- Cause: table settings are composed with a page-local shell or inconsistent
  controls.
- Detection: changed-source guardrail plus focused component tests and browser
  DOM inspection.
- Prevention: one shared owner for the popover shell and canonical select
  primitive.

## Verification

- [x] Targeted lint and tests pass.
- [x] Guardrail command passes.
- [x] Browser evidence is recorded.

## Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Shared component lint | Passed with one pre-existing numeric-input warning | `npx eslint src/components/tables/unified/table-toolbar.tsx src/components/tables/unified/table-settings-popover.tsx src/components/tables/unified/index.ts src/components/tables/unified/__tests__/table-toolbar-view-switcher.test.tsx` |
| Focused regression | 3 tests passed | `npx jest --runInBand src/components/tables/unified/__tests__/table-toolbar-view-switcher.test.tsx` |
| Design-system guardrail | Passed | `npm run guardrails:table-settings` |
| Browser proof | Passed | Authenticated `/documents?view=table` inspection showed both settings surfaces render the shared `View settings` header; filter fields retain shared Select controls. |
