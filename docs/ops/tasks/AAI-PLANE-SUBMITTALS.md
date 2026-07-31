# Task: Plane-derived Submittals replacement

Status: In Progress
Owner: S20260731-PLANE-SUBMITTALS
Created: 2026-07-31
Task ID: AAI-PLANE-SUBMITTALS
Linear Issue: Not requested; local parallel implementation slice
Related Handoff: N/A

## Objective

Provide a new Plane-derived `/[projectId]/plane/submittals` work surface that
reads and mutates the existing authenticated, Supabase-backed Submittals
contract without changing the legacy Submittals route.

## Scope

- New Plane-derived Submittals list, filters, create flow, record peek, status
  mutation, recycle-bin delete, and restore behavior.
- Reuse `use-submittals.ts` and the existing project Submittals APIs as the only
  data and mutation owners.
- Add the `submittals` segment to the feature-owned Plane dispatcher.
- Excludes the leased shared Plane shell/navigation, legacy Submittals route,
  API handlers, schema, migrations, production publishing, and destructive
  production testing.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/hooks/use-submittals.ts`
- Existing shared primitives/services:
  `frontend/src/app/api/projects/[projectId]/submittals/**`,
  `frontend/src/features/plane-work-items/plane-surface-dispatcher.tsx`
- Plane template source:
  `apps/web/core/components/issues/issue-layouts/list/{default,list-group,block}.tsx`
  and `apps/web/core/components/issues/peek-overview/header.tsx` at Plane
  revision `39856932cd6b9bd17eab0920506d628190b47af2`
- Deprecated or parallel paths:
  `frontend/src/app/(main)/[projectId]/submittals/page.tsx` remains intact until
  replacement verification and a deliberate cutover.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The new surface is routed through the shared Plane dispatcher.
- [x] The list uses authenticated existing APIs through canonical hooks.
- [x] Search, status filtering, item/recycle scopes, record selection, create,
      status update, delete, and restore are connected to real existing contracts.
- [x] Loading, empty, mutation-error, and load-error/retry states are explicit.
- [ ] Shared Plane navigation exposes and highlights Submittals.
- [ ] Authenticated desktop and mobile browser evidence is captured.
- [ ] Production is published and verified by the integration owner.
- [x] Legacy route retirement is explicitly deferred until replacement proof.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared hooks and API routes retain data and mutation ownership.
- [x] Errors are specific and actionable.
- [x] Existing RLS/authentication enforcement is preserved at the API boundary.
- [x] Plane copyright, SPDX headers, revision mapping, and `/auth/source`
      corresponding-source path are retained.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Phase-three feature commits were integrated in the required order without
      conflicts.
- [x] The dispatcher recognizes Home, Projects, Your Work, Drafts, RFIs,
      Submittals, Change Events, Commitments, and Prime Contracts.
- [x] Access tests distinguish workspace-wide data surfaces from project-scoped
      data surfaces while retaining the existing contextual project route.
- [ ] Authenticated direct-route browser readback proves the requested outcome.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are locally committed.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: inline load failure with server-provided message and Retry;
  inline mutation failure naming the attempted operation.
- Detection path: focused unit test plus authenticated browser inspection of
  `/31/plane/submittals`.
- Recovery path: retry the list request or repeat the failed mutation after the
  API/RLS condition is corrected.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check                       | Command / artifact                                                                                                                                                        | Result                    | Notes                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task setup                  | This task file                                                                                                                                                            | Pass                      | Scope and done gate captured before implementation.                                                                                                                                               |
| Model + dispatcher behavior | `npx jest --runInBand --runTestsByPath src/features/plane-submittals/plane-submittals-model.unit.test.ts src/features/plane-work-items/plane-surface-access.unit.test.ts` | Pass                      | 2 suites, 8 tests.                                                                                                                                                                                |
| Focused lint                | `npx eslint ... --quiet` over task-owned TS/TSX                                                                                                                           | Pass                      | Zero errors. Plane-fidelity color/control warnings remain visible without failing the check.                                                                                                      |
| Formatting                  | `npx prettier --check ...`; `git diff --check`                                                                                                                            | Pass                      | Task-owned source and task record.                                                                                                                                                                |
| Full typecheck              | `npm run typecheck`; `npx --no-install tsc --noEmit --pretty false --incremental false`                                                                                   | Tooling blocked / bounded | The package wrapper fails before TypeScript because it uses Unix `rm` on Windows. Direct TypeScript produced no diagnostics before the 124-second bound. Release CI remains the completion owner. |
| Browser proof               | Pending integration                                                                                                                                                       | Pending                   | Shared shell nav lease must land first.                                                                                                                                                           |
| Phase-three route matrix    | `npx jest --runInBand --runTestsByPath src/features/plane-work-items/plane-surface-access.unit.test.ts`                                                                   | Pass                      | One suite, eight tests. Covers supported slugs, dispatcher component wiring, project parsing, workspace/project scope, shell wrapping, and mutation-preview access.                               |

## Remaining Risk

- The shared Plane shell/navigation is owned by another active session and does
  not yet include every phase-three surface. The dispatcher uses a documented
  temporary type boundary so direct routes can integrate without violating that
  lease. The navigation owner must add the new segments before release.
- Existing hook error toasts include server error text. This slice also renders
  an actionable inline failure state, but sanitizing the shared toast contract
  remains owned by the canonical hook.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred shell navigation, browser proof, publication, and legacy-route
      retirement identify their owner and next action.
