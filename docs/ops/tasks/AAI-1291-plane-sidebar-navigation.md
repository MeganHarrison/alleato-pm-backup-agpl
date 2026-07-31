# Task: Plane Sidebar Navigation and Sizing

Status: Complete
Owner: S20260731-PLANE-OVERLAYS
Created: 2026-07-31
Task ID: AAI-1291
Linear Issue: AAI-1291
Related Handoff: N/A

## Objective

Make the Plane-derived desktop sidebar resizable and collapsible with durable
local preferences, honest navigation, and complete keyboard semantics while
preserving the existing mobile drawer.

## Scope

- `frontend/src/features/plane-work-items/plane-workspace-shell.tsx`
- Focused Plane workspace shell tests.
- Desktop sidebar resize, collapse, restore, persistence, and accessibility.
- Real Home and Your work destinations plus visibly disabled unavailable items.
- Excludes Work Items page, Cycles, Modules, global navigation, and publication.

## Source of Truth

- Canonical runtime/data owner: `personal-production/main` plus local overlay
  commit `a645e9b18`.
- Existing shared primitives/services:
  `frontend/src/features/plane-work-items/plane-workspace-shell.tsx`.
- Deprecated or parallel paths: none.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Desktop sidebar resizes within explicit minimum and maximum widths.
- [x] Desktop sidebar collapses and restores without changing the mobile drawer.
- [x] Width and collapsed state persist locally after hydration.
- [x] Resize and collapse controls are keyboard operable and accessible.
- [x] Collapsed navigation retains accessible labels and tooltips.
- [x] Home and Your work use canonical real routes.
- [x] Drafts, Stickies, and More are visibly and semantically disabled.
- [x] Focused tests and patch-integrity checks pass.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared helpers own preference parsing and width bounds.
- [x] Errors are specific and actionable.
- [x] No database, provider, authentication, permission, or deployment contract changes.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Rendered markup proves accessible controls and honest navigation.
- [x] Evidence is recorded.
- [x] Task-owned files are committed locally.

## Failure-Loudly Contract

- Cause surfaced as: invalid stored preferences fall back to bounded defaults
  and storage failures emit a scoped console warning.
- Detection path: focused preference, keyboard-sizing, and rendered-markup tests.
- Recovery path: use the restore-sidebar button or clear the single
  `plane-workspace-sidebar` local preference.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: bounded shared helpers and focused navigation semantics tests.
- Guardrail evidence: unit coverage for bounds/parsing/SSR markup and jsdom
  interaction coverage for persistence, keyboard/pointer resize, and disabled
  navigation semantics.

## Evidence

| Check                        | Command / artifact                                                                                                                               | Result | Notes                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------- |
| Shell unit tests             | `npx jest --runInBand --runTestsByPath src/features/plane-work-items/plane-workspace-shell.unit.test.tsx`                                        | Pass   | 5 tests passed.                                      |
| Navigation interaction tests | `npx vitest run --config src/features/plane-work-items/vitest.config.ts src/features/plane-work-items/plane-workspace-shell-navigation.test.tsx` | Pass   | 3 tests passed.                                      |
| Formatting                   | `npx prettier --write` on all task-owned files                                                                                                   | Pass   | All files formatted.                                 |
| Patch integrity              | `git diff --check`                                                                                                                               | Pass   | No whitespace errors.                                |
| Focused ESLint               | Commit hook `run-frontend-eslint.sh fix` and `strict` on all task-owned frontend files                                                           | Pass   | Canonical strict lint and no-new-debt guards passed. |

## Remaining Risk

- Direct `npx eslint` cannot initialize from this isolated workspace because
  its local dependency set does not expose `eslint-plugin-storybook`. The
  repository commit-hook wrapper supplied the canonical dependency context and
  completed strict lint successfully.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Any deferred work is documented.
