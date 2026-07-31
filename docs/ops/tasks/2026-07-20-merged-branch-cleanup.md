# Task: Enforce Automatic Merged Branch Cleanup

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-20
Task ID: AAI-1204
Linear Issue: [AAI-1204](https://linear.app/megankharrison/issue/AAI-1204/enforce-automatic-cleanup-of-merged-repository-branches)
Related Handoff: `docs/ops/handoffs/2026-07-20-S201-merged-branch-cleanup.md`

## Objective

Remove existing merged remote branches and ensure all future branches fully merged into `main` are deleted automatically without affecting active pull requests or local worktrees.

## Scope

- GitHub remote branch cleanup and a GitHub Actions cleanup owner.
- Excludes unmerged branches, open pull requests, and deletion of local branches/worktrees.

## Source of Truth

- Canonical runtime/data owner: GitHub repository branch refs and GitHub Actions.
- Existing shared primitives/services: GitHub repository setting `deleteBranchOnMerge` (enabled).
- Deprecated or parallel paths: manual remote deletion after direct merges.

Verification contract: Required

## Acceptance Criteria

- [x] Seven branch refs already merged into `origin/main` and without open pull requests are deleted.
- [x] A workflow runs after pushes to `main`, nightly, and on demand.
- [x] The workflow deletes only branch refs fully merged into the default branch and without open pull requests.
- [x] Failures produce a failed workflow and a readable summary.
- [x] Live GitHub Actions readback proves the cleanup workflow is registered.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared automation owns cross-cutting cleanup behavior.
- [x] Errors are specific and actionable.
- [x] GitHub permission and delivery contracts are handled.

## Integration and Verification

- [x] Targeted static checks pass.
- [x] Live GitHub Actions readback proves the requested outcome.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a failed `Prune merged branches` workflow naming each branch deletion failure.
- Detection path: GitHub Actions run summary plus `gh run view` readback.
- Recovery path: resolve the reported permission/protection error and rerun the workflow manually.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: GitHub’s native delete-on-merge setting does not clean branches that enter `main` outside their own merged pull request event.
- Detection gap: no repository-owned reconciliation of merged refs.
- Prevention: scheduled and push-triggered safe reconciliation workflow.
- Guardrail evidence: `scripts/verify/verify_branch_cleanup_workflow.mjs`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Remote cleanup | `gh api --method DELETE repos/The-Alleato-Group/project-management/git/refs/heads/<merged-branch>` | Pass | Seven exact merged, no-open-PR refs deleted. |
| Readback | `git fetch --prune origin` | Pass | Six non-main remote branches remain; each is unmerged or has the active PR. |
| Workflow contract | `node scripts/verify/verify_branch_cleanup_workflow.mjs` | Pass | Guards push/schedule/manual triggers, open PR preservation, ancestry check, deletion scope, and failed-run signaling. |
| YAML validation | `actionlint ... || ruby -e 'require "yaml"; YAML.load_file(...)'` | Pass | Workflow file parses successfully. |
| Live delivery | [GitHub Actions run 29775120690](https://github.com/The-Alleato-Group/project-management/actions/runs/29775120690) | Pass | `Prune merged branches` completed successfully at 2026-07-20T20:12:17Z. |

## Remaining Risk

- Closeout screenshot is blocked by an unauthenticated browser session: the canonical private GitHub Actions URL renders a logged-out 404 in `agent-browser`. Detection gap: CLI proof is available but is not a viewable screenshot. Prevention: retain the Actions run URL in Linear and capture the authenticated screenshot on the next logged-in browser session. Owner: Codex. Next action: attach a screenshot of run `29775120690` to AAI-1204, then complete the final checklist.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
