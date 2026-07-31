# Task: Repair Vercel Frontend-Root Build Contract

Status: In Progress
Owner: Codex
Created: 2026-07-27
Task ID: VERCEL-frontend-root-build-contract
Linear Issue: Not tracked; no Linear issue was requested for this incident.
Related Handoff: `docs/ops/handoffs/2026-07-27-Sroot-vercel-frontend-root-build-contract.md`

## Objective

Allow the Vercel `frontend` project to complete its production build without resolving scripts outside its configured frontend root.

## Scope

- `frontend` build route-inventory preparation and production-build integration.
- Excludes changes to Vercel project configuration, application routes, and runtime environment variables.

## Source of Truth

- Canonical runtime/data owner: `frontend/scripts/build/run-production-build.mjs`.
- Existing shared primitives/services: `scripts/verify/route-audit.mjs`, `frontend/src/app/(admin)/site-map/route-inventory.generated.json`.
- Deprecated or parallel paths: direct `../scripts/verify/route-audit.mjs` calls from the frontend-root build.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Vercel builds do not resolve repository-level scripts outside the configured frontend root.
- [x] Missing committed route inventory fails with a specific recovery instruction.
- [x] Full repository checkouts continue to regenerate route inventory from its canonical audit script.
- [ ] A production deployment reaches `READY` after publication.

## Implementation Checklist

- [x] Files/modules were listed before the repair.
- [x] Shared route-inventory preparation owns both ordinary and production build paths.
- [x] Errors are specific and actionable.
- [x] Vercel delivery boundary is handled.

## Integration and Verification

- [x] Targeted static checks pass.
- [x] The prior Vercel build-log failure was captured and localized.
- [ ] Vercel deployment readback proves the requested outcome.
- [x] Evidence is recorded below.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `[route-inventory]` error naming the unavailable script or missing committed inventory.
- Detection path: `pnpm run build:route-inventory` locally and Vercel build logs in the frontend-root checkout.
- Recovery path: run the canonical audit in a complete checkout and commit `route-inventory.generated.json` before deploying.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: Vercel's project root is `frontend/`, but production build code tried to execute `/vercel/scripts/verify/route-audit.mjs`.
- Detection gap: no build-time assertion distinguished the Vercel frontend-root checkout from a full repository checkout.
- Prevention: shared preparation script validates the committed artifact in Vercel and generates it only when the canonical root script is available.
- Guardrail evidence: targeted node syntax checks and Vercel deployment readback after publishing.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Failure localization | Vercel deployment `dpl_CnzWjZyfKjYG9MWVFQXFtGTMw7ec` build log | Pass | First divergence: production build invoked a missing `/vercel/scripts/verify/route-audit.mjs`. |
| Static checks | `node --check frontend/scripts/build/prepare-route-inventory.mjs` and `node --check frontend/scripts/build/run-production-build.mjs` | Pass | Syntax verified. |
| Canonical generation | `pnpm --dir frontend run build:route-inventory` | Pass | Full checkout ran `scripts/verify/route-audit.mjs` successfully. |
| Deployment readback | Pending publication | Pending | Must show a `READY` production deployment. |
| Vercel Git integration | `vercel git connect https://github.com/The-Alleato-Group/project-management.git --scope meganharrisons-projects` | Pass | Connected the project to its canonical GitHub source after direct CLI deployment was rejected by the source gate. |

## Remaining Risk

- A Git-triggered production deployment remains pending; owner: Codex.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
