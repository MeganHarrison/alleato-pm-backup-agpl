# Task: Plane Favorites and Recents shell

Status: Complete
Owner: S20260731-PLANE-FAVORITES-SHELL
Created: 2026-07-31
Task ID: AAI-PLANE-FAVORITES-SHELL
Linear Issue: Existing Plane-to-Alleato program; no new issue required for this bounded slice.
Related Handoff: Generated from the isolated workspace after the task-owned commit.

## Objective

Render Plane-derived Favorites and Recents in the replacement workspace sidebar,
using the existing authorized `plane-workspace-items` API without pretending the
unapplied persistence migration is available.

## Scope

- `frontend/src/features/plane-work-items/plane-workspace-shell.tsx`
- `frontend/src/features/plane-work-items/plane-workspace-shell-navigation.test.tsx`
- `frontend/src/features/plane-work-items/plane-workspace-shell.unit.test.tsx`
- `frontend/src/features/plane-workspace-shell/**`
- No Work Items page/contracts, Pages, Intake, database migration application, or production publication.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/plane-workspace-items/route.ts`
- Existing shared primitives/services: `frontend/src/features/plane-workspace-items/**`
- Plane-derived shell owner: `frontend/src/features/plane-work-items/plane-workspace-shell.tsx`
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Favorites and Recents render in deterministic API-backed order with loading and empty states.
- [x] Saved items navigate only to validated application-relative links.
- [x] The active surface can be favorited or unfavorited through the authorized API.
- [x] A 503 response produces one prominent unavailable state with one Retry action.
- [x] Failed mutations preserve the last confirmed server state and explain the recovery action.
- [x] Existing project navigation and responsive shell behavior remain intact.
- [x] AGPL attribution and the existing remote source-offer path remain visible.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared `plane-workspace-items` client and contracts own persistence.
- [x] Errors are specific and actionable.
- [x] The unapplied migration is treated as unavailable; no local persistence fallback is introduced.

## Integration and Verification

- [x] Targeted Vitest and Jest checks pass.
- [x] Targeted ESLint passes.
- [x] Independent review passes or records actionable findings.
- [x] Evidence artifacts are recorded.
- [x] Task-owned commit is ready for parent integration; no production publication is performed here.

## Failure-Loudly Contract

- Cause surfaced as: a specific unavailable, permission, session, or retryable sidebar state.
- Detection path: component integration tests mock the exact API status and assert visible recovery UI.
- Recovery path: one Retry action reloads server state; failed mutations keep the last confirmed state.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: targeted component and shell tests.

## Evidence

| Check                      | Command / artifact                                                                                                    | Result | Notes                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task setup                 | This task file                                                                                                        | Pass   | Scope and failure contract captured before implementation.                                                                                                |
| Component + shell behavior | `vitest run --config src/features/plane-work-items/vitest.config.ts ...`                                              | Pass   | 2 files, 14 tests; covers ordering, navigation, fail-closed project scope, collapsed 503 retry, mutation integrity, and stale project-response rejection. |
| Server-rendered shell      | `npm run test:unit -- --runInBand --runTestsByPath src/features/plane-work-items/plane-workspace-shell.unit.test.tsx` | Pass   | 1 suite, 6 tests; canonical nav and source offer preserved.                                                                                               |
| Targeted lint              | `eslint <five task-owned TS/TSX files> --quiet`                                                                       | Pass   | Zero errors.                                                                                                                                              |
| Independent review         | Reviewer re-check of invalid project scope and collapsed recovery                                                     | Pass   | Both original P1 findings fixed; no remaining P0-P2 findings.                                                                                             |

## Remaining Risk

- `supabase/migrations/20260731200000_create_plane_workspace_items.sql` remains intentionally unapplied; live UI will fail loudly until separately approved and applied.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred migration work names its owner and next action.
