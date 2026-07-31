# Task: Production Dependency Repair

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: BUILD-DEPS-20260730
Related Handoff:
`docs/ops/handoffs/2026-07-30-SROOT-production-dependency-repair.md`

## Objective

Restore canonical GitHub-main production builds after the realtime workflow
feature began importing `yjs` and `y-protocols/awareness` directly.

## Scope

- Declare `yjs` and `y-protocols` as direct runtime dependencies.
- Regenerate the pnpm lockfile without changing application behavior.
- Verify frozen-lockfile installation and direct module resolution.
- Publish through GitHub `main` and read back the resulting Vercel deployment.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `yjs` is a direct runtime dependency.
- [x] `y-protocols` is a direct runtime dependency.
- [x] `pnpm install --frozen-lockfile --ignore-scripts` succeeds.
- [x] Node resolves `yjs` and `y-protocols/awareness` from the project.
- [x] The canonical GitHub-main Vercel deployment reaches `READY`.
- [x] `projects.alleatogroup.com/api/health` reports healthy.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Vercel failure localization | Confirmed | Deployment `dpl_F5ZKmZ6rrP6FWRD4bLELHrifsuHB` failed at `use-realtime-flow.ts` with `Can't resolve 'yjs'`. |
| Frozen lockfile install | Pass | pnpm installed 2,615 packages with no lockfile drift. |
| Direct resolution | Pass | Node resolved `yjs` 13.6.31 and `y-protocols/awareness` from direct dependencies. |
| Diff scope | Pass | Only `frontend/package.json` and `frontend/pnpm-lock.yaml` contain implementation changes. |
| Independent review | Approved | Manifest and lockfile are consistent, versions are compatible, and CJS plus ESM imports resolve. |
| Canonical production deployment | Pass | `dpl_F9vpvyvhKcQnpWP4UeCkVtzZw3NP` is `READY` from GitHub-main commit `2efac2cca` and owns the custom domain. |
| Live health readback | Pass | `https://projects.alleatogroup.com/api/health` returned HTTP 200 with `status: healthy` and `backend: true`. |

## Failure-Loudly Contract

- Cause: the production build emits the exact unresolved package and import
  location.
- Detection: frozen-lockfile install, direct module resolution, and canonical
  Vercel build readback.
- Recovery: revert the dependency-only commit if the build introduces an
  unexpected package-resolution regression.

## Remaining Risk

- None for the repaired runtime dependency graph.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Task-owned files are published.
