# Task: Restore Production Login and Guard Deployment Source

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: production-login-deployment-source-guard
Linear Issue: Not required; urgent single-session production incident requested directly by Megan.
Related Handoff: N/A

## Objective

Restore `https://projects.alleatogroup.com/auth/login` to the canonical
`The-Alleato-Group/project-management` `main` artifact and make future Vercel
production builds fail before compilation when their Git source is a backup,
fork, feature branch, or source-less local CLI deployment.

## Scope

- Vercel production alias recovery for `project-management-agent`.
- The shared frontend production-build entrypoint and its focused source-identity tests.
- Production browser and provider readback evidence.
- Excludes changes to login UI, authentication behavior, or application data.

## Source of Truth

- Canonical runtime/data owner: Vercel project `project-management-agent`, GitHub repository `The-Alleato-Group/project-management`, branch `main`.
- Existing shared primitives/services: `frontend/scripts/build/run-production-build.mjs`.
- Deprecated or parallel paths: `MeganHarrison/alleato-pm-backup` is development-only and is never a production source.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Canonical production alias resolves to Ready deployment `dpl_5QFpAicbQ23L2SMDh8PMSRZ5CNwH`.
- [x] Production login renders the original two-column light experience.
- [x] Canonical GitHub `main` production metadata passes the build gate.
- [x] Backup, feature-branch, and source-less CLI production metadata fail loudly.
- [x] Guardrail and evidence are published to `origin/main`.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared production build entrypoint owns the cross-cutting guard.
- [x] Failure identifies the observed source fields and required canonical source.
- [x] Deployment contract is fail-closed only for Vercel production; local and Preview builds remain available.

## Integration and Verification

- [x] Focused production-source unit tests pass.
- [x] Provider readback proves the canonical alias points at the intended Ready deployment.
- [x] Browser evidence proves the restored login renders on the canonical URL.
- [x] Independent review is complete.
- [x] Task-owned files are published and the remote publisher verified the exact task paths on `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `[production-source] Refusing Vercel production build` with the mismatched or missing source fields.
- Detection path: first statement in `run-production-build.mjs`, before build locks, route mutation, or Next compilation.
- Recovery path: deploy through the canonical GitHub `main` integration; never relink a backup or feature worktree to the production project.

## Incident Learning

- Failure fingerprint: `operations.provider-runtime-drift`
- Root cause: A Codex task running from `alleato-pm-backup` relinked its isolated worktree to the production Vercel project and ran `vercel --prod`.
- Detection gap: Production builds checked build/runtime contracts but did not verify repository owner, repository slug, branch, or Git provider before compiling and accepting the artifact.
- Prevention: Fail every Vercel production build unless all canonical GitHub source fields and the commit SHA are present and exact.
- Guardrail evidence: `frontend/scripts/build/__tests__/production-source-gate.test.mjs`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Alias restoration | `vercel promote project-management-agent-90k7t3jgx-the-alleato-group.vercel.app --yes --scope the-alleato-group` | Pass | Promoted `dpl_5QFpAicbQ23L2SMDh8PMSRZ5CNwH`. |
| Provider readback | `vercel inspect projects.alleatogroup.com --scope the-alleato-group` | Pass | Canonical alias resolves to the Ready `main` deployment. |
| Browser proof | `docs/ops/evidence/2026-07-24-production-login-deployment-source-guard/production-login-restored.png` | Pass | Canonical route visibly renders the original login. |
| Guardrail tests | `node --test frontend/scripts/build/__tests__/production-source-gate.test.mjs` | Pass | 5/5 focused cases passed. |
| Vercel source settings | Vercel project API readback | Pass | System env exposure is enabled; Git owner/repository/production branch are `The-Alleato-Group/project-management/main`. |
| Post-restore errors | `vercel logs dpl_5QFpAicbQ23L2SMDh8PMSRZ5CNwH --no-follow --level error --since 30m --project project-management-agent --scope the-alleato-group` | Pass with expected auth noise | Only two unauthenticated `/api/users/me/profile` 401s from login-page requests; no 5xx or restored-route error. |
| Independent review | `docs/ops/evidence/2026-07-24-production-login-deployment-source-guard/verification.md` | Pass | Codex reviewer `/root/review_prod_source_guard` approved with no blocking findings. |
| Bad artifact removal | `vercel remove <exact-deployment-id> --yes --scope the-alleato-group` | Pass | Removed both known noncanonical production artifacts; the backup repository and its development deployment remain untouched. |

## Remaining Risk

- A malicious actor with Vercel project-administration access could still reassign
  an alias manually. Normal backup, fork, feature-branch, and source-less CLI
  production builds now fail before compilation, and both known noncanonical
  production artifacts were removed.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning references the closest existing provider-runtime drift fingerprint.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
