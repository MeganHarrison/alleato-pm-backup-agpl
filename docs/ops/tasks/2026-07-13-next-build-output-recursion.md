# Task: Next Build Output Recursion Repair

Status: Complete
Owner: Codex
Created: 2026-07-13
Task ID: AAI-1064
Linear Issue: https://linear.app/megankharrison/issue/AAI-1064/stop-nextjs-build-output-recursion-and-memory-exhaustion
Related Handoff: `docs/ops/handoffs/2026-07-13-S141-next-build-output-recursion.md`

## Objective

Make the canonical frontend production build complete deterministically without
recursively tracing generated Next.js output or exhausting the Node heap.

## Scope

- Own `frontend/next.config.ts`, the canonical production-build runner, the dev-only TypeScript config boundary, and a focused build-output guardrail/test.
- Promote the existing `build.silent-compiler-stall` registry entry from silence-only detection to the proven output-boundary prevention contract.
- Reproduce and verify in a clean isolated checkout without disturbing the active localhost server or other sessions.
- Exclude unrelated application source/type debt and other sessions' dirty files.

## Source of Truth

- Canonical runtime/data owner: `frontend/scripts/build/run-production-build.mjs` and `frontend/next.config.ts`.
- Existing shared primitives/services: `frontend/package.json` `build:production`, Next.js output-file tracing configuration, and `scripts/dev/start-frontend-clean.sh`.
- Deprecated or parallel paths: ad hoc `next build` invocations are diagnostic only; `build:production` is the closeout path.

## Acceptance Criteria

- [x] A clean isolated reproduction identifies the exact recursive growth path.
- [x] The production build completes with exit code 0 using the canonical runner.
- [x] Generated output contains no nested Next.js dist tree and remains within a documented size bound.
- [x] Failure-loudly behavior reports unsafe dist/output configuration before a multi-gigabyte build.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate build paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared build configuration owns the cross-cutting repair.
- [x] Errors are specific and actionable.
- [x] Port-scoped dev output no longer mutates the tracked production `tsconfig.json`.
- [x] Database, provider, authentication, permission, and delivery contracts are not applicable.

## Integration and Verification

- [x] Focused guardrail tests and syntax checks pass.
- [x] Clean production build passes in an isolated checkout.
- [x] Build output size and nested-dist scan are recorded as evidence.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Follow-up direct-dev guard is published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the preflight names the dist directory or tracing root that can include generated output.
- Detection path: focused build-config guard plus clean production build and output-size/nested-tree scan.
- Recovery path: remove leaked dev environment values and rerun the canonical production build with `.next` plus `tsconfig.json`.

## Incident Learning

- Failure fingerprint: `build.silent-compiler-stall`
- Root cause: production inherited a port-scoped dev dist/tsconfig; Next's production tracer hard-codes its generated-chunk ignore to `.next`, so the custom dist bypassed the optimization while dev processes also polluted the tracked tsconfig.
- Detection gap: the existing silence watchdog bounded no-output time but did not reject unsafe dist/tsconfig inputs, report output growth, inspect nested output, or isolate dev config writes.
- Prevention: keep custom paths development-only; enforce production preflight, live size monitoring, post-build inspection, and per-port ignored dev tsconfigs.
- Guardrail evidence: `docs/ops/evidence/2026-07-13-next-build-output-recursion/REPORT.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task, AAI-1064, S141 ownership | Pass | Scope and done gate captured before implementation. |
| Prior reproduction | Drawings capability supplemental build | Fail | Default heap exhausted; high-memory retry grew generated output beyond 5.3 GB. |
| Root-cause baseline | Clean `origin/main` `npm run build:production` | Pass | 1.1 min, 559 MB, no nested output; canonical `.next` is safe. |
| Focused guard | `node --test frontend/scripts/build/__tests__/build-output-boundary.test.mjs` | Pass | 8/8 tests, including custom dev dist without isolated tsconfig. |
| Patched production build | `npm run build:production` in isolated verifier | Pass | 2.0 min; 541,045,794 bytes; 1,068 NFT files; no nested output. |
| Dev isolation | Restarted localhost:3001 and :3002 with patched launcher | Pass | Both Ready using per-port `.tsconfig-dev-*`; production tsconfig stayed clean. |
| Detailed evidence | `docs/ops/evidence/2026-07-13-next-build-output-recursion/REPORT.md` | Pass | Commands, sizes, cause, detection gap, and prevention recorded. |
| Publish | `git push origin HEAD:main` plus fetch/read-back | Pass | Implementation commit `7b4db99b0e892cb3b627267435e48b342d07a083` reached `origin/main` and matched local HEAD. |
| Direct-dev follow-up | S138 `.next-s138` bypass reproduction | Pass | Missing `NEXT_TSCONFIG_PATH` now fails at config load; ports 3001/3002 use canonical launcher; published at `970416e740478b78dc9df1e554cc17950fe45887`. |
| Final follow-up build | Isolated `npm run build:production` | Pass | 1.2 min; 541,045,568 bytes; no nested Next.js dist directories. |

## Remaining Risk

- The build still emits existing cookie-based dynamic-render diagnostics during static probing; they do not fail compilation and are unrelated to output recursion.

## Final Status

- [x] All required implementation and verification checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
