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
- Canonical dispatcher destinations for workspace and project surfaces.
- Permission-aware visibility for project tools backed by module permissions.
- Excludes surface body implementations, dispatcher changes, and publication.

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
- [x] Home, Your work, Drafts, and Projects use canonical contextual Plane
      dispatcher routes.
- [x] RFIs, Submittals, Change Events, Commitments, and Prime Contracts use
      canonical project Plane routes.
- [x] Permission-scoped project tools are hidden without module read access.
- [x] Cycles, Modules, Views, Pages, and Intake remain available.
- [x] Stickies and More remain visibly and semantically disabled.
- [x] Duplicate Projects links are not rendered.
- [x] Focused tests and patch-integrity checks pass.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared helpers own preference parsing and width bounds.
- [x] Errors are specific and actionable.
- [x] Existing project permission hooks own navigation visibility; no
      permission contract is duplicated.
- [x] No database, provider, authentication, or deployment contract changes.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Rendered markup proves accessible controls and honest navigation.
- [x] Evidence is recorded.
- [x] Original sidebar slice was committed locally.
- [x] Expanded navigation commit is created for parent integration.

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

### Dispatcher route expansion evidence

| Check                        | Command / artifact                                                                                                                               | Result | Notes                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| Canonical route coordination | `/root/cycles_finalize` dispatcher matrix                                                                                                        | Pass   | Uses exact `/:projectId/plane/:slug` routes, including contextual global surfaces.              |
| Expanded shell tests         | `npm run test:unit -- --runInBand --runTestsByPath src/features/plane-work-items/plane-workspace-shell.unit.test.tsx`                            | Pass   | 6 tests prove canonical links, command routes, and permission-aware visibility.                 |
| Expanded navigation tests    | `npx vitest run --config src/features/plane-work-items/vitest.config.ts src/features/plane-work-items/plane-workspace-shell-navigation.test.tsx` | Pass   | 3 tests preserve collapse/resize/mobile behavior and prove destinations plus one Projects link. |
| Expanded focused lint        | `npx eslint` on the 3 owned frontend files                                                                                                       | Pass   | Zero errors; existing Plane-derived template warnings remain unchanged.                         |

## Remaining Risk

- Direct `npx eslint` cannot initialize from this isolated workspace because
  its local dependency set does not expose `eslint-plugin-storybook`. The
  repository commit-hook wrapper supplied the canonical dependency context and
  completed strict lint successfully.
- Workspace-global Projects, Your Work, and Drafts retain the contextual
  project-prefixed URL because that is the only dispatcher entry route; their
  surface loaders intentionally ignore the project scope.

## Final Status

- [x] Expanded navigation checks pass.
- [x] Expansion is committed locally for parent integration.
- [x] Incident learning is explicitly N/A.
- [x] Any deferred work is documented.
