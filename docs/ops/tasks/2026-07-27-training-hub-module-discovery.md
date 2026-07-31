# Task: Training Hub Module Discovery

Status: Complete
Owner: S019fa660
Created: 2026-07-27
Task ID: local-training-hub-taste
Linear Issue: Not required for this single-session Standard task; direct Linear tools are unavailable in this session.
Related Handoff: N/A, single-session Standard task.

## Objective

Make the authenticated `/training` module directory easier to scan, understand, and enter without changing its routes or training data contract.

## Scope

- `HubModuleGrid` and `HubModuleTile`, the canonical reusable `/training` discovery components.
- Focused component regression tests.
- Excludes the concurrently-owned training masthead, training content data, authentication, and downstream training routes.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/training/page.tsx` and `frontend/src/features/training/HubModuleGrid.tsx`.
- Existing shared primitives/services: `Button`, Next.js `Link`, Lucide icons, and the `HUB_MODULE_TILES` content model.
- Deprecated or parallel paths: `TrainingHero` and the standalone training-source prototype are not altered.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Each training module has clearer visual identity and a visible, high-contrast action.
- [x] Numbered placeholder labels are replaced with a user-meaningful label in the shared tile presentation.
- [x] The grid has no intentionally empty desktop cells and preserves responsive behavior.
- [x] Invalid off-platform destinations continue to fail loudly.

## Implementation Checklist

- [x] The canonical shared grid and tile own the change; no page-local duplicate was created.
- [x] Existing primary and secondary routes remain unchanged.
- [x] The existing explicit invalid-destination exception remains the failure-loudly guardrail.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Evidence artifacts are recorded.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: An off-platform training destination throws a specific destination error; an unavailable module remains visibly `Coming soon`.
- Detection path: Focused `HubModuleTile` tests exercise both states.
- Recovery path: Correct the route in the content model or choose an available module action.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: A focused test ensures generic numbered labels do not return to the shared tile presentation.
- Guardrail evidence: `hub-module-tile.test.tsx`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused component tests | `pnpm exec jest --runInBand --runTestsByPath src/features/training/__tests__/hub-module-grid.test.tsx src/features/training/__tests__/hub-module-tile.test.tsx` | Pass | 2 suites, 6 tests. |
| Focused lint | `pnpm exec eslint src/features/training/HubModuleGrid.tsx src/features/training/HubModuleTile.tsx` | Pass | Zero findings. |
| Visual readback | Production `/training` | Deferred | The supplied production URL redirects to sign-in and no permitted authenticated browser session was available. |

## Remaining Risk

- Authenticated browser screenshot remains deferred; component-level checks cover the changed boundary and existing browser proof for the training hub is documented in `2026-07-27-training-hub-visual-parity.md`.

## Final Status

- [x] All required checklist items are complete for this Standard slice.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred visual evidence includes cause, detection gap, and recovery path.
