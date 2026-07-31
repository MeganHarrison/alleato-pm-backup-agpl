# Task: Repair DB Console Preview Dependency Install

Status: In Progress
Owner: SROOT
Created: 2026-07-27
Task ID: LOCAL-2026-07-27-db-console-pnpm-lockfile-deployment
Linear Issue: N/A — single-session deployment repair; no external tracking requested
Related Handoff: N/A — single-session work

## Objective

Restore a successful Vercel preview deployment for
`claude/focused-sutherland-a4eb55` by making the frontend pnpm lockfile match
the dependency manifest consumed by Vercel's frozen install.

## Scope

- Synchronize `frontend/pnpm-lock.yaml` with the two dependencies already added
  to `frontend/package.json`.
- Verify the exact frozen install command and the resulting Vercel preview.
- Exclude feature behavior changes and production promotion.

## Source of Truth

- Canonical runtime/data owner: Vercel project root `frontend`
- Existing shared primitives/services: `frontend/package.json`,
  `frontend/pnpm-lock.yaml`, `frontend/vercel.json`
- Deprecated or parallel paths: `frontend/package-lock.json` is not consumed by
  the Vercel pnpm install command

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `pnpm install --frozen-lockfile --ignore-scripts` succeeds from `frontend`.
- [ ] Vercel installs dependencies without `ERR_PNPM_OUTDATED_LOCKFILE`.
- [ ] The branch preview reaches `Ready`.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] No duplicate install path is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] The canonical pnpm lockfile owns dependency resolution.
- [x] Vercel's frozen-install failure remains specific and actionable.
- [x] The provider delivery contract is handled by branch deployment readback.

## Integration and Verification

- [x] Targeted frozen-install check passes.
- [ ] Vercel deployment readback proves the requested outcome.
- [ ] Evidence artifacts are recorded.
- [x] Known unrelated failures: none in the localized install boundary.
- [ ] Task-owned files are published to the failed deployment branch.

## Failure-Loudly Contract

- Cause surfaced as: `ERR_PNPM_OUTDATED_LOCKFILE` with the missing dependency specifiers.
- Detection path: `pnpm install --frozen-lockfile --ignore-scripts` and Vercel build logs.
- Recovery path: regenerate and commit `frontend/pnpm-lock.yaml` with pnpm 10.13.1.

## Incident Learning

- Failure fingerprint: `build.frontend-pnpm-lockfile-drift`
- Root cause: The feature commit updated `frontend/package.json` and npm's
  lockfile but omitted the pnpm lockfile used by Vercel.
- Detection gap: The branch had no PR, so PR install checks did not run before
  Vercel attempted the preview deployment.
- Prevention: Treat `frontend/pnpm-lock.yaml` as part of every frontend
  dependency change and keep the existing frozen install as the blocking
  provider detector. A pre-publish check remains follow-up prevention work.
- Guardrail evidence: `frontend/vercel.json` runs
  `pnpm install --frozen-lockfile --ignore-scripts`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before publication. |
| Failure localization | `vercel inspect project-management-agent-nfqui6keq-the-alleato-group.vercel.app --logs` | Failed as expected | Missing `@monaco-editor/react` and `axios` specifiers were named. |
| Verification contract | `docs/ops/evidence/2026-07-27-db-console-pnpm-lockfile-deployment/verification-manifest.json` | Defined | Requires frozen install, provider log, and independent review. |
| Frozen install | `cd frontend && pnpm install --frozen-lockfile --ignore-scripts` | Pass | pnpm 10.13.1 accepted the committed lockfile without mutation. |

## Remaining Risk

- The lockfile repair must still pass a live Vercel preview. The provider
  detector remains later than an enforced pre-publish check.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked.
- [ ] No deferred work remains.
