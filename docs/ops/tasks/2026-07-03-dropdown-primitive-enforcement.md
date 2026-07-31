# Task: Dropdown Primitive Enforcement

Status: Partial - Browser proof not yet run
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-908
Linear URL: https://linear.app/megankharrison/issue/AAI-908/audit-hand-rolled-dropdownscontext-menus-and-enforce-shared-dropdown
Related Handoff: N/A

## Objective

Audit frontend dropdown/context-menu implementations, replace user-facing hand-rolled menus with the shared dropdown primitive where appropriate, and add a repo guardrail so new bespoke dropdown menus do not slip in.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: Alleato operators and project users interacting with row actions, context menus, and dropdown controls.
Primary job: open a menu and take an action without relearning a different menu layout or interaction model.
Primary decision: what action to take on the current record.
Tier 1: consistent alignment, spacing, hover states, destructive treatment, keyboard/close behavior.
Tier 2: custom right-click positioning where the workflow genuinely needs context menus.
Tier 3: internal implementation details.
Hide until requested: bespoke menu plumbing.
Remove: page-local button-stack menus and ad hoc outside-click handling when the shared primitive already owns it.
Primary action: trigger a menu and select an action.
Failure-loudly behavior: lint must flag new hand-rolled dropdown/menu implementations before merge.

## Acceptance Criteria

- [x] User-facing dropdown/context-menu offenders are inventoried with exact file ownership.
- [x] Every confirmed offender is either migrated to the shared dropdown primitive or explicitly documented as an intentional exception.
- [x] Feedback inbox no longer uses a bespoke button-stack menu.
- [x] Any remaining right-click context menu uses the shared dropdown primitive for items/content, not custom row buttons.
- [x] A lint/design-system guardrail exists for new hand-rolled dropdown/context-menu implementations.
- [x] Focused verification passes for touched files.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing dropdown/context-menu primitive usage mapped before adding new abstractions.
- [x] Guardrail rule targets the real offender shape instead of blocking legitimate overlays/tooling.
- [x] No page-local style-only patches where a shared primitive swap is warranted.
- [x] Intentional exceptions documented with why a shared primitive does not fit.

## Planned Files

- `docs/ops/tasks/2026-07-03-dropdown-primitive-enforcement.md`
- `frontend/src/app/(admin)/feedback-inbox/_components/list-item-context-menu.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/tool-context-section.tsx`
- `frontend/src/components/scheduling/task-context-menu.tsx`
- `frontend/eslint-plugin-design-system/index.js`
- `frontend/eslint-plugin-design-system/rules/no-hand-rolled-dropdown-menu.js`
- `frontend/eslint.config.mjs`

## Integration Checklist

- [x] Linear kickoff comment recorded.
- [x] Inventory distinguishes production user-facing menus from dev-only tooling.
- [x] Shared dropdown primitive remains the single source of truth for menu item alignment/treatment.
- [x] No migration/provider change required, or read-back evidence recorded if that changes.

## Regression Guardrails

- [x] New lint rule added and wired into frontend ESLint config.
- [x] Focused ESLint run passes on touched files.
- [x] Focused type/lint checks pass for task-owned frontend files.
- [ ] Browser/user-flow verification run for at least one migrated menu surface.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task template gate | `AGENTS.md` references `docs/ops/tasks/TASK-TEMPLATE.md` | Process gap | Template path is missing from the repo; this file mirrors the active task-ledger structure already in use. |
| Inventory grep | `rg -n "onContextMenu=|contextPos|menuRef|handleClickOutside|handleEscape|bg-popover p-1|pointerEvents: \"none\"" frontend/src ...` | Pass | Confirmed two production offenders in feedback inbox; scheduling context menu is an intentional exception because it already uses shared `DropdownMenu*` primitives for menu content/items. |
| Remaining offender grep | `rg -n "bg-popover.*p-1|p-1.*bg-popover|shadow-sm.*bg-popover" frontend/src ...` | Pass | After migration, only `frontend/src/components/ui/dropdown-menu.tsx` matches the canonical menu shell pattern. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint -c eslint.config.mjs src/app/(admin)/feedback-inbox/_components/list-item-context-menu.tsx src/app/(admin)/feedback-inbox/_components/tool-context-section.tsx src/components/scheduling/task-context-menu.tsx` | Pass with unrelated warnings | Feedback files pass cleanly. Scheduling file shows pre-existing unrelated warnings for semantic color and arbitrary spacing. |

## Intentional Exceptions

- `frontend/src/components/scheduling/task-context-menu.tsx`: valid custom right-click positioning, but menu content/items already use shared `DropdownMenu` primitives. No migration needed.
- `frontend/src/components/dev/design-violation-overlay.tsx`: dev-only overlay tooling, excluded from the new lint rule.

## Files Changed

- `docs/ops/tasks/2026-07-03-dropdown-primitive-enforcement.md`
- `frontend/src/app/(admin)/feedback-inbox/_components/list-item-context-menu.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/tool-context-section.tsx`
- `frontend/eslint-plugin-design-system/index.js`
- `frontend/eslint-plugin-design-system/rules/no-hand-rolled-dropdown-menu.js`
- `frontend/eslint.config.mjs`
