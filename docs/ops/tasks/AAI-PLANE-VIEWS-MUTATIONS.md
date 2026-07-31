# Task: Plane Views Mutations

Status: Ready for parent integration
Owner: S20260731-plane-overlays
Created: 2026-07-31
Task ID: AAI-PLANE-VIEWS-MUTATIONS
Linear Issue: Parent Plane-to-Alleato migration program; no separate issue requested for this Standard slice.
Related Handoff: N/A

## Objective

Make the Plane-derived project Views template create, edit, duplicate, set a
default, and delete the current user's real saved task views.

## Scope

- `frontend/src/features/plane-views/project-views-client.tsx`
- `frontend/src/features/plane-views/view-mutations.ts`
- Focused mutation-helper tests
- Explicit exclusion: favorites, public visibility, publishing, sharing, and
  column/sort controls not applied by the current Project Tasks adapter

## Source of Truth

- Canonical runtime/data owner: `user_table_views` through
  `/api/table-views` and `/api/table-views/[viewId]`
- Existing shared primitives/services:
  `frontend/src/hooks/use-saved-table-views.ts`,
  `frontend/src/features/plane-work-items/plane-overlay.tsx`
- Deprecated or parallel paths: Plane favorite/public/publish actions are not
  represented in Alleato persistence and are intentionally absent.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Create and edit persist supported task layout/filter values.
- [x] Duplicate copies persisted configuration with a unique, non-default name.
- [x] Default state can be set or removed through the existing update hook.
- [x] Delete requires confirmation.
- [x] Mutation failures keep the relevant dialog open and show the API error.
- [x] Unsupported favorite and public-visibility controls are not rendered.
- [x] The static Private label truthfully reflects own-row RLS.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Existing saved-view hooks and Plane overlay primitives are reused.
- [x] Errors are specific and actionable.
- [x] The existing private per-user permission contract remains unchanged.

## Integration and Verification

- [x] Focused unit checks pass.
- [x] Targeted lint check passes with no errors.
- [ ] Parent integration session performs authenticated local visual proof.
- [x] No migration or provider change is required.
- [x] Local task commit is created for parent integration.

## Failure-Loudly Contract

- Cause surfaced as: API error text inside the editor/delete dialog or directly
  above the Views list for row actions.
- Detection path: rejected mutation leaves the editor/delete dialog open; row
  action failures render an alert above the Views list.
- Recovery path: correct the entered value or retry the action after resolving
  the reported API failure.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Pure helpers constrain duplication and task filters to the
  supported persisted contract.
- Guardrail evidence: Focused unit tests for filter serialization and duplicate
  configuration.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and unsupported states captured before closeout. |
| Focused unit tests | `npm run test:unit -- --runInBand --runTestsByPath src/features/plane-views/__tests__/view-mutations.unit.test.ts` | Pass | 3 tests cover supported filters and complete duplicate configuration. |
| Targeted lint | `npx eslint src/features/plane-views/project-views-client.tsx src/features/plane-views/view-mutations.ts src/features/plane-views/__tests__/view-mutations.unit.test.ts --no-cache` | Pass | Zero errors; 15 pre-existing warnings remain in the Plane-derived page template. |
| TypeScript compile | `npx tsc --noEmit --pretty false --incremental false` | Timed out | No diagnostics before the 124-second command limit; not required for this Standard slice. |
| Commit guard | Local Git commit | Pass | Exact task-owned files; route, production-route, staged lint, design-system debt, and unsafe-type guards passed. |

## Remaining Risk

- Setting a new default uses the existing two-write API behavior and can leave
  no default if the second write fails after the previous default is cleared.
- Deleting or explicitly unsetting the current default leaves the scope without
  a default. This is permitted by the current data contract.
- Authenticated visual proof and production release remain owned by the parent
  integration session.

## Final Status

- [x] All locally owned implementation checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred work names its owner and next action.
