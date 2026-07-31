# Task: Remove legacy Alleato Brain page

Status: Complete
Owner: Codex
Created: 2026-07-27
Task ID: LOCAL-20260727-remove-legacy-brain
Linear Issue: Unavailable; explicit local task
Related Handoff: N/A; Standard single-session task

## Objective

Remove the public `/brain` route and its navigation/metadata references from the production main branch.

## Scope

- Delete the legacy `/brain` route family and route-only UI components.
- Remove navigation, generated app-surface metadata, and dead links for `/brain`.
- Preserve the shared Brain data/contract layer used by `/ai/company-brain`.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] `/brain` and `/brain/[businessAreaId]` route files are removed.
- [x] No navigation or app-surface metadata advertises `/brain`.
- [x] The surviving `/ai/company-brain` surface has no dead `/brain` link.
- [x] Route conflict and navigation regression checks pass.

## Implementation Checklist

- [x] Canonical route and navigation owners were inspected before edits.
- [x] Shared Brain data/contract code remains because the current AI surface uses it.
- [x] Route-only components and tests were removed.

## Integration and Verification

- [x] `npm run check:routes` passes.
- [x] `npm run test:unit -- --runInBand src/lib/__tests__/navigation-config.unit.test.ts` passes: 28 tests.
- [x] JSON metadata parses successfully.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `/brain` no longer resolves to a page after publication.
- Detection path: route conflict check, navigation regression test, and generated app-surface inspection.
- Recovery path: restore the route in a new reviewed task if the replacement surface is not sufficient.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Keep route ownership, navigation metadata, and dead-link checks in the same deletion change.
- Guardrail evidence: `npm run check:routes` and focused navigation test.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Route validation | `npm run check:routes` | Pass | No route conflicts found. |
| Navigation regression | Focused Jest test | Pass | 28 tests passed. |
| Metadata validation | Node JSON parse | Pass | Generated app-surface metadata is valid JSON. |

## Remaining Risk

- Existing cached deployments may continue serving `/brain` until this main commit deploys; verify the canonical production route after Vercel publishes.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
