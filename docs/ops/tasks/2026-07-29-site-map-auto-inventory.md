# Task: Automatic Page Access route inventory

Status: In Progress
Owner: Codex
Created: 2026-07-29
Task ID: SITE-MAP-AUTO-INVENTORY
Linear Issue: Not tracked; bounded production build reliability correction.
Related Handoff: `docs/ops/handoffs/2026-07-29-S019fb0f3-site-map-auto-inventory.md`

## Objective

Every Vercel frontend build regenerates the Page Access route inventory from the deployed frontend source before Next.js bundles it.

## Scope

- Canonical route-inventory generator and Vercel frontend-root build preparation.
- Explicit exclusion: no Page Access UI, route permissions, or database data changes.

## Source of Truth

- Canonical runtime/data owner: `frontend/scripts/build/route-inventory.mjs`
- Existing shared primitives/services: `scripts/verify/route-audit.mjs`, `frontend/scripts/build/prepare-route-inventory.mjs`
- Deprecated or parallel paths: committed snapshot fallback in Vercel frontend-root builds.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [ ] Vercel frontend-root builds regenerate the bundled inventory from `frontend/src/app`.
- [ ] Local audit and Vercel build use one shared inventory derivation.
- [ ] Generation fails with a specific recovery action if frontend route source is unavailable or output is empty.
- [x] Focused generator and build-policy tests pass.
- [ ] A production build check confirms the inventory preparation step runs before Next.js compiles.

## Failure-Loudly Contract

- Cause surfaced as: `[route-inventory]` error naming the missing source or unusable output.
- Detection path: production build log and focused generator tests.
- Recovery path: restore `frontend/src/app` and correct the portable generator, then redeploy.

## Incident Learning

- Failure fingerprint: `deployment.vercel-unscoped-monorepo-build-spend` is related build-boundary context; no existing fingerprint covers stale Page Access inventory.
- Root cause: Vercel's configured `frontend/` checkout cannot execute the repository-root audit, so it used a committed generated snapshot.
- Detection gap: build preparation verified file presence but not freshness from the deployed route tree.
- Prevention: portable frontend-root generation shares the audit derivation and fails on missing/empty output.
- Guardrail evidence: focused generator regression tests plus production build preparation assertion.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Acceptance and failure-loudly contract captured before implementation. |
| Focused regression | `node --test frontend/scripts/build/__tests__/route-inventory.test.mjs frontend/scripts/build/__tests__/prepare-route-inventory.test.mjs` | Pass | 6 tests passed: Vercel frontend-root generation, local-audit output guard, and production build invocation. |
| Independent review | `review_site_map_inventory` | Approved | Local empty-output gap was identified, fixed, and re-reviewed. |
| Publish isolation | Exact task-only clean checkout | Pass | Commit `6895ec9f` was pushed to `origin/main` without modifying the canonical checkout's unrelated staged index. |
| Vercel build source | `project-management-agent-9gkxxvt2e-the-alleato-group.vercel.app` | Building | Vercel cloned `The-Alleato-Group/project-management@main` at `6895ec9` and logged the route-audit output. |

## Remaining Risk

- The Vercel production build is still running. Next action: confirm Ready status, canonical alias, and authenticated Page Access route read-back.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
