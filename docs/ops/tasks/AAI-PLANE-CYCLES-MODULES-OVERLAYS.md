# Task: Plane Cycles and Modules Overlay Adoption

Status: Complete
Owner: S20260731-PLANE-CYCLE-MODULE-OVERLAYS
Created: 2026-07-31
Task ID: AAI-PLANE-CYCLE-MODULE-OVERLAYS
Linear Issue: Existing Plane-to-Alleato program; no separate issue requested
Related Handoff: N/A

## Objective

Move every Cycles and Modules dropdown, select, dialog, sheet, confirmation, and
form modal into the Plane workspace-owned overlay host without changing global
application portals or either surface's data and mutation behavior.

## Scope

- `frontend/src/features/plane-cycles`
- `frontend/src/features/plane-modules`
- Focused source-adoption regression coverage.
- Excludes global `components/ui` portal behavior, data adapters, permissions,
  and publication.

## Source of Truth

- Canonical runtime/data owner: `personal-production/main`
- Shared overlay prerequisite:
  `frontend/src/features/plane-work-items/plane-overlay.tsx` at
  `2a0c014d7`.
- Existing feature owners: the committed Cycles and Modules page, row/card,
  form, and inspector components.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Every Cycles dropdown and dialog uses a Plane-scoped content wrapper.
- [x] Every Modules dropdown, select, sheet, confirmation, and unified modal
      uses a Plane-scoped content wrapper.
- [x] Global UI portal primitives remain unchanged.
- [x] Focused source and shared DOM-boundary tests pass.
- [x] Formatting and patch-integrity checks pass.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared overlay primitives own cross-cutting portal behavior.
- [x] No database, authentication, permission, provider, or deployment contract
      changes.
- [x] Errors and unsupported content types fail through focused guardrails.

## Integration and Verification

- [x] Focused tests pass.
- [x] Evidence is recorded.
- [x] Task-owned files are committed locally.

## Failure-Loudly Contract

- Cause surfaced as: the adoption guard fails if a Cycles or Modules component
  imports one of the unscoped content primitives.
- Detection path: focused source-adoption suite plus the shared jsdom portal
  ownership suite.
- Recovery path: replace the unscoped content component with its matching
  `Plane*Content` wrapper while leaving the root, trigger, title, description,
  and action primitives unchanged.

## Incident Learning

- Failure fingerprint: `plane-replacement-overlay-outside-workspace`
- Root cause: body-level portals render outside the fixed near-maximum Plane
  workspace stacking context.
- Detection gap: screenshots that did not open menus, dialogs, or inspectors
  could not expose portal ownership.
- Prevention: shared workspace overlay host plus focused adoption and DOM
  ancestry tests.
- Guardrail evidence: six feature-owner adoption checks plus ten shared jsdom
  portal ownership checks.

## Evidence

| Check               | Command / artifact                                                                                                        | Result | Notes                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| Adoption guard      | `npx jest --runInBand --runTestsByPath src/features/plane-cycles/plane-overlay-adoption.unit.test.ts`                     | Pass   | 6/6 feature-owner checks pass.                                                            |
| Shared DOM boundary | `npx vitest run --config src/features/plane-intake/vitest.config.ts src/features/plane-work-items/plane-overlay.test.tsx` | Pass   | 10/10 checks prove every content and backdrop type mounts inside the Plane overlay host.  |
| Formatting          | `npx prettier --write` on all task-owned files                                                                            | Pass   | All task-owned files formatted.                                                           |
| Patch integrity     | `git diff --check`                                                                                                        | Pass   | No whitespace errors.                                                                     |
| Commit guards       | Repository commit hook                                                                                                    | Pass   | Strict frontend lint, no-new-debt, routes, and non-production route-budget checks passed. |

## Remaining Risk

- Browser interaction proof belongs to the coordinator's integrated visual
  release checkpoint. This slice is local-commit only.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is recorded.
- [x] Publication is explicitly excluded.
