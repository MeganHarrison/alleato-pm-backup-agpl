Status: Partial - Browser verification not yet run
Owner: Codex
Created: 2026-07-03
Linear Issue: N/A
Linear URL: N/A
Related Handoff: N/A

## Objective

Clarify and enforce the two supported tab primitives in the frontend:

- `PageTabs` for page-level or top-of-tool navigation
- `Tabs` / `TabsList` / `TabsTrigger` for section-level content tabs

Make the desired path the easiest path by tightening shared exports, updating the shared header, and adding architectural lint boundaries instead of adding many narrow behavioral lint rules.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: engineers and coding agents working in shared frontend surfaces.
Primary job: choose the correct tab primitive without inventing a new one or styling the wrong one into shape.
Primary decision: is this page/tool navigation or section/content switching?
Tier 1: a clear primitive split and import path.
Tier 2: lint that blocks the wrong primitive boundary.
Tier 3: migration of old call sites.
Hide until requested: implementation details of legacy migration debt.
Remove: duplicate tab primitives and exports that imply multiple site-standard answers.
Primary action: import the right primitive and use it directly.
Failure-loudly behavior: lint flags banned imports and deprecated tab surfaces before merge.

## Acceptance Criteria

- [x] The shared code documents the distinction between page tabs and section tabs.
- [x] `PageTabsV2` is no longer presented as a normal production path.
- [x] Shared page-header tabs use `PageTabs`, not `PageTabsV2`.
- [x] Lint blocks direct use of deprecated `PageTabsV2`.
- [x] Lint blocks raw Radix tabs imports outside the shared `ui/tabs` primitive.
- [x] Lint blocks new `TabsList variant="line"` usage.
- [x] Focused verification passes for all touched files.

## Implementation Checklist

- [x] Create the task file before implementation.
- [x] Review current tab primitives and exports.
- [x] Update shared components so the desired path is the path of least resistance.
- [x] Add architectural lint boundaries instead of one-off page-specific rules.
- [x] Preserve existing legacy call sites unless they are in touched shared ownership surfaces.

## Planned Files

- `docs/ops/tasks/2026-07-03-tab-primitive-ownership.md`
- `frontend/src/components/layout/PageTabs.tsx`
- `frontend/src/components/layout/PageTabsV2.tsx`
- `frontend/src/components/layout/page-header-unified.tsx`
- `frontend/src/components/layout/index.ts`
- `frontend/src/components/ds/index.ts`
- `frontend/src/components/ui/tabs.tsx`
- `frontend/eslint.config.mjs`
- `frontend/scripts/audit/audit-tab-primitive-usage.mjs`
- `frontend/package.json`

## Regression Guardrails

- [x] `PageTabsV2` banned by lint/import policy.
- [x] Raw `@radix-ui/react-tabs` imports banned outside the shared primitive.
- [x] `TabsList variant="line"` banned by syntax rule.
- [x] Focused ESLint passes on touched files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Primitive inventory | `rg -n "PageTabsV2|TabsList variant=\"line\"|from \"@/components/ui/tabs\"" frontend/src` | Pass | `PageTabsV2` imports were removed from production/shared exports and `TabsList variant="line"` no longer appears in `frontend/src`. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint -c eslint.config.mjs <touched files>` | Pass with warnings | No errors. Remaining output is pre-existing warning debt unrelated to tab ownership, including table/page-shell/form-control warnings on already noisy files. |
| Syntax guardrail | `no-restricted-syntax` rule in `frontend/eslint.config.mjs` for `TabsList variant="line"` | Pass | New line-style tabs are now blocked at lint time. |
| Tab audit script | `cd frontend && npm run audit:tabs` | Pass | Exact violations, likely wrong page-level tabs, and page-tab-styled section tabs are all now `None`. |
| Sidebar tab fix | `cd frontend && ./node_modules/.bin/eslint src/components/budget/modals/BaseSidebar.tsx` | Pass | `SidebarTabs` now uses the default section-tab primitive instead of the legacy line variant. |
| Intentional exceptions | `APP_PAGE_TABS_EXCEPTIONS` in `frontend/scripts/audit/audit-tab-primitive-usage.mjs` | Pass | `annotation-inbox` and `design-violations` are documented as local filter controls, not page-level navigation. |

## Remaining Work

- Run browser verification on a few migrated surfaces to confirm visual spacing and responsive behavior:
  - Admin dashboard
  - Company knowledge
  - Photos
  - Memory settings
