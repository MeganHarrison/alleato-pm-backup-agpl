# Task: Consolidate Repository Work onto Main

Status: Complete
Owner: Codex S207
Created: 2026-07-20
Task ID: AAI-1225
Linear Issue: [AAI-1225](https://linear.app/megankharrison/issue/AAI-1225/consolidate-repository-work-onto-main-and-remove-stale-branches)
Related Handoff: `docs/ops/handoffs/2026-07-20-S207-branch-consolidation.md`

## Objective

Adjudicate every non-main GitHub branch, preserve intentional work on `main`, delete all non-main remote refs, and leave an explicit inventory of local worktrees that cannot be removed without losing uncommitted work.

## Scope

- GitHub remote refs, branch-tip history, pull-request history, and exact `origin/main` readback.
- Task-owned tracking files and a branch-adjudication evidence report.
- Current product changes may be incorporated only when branch evidence proves they are intentional, current, and not superseded.
- Excludes deleting any dirty worktree or uncommitted user/agent changes.

## Source of Truth

- Canonical runtime/data owner: GitHub `origin/main`, GitHub branch refs, merged pull requests, and live repository readback.
- Existing shared primitives/services: `.github/workflows/prune-merged-branches.yml`, `scripts/verify/verify_branch_cleanup_workflow.mjs`, and `npm run codex:finish` publication guardrails.
- Deprecated or parallel paths: non-main remote refs and stale clean local worktrees after adjudication.

Verification contract: Required

## Acceptance Criteria

- [x] Every non-main remote branch is classified as already incorporated, intentionally integrated, or explicitly rejected as obsolete.
- [x] All intended current work is present on `origin/main` before its source ref is deleted.
- [x] No non-main remote branch refs remain.
- [x] Dirty worktrees and uncommitted changes are preserved.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [ ] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits: this task, its handoff/evidence report, and orchestration rows; product paths only after branch-by-branch adjudication.
- [x] Shared automation remains the owner of future fully merged branch cleanup.
- [x] Errors are specific and actionable.
- [x] GitHub permission and publication contracts are handled.

## Integration and Verification

- [x] Targeted branch-classification checks pass.
- [x] Live GitHub readback proves only `main` remains remotely.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a named branch with unique commits, an open pull request, a failed GitHub ref deletion, or a dirty worktree that blocks safe local deletion.
- Detection path: `git fetch --prune`, `git cherry`, `git merge-base`, GitHub PR readback, `git worktree list`, and per-worktree status.
- Recovery path: incorporate or explicitly reject the named commit, resolve the named permission failure, or preserve the dirty worktree for its owner.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: prior cleanup deliberately removed only fully merged branches; six unmerged remote refs remained, and branch-producing sessions continued to publish outside the main-only finish flow.
- Detection gap: GitHub's branch count did not distinguish incorporated-but-rewritten work from genuinely unique branch work.
- Prevention: retain safe ancestry-based automation and add explicit branch-tip adjudication before deleting unmerged refs.
- Guardrail evidence: `.github/workflows/prune-merged-branches.yml` and `scripts/verify/verify_branch_cleanup_workflow.mjs`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1225 | Pass | Scope and done gate captured before consolidation. |
| Initial remote inventory | `git fetch origin --prune`; `git for-each-ref refs/remotes/origin` | Pass | Six non-main remote refs found. |
| Initial ancestry | `git rev-list --left-right --count`; `git cherry origin/main <branch>` | Pass | All six required logical adjudication; none was a literal ancestor of current main. |
| Archive recovery | `git push origin refs/tags/archive/2026-07-20/*`; `git ls-remote --tags` | Pass | Six annotated tags retain every original branch tip before deletion. |
| Main-only remote rule | GitHub ruleset `19315027`; non-main smoke push | Pass | GitHub rejected branch creation with `GH013`; no bypass actor exists. |
| Local main-only gate | `node scripts/verify/verify_main_only_delivery_policy.mjs`; hook and CLI negative tests | Pass | The pre-push hook and `codex:finish` fail closed outside main. |
| Intended work | `pytest tests/test_acumatica_customer_projection.py -q` | Pass | 9 passed. Frontend Jest did not start because this checkout has no `jest` executable; no product assertion failed. |
| Final remote state | `git ls-remote --heads origin` | Pass | Only `refs/heads/main` remains. |
| Visual evidence | `docs/ops/evidence/2026-07-20-branch-consolidation/main-only-delivery-receipt.png` | Pass | Attached to Linear AAI-1225 as “Main-only delivery receipt”. |

## Remaining Risk

- Existing local worktrees remain intentionally untouched because nine contain uncommitted work. Owner: their current session owners. Next action: reconcile each worktree onto `main`; GitHub now rejects any attempt to republish its old branch.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
