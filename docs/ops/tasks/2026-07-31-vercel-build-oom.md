# Task: Restore the Vercel build memory boundary

Status: In Progress
Owner: Codex
Created: 2026-07-31
Task ID: AAI-VERCEL-OOM
Related Handoff: `docs/ops/handoffs/2026-07-31-SOOM0731-vercel-build-oom.md`

Delivery lane: High-risk

Verification contract: Required

## Objective

Restore the last proven Vercel Webpack memory policy on current `origin/main`,
then prove one production deployment reaches Ready before resuming Plane route
verification.

## Localization evidence

- Last Ready deployment: commit `5323c2771`, 7 GB V8 heap, Vercel Webpack cache
  disabled, completed in seven minutes.
- First commit after Ready: `eb6c96ad4` removed the Vercel `config.cache=false`
  guard. Its deployment failed with `FATAL ERROR: Ineffective mark-compacts near
  heap limit` while still using the 7 GB heap.
- Commit `7e571aa18` raised the Vercel heap to 11 GB. Builds then completed
  compilation but the 16 GB container killed Next.js with `SIGKILL`; Vercel's
  build-system report explicitly identified OOM.
- Every production deployment after the cache guard removal has failed.
- Current `main` contains approximately 72 fewer route files than the last Ready
  commit, excluding route volume and the Plane templates as the onset cause.

## Acceptance criteria

- [x] Work starts from current `origin/main`.
- [x] Vercel V8 heap returns to the last proven 7168 MB ceiling.
- [x] Vercel Webpack filesystem cache is disabled in `frontend/next.config.ts`.
- [x] A focused regression test enforces both controls.
- [ ] One Git-triggered Vercel production build reaches Ready.
- [ ] The production deployment commit equals the published `origin/main` commit.

## Failure contract

- Cause: Webpack's large transient filesystem cache was re-enabled while the
  build runner deletes `.next` before every build, so the cache is expensive to
  serialize but never reusable. Raising the V8 heap to 11 GB then starved the
  remaining Next.js workers inside the 16 GB container.
- Detection gap: the existing regression test asserted the larger heap as
  “proven” but did not assert total-container headroom or the Webpack cache gate.
- Prevention: one focused policy test must enforce both the 7 GB heap and the
  Vercel cache disable.

## Evidence

- Combined candidate is based on current `origin/main` commit `ee50c3d749`,
  including the latest source-map and generated-database-type build reductions.
- `node --test frontend/scripts/build/__tests__/vercel-build-memory-policy.test.mjs`:
  2 tests passed.
- Candidate-scoped `git diff --check`: passed.
- Production deployment: pending.
