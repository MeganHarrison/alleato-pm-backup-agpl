# Task: Training Library Figma Redesign

Status: Complete
Owner: Codex
Created: 2026-07-29
Task ID: local-training-library-figma-redesign
Linear Issue: Not required for a single-session Standard UI change.
Related Handoff: N/A

## Objective

Match the training library to the approved Figma direction while preserving the
existing resource data, filters, review access, and canonical lesson routes.

## Scope

- Training library page header, filter toolbar, topic layout, and resource tiles.
- Responsive behavior and focused component tests for the changed surface.
- Excludes training resource detail pages and training administration.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/training/server.ts`
- Existing shared primitives/services: `PageShell`, `ResourceFilters`, `ResourceCard`
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Search and filters share one desktop row.
- [x] Secondary filters remain touch-friendly and collapsible on small screens.
- [x] Published resources retain their canonical internal lesson links.
- [x] The page follows the approved Figma hierarchy using live training data.
- [x] Empty and unavailable states retain actionable recovery copy.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors remain specific and actionable.
- [x] No database, provider, authentication, permission, or delivery contract changes.

## Integration and Verification

- [x] Targeted component tests pass.
- [x] Current desktop and mobile route screenshots prove the changed boundary.
- [x] Surface-complexity audit passes.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: existing distinct unavailable and no-match states.
- Detection path: targeted component tests and authenticated route inspection.
- Recovery path: clear filters for no matches; explicit unavailable copy for load failure.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: focused responsive and routing regression tests.
- Guardrail evidence: the route uses the shared `TRAINING_PAGE_SURFACE_CLASS`,
  which supplies valid HSL channels for the semantic `bg-card` surface.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | `pnpm exec jest --runInBand --runTestsByPath src/features/training/__tests__/training-library-view.test.tsx src/app/(main)/training/library/__tests__/page.test.tsx src/features/training/__tests__/training-detail-page.test.tsx` | Pass | 3 suites and 10 tests passed. |
| Focused lint | `pnpm exec eslint src/app/(main)/training/library/page.tsx src/features/training/TrainingLibraryView.tsx --no-cache` | Pass | No lint findings. |
| Desktop proof | `docs/ops/evidence/2026-07-29-training-library-figma-redesign/training-library-desktop.png` | Pass | White page canvas, inline search/filter controls, and three-column resource layout rendered. |
| Mobile proof | `docs/ops/evidence/2026-07-29-training-library-figma-redesign/training-library-mobile.png` | Pass | White page canvas and responsive single-column flow rendered. |

## Remaining Risk

- Deployment propagation remains outside the local route boundary.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
