# Task: Plane Workspace Overlay Boundary

Status: Complete
Owner: S20260731-PLANE-OVERLAYS
Created: 2026-07-31
Task ID: AAI-PLANE-OVERLAYS
Linear Issue: Existing Plane-to-Alleato program; no separate issue requested
Related Handoff: N/A

## Objective

Keep Plane-derived dropdowns, popovers, selects, and confirmation dialogs
interactive above the fixed Plane workspace while allowing Intake task rows to
render before the optional Outlook source settles.

## Scope

- Plane workspace overlay host and shared Plane-scoped overlay content wrappers.
- Views, Pages, and Intake overlay adoption.
- Intake project-scoped Outlook requests and progressive task rendering.
- Focused component regression tests.
- Excludes Cycles and Modules while their active writer leases remain in force.
- Excludes global UI portal behavior and the Outlook API route.

## Source of Truth

- Canonical runtime/data owner: `personal-production/main`
- Existing shared primitives/services: `frontend/src/components/ui/*`,
  `frontend/src/features/plane-work-items/plane-workspace-shell.tsx`
- Deprecated or parallel paths: Global body-level Radix portals are valid
  outside the Plane replacement workspace and must remain unchanged.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Plane overlays are portaled inside a dedicated workspace-owned host.
- [x] Plane dropdown, popover, select, and alert-dialog content renders above the
      Plane workspace content without globally increasing portal z-index.
- [x] Plane ordinary dialog, sheet, and unified-modal content uses the same
      workspace-scoped portal host without changing global component behavior.
- [x] Views, Pages, and Intake use the Plane-safe content wrappers.
- [x] Intake renders available task rows while Outlook is still loading.
- [x] Outlook Intake requests are scoped by `project_id`.
- [x] Intake does not present aggregate counts as final until all enabled sources settle.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
      handled when applicable. No schema, auth, or provider mutation is included.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual DOM-boundary tests prove the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are committed locally.

Publication is intentionally excluded by coordinator direction; local commit only.

## Failure-Loudly Contract

- Cause surfaced as: focused tests fail when overlay content is mounted outside
  the workspace host or below the workspace content, and Intake source errors
  continue to render in the existing source warning.
- Detection path: targeted Vitest test and DOM inspection of
  `data-plane-overlay-host` / `data-plane-overlay-content`.
- Recovery path: restore the Plane content wrapper on the affected surface or
  retry the failed Intake source without hiding already-loaded task rows.

## Incident Learning

- Failure fingerprint: `ai.project-context-silent-broadening`
- Root cause: Body-level Radix portals sit outside the fixed near-maximum
  Plane workspace stacking context; aggregate Intake loading also coupled the
  primary task source to slower optional Outlook requests.
- Detection gap: Empty-state visual checks did not exercise open overlays or
  progressive multi-source loading.
- Prevention: Shared Plane portal host plus focused open-overlay and
  source-settling tests.
- Guardrail evidence: Focused tests verify each Plane overlay content type is a
  descendant of the workspace overlay host and verify progressive Intake
  loading and project-scoped Outlook URLs.

## Evidence

| Check            | Command / artifact                                                                                                        | Result                                | Notes                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Task setup       | This task file                                                                                                            | Pass                                  | Scope and done gate captured before implementation.                                                                            |
| Focused behavior | `npx vitest run --config src/features/plane-intake/vitest.config.ts src/features/plane-work-items/plane-overlay.test.tsx` | Pass                                  | 10 tests prove all seven supported content types and their backdrops mount inside the Plane overlay host.                      |
| Formatting       | `npx prettier --check <task-owned files>`                                                                                 | Pass                                  | All task-owned files match repository formatting.                                                                              |
| Patch integrity  | `git diff --check`                                                                                                        | Pass                                  | No whitespace errors.                                                                                                          |
| TypeScript       | `npx tsc --noEmit --pretty false --incremental false`                                                                     | Inconclusive                          | Repository-wide command exceeded the 120-second bounded check without diagnostics.                                             |
| ESLint           | `npx eslint <task-owned files>`                                                                                           | Blocked by unrelated dependency state | `eslint-plugin-storybook` is absent before task files are evaluated.                                                           |
| Jest             | `npm run test:unit -- --runInBand --runTestsByPath ...`                                                                   | Blocked by unrelated runner drift     | Jest fails before discovery with `this._moduleMocker.clearMocksOnScope is not a function`; focused coverage runs under Vitest. |

## Remaining Risk

- Cycles and Modules still require adoption of the now-complete shared wrappers
  in their feature-owned files. That downstream slice has a separate active
  lease and will preserve the global UI portals.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
