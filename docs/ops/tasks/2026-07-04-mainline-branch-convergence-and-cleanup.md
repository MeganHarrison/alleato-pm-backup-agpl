# Task: Mainline Branch Convergence And Cleanup

Status: In Progress
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-932 - https://linear.app/megankharrison/issue/AAI-932/audit-and-publish-all-active-alleato-pm-worktree-changes-to-main
Related Handoff: `docs/ops/handoffs/2026-07-04-S113-mainline-branch-convergence-and-cleanup.md`

## Objective

Reduce the current branch/worktree sprawl to one truthful ledger: identify which
branches still contain work not on `origin/main`, publish or defer only the real
remaining bundles, and delete the branches/worktrees already proven redundant.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and
evidence is filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document cause, detection gap, prevention step, owner,
and next action.

## Attention Brief

Primary user: Megan managing multiple Codex/Claude worktrees in one repo.
Primary job: know exactly what is still unpublished, what is already on `main`,
and what can be deleted without losing work.
Primary decision: which remaining branches are true merge candidates versus
branch/worktree noise.
Tier 1: branch truth, worktree ownership, publish truth, delete-safe branches.
Tier 2: docs/checkpoint branches, duplicate refs, stale remotes, review state.
Hide until requested: raw git logs, repeated patch-equivalent refs, long branch
lists without classification.
Remove: stale remotes, patch-equivalent local refs, orphaned named worktrees,
and ambiguous "maybe important" branches.
Primary action: classify, publish or defer, then delete redundant refs.
Failure-loudly behavior: if any branch still has unique non-main commits or an
attached worktree, the cleanup must stop with the exact branch, owner files, and
next action instead of deleting optimistically.

## Acceptance Criteria

- [ ] Every non-`main` local/remote branch is classified as `already on main`,
      `subset of another branch`, `real outstanding work`, or `checkpoint/docs only`.
- [ ] Local `main` is fast-forwarded to `origin/main` before any delete claims.
- [ ] Branches already proven patch-equivalent to `origin/main` are deleted
      locally once their attached worktrees are removed.
- [ ] Stale remote-tracking refs are pruned.
- [x] Any branch with real outstanding work has a concrete disposition:
      publish now, defer with owner, or preserve intentionally.
- [x] The final ledger states exactly what remains and why.

## Implementation Plan

1. Bind the existing Linear issue, handoff, and session-board claim to this run.
2. Fast-forward the primary checkout to `origin/main` and re-run the branch/worktree audit.
3. Remove stale remote refs and classify all local branches against
   `origin/main` with commit-level comparisons.
4. Remove only delete-safe local branches after confirming they are not attached
   to active worktrees.
5. Record remaining merge candidates, checkpoints, and blockers in the handoff.

## Task List

- [x] Existing branch/worktree inventory captured against `origin/main`.
- [x] Create the task artifact and worker handoff ledger.
- [x] Claim one active cleanup session in `docs/ops/orchestration/session-board.md`.
- [x] Post kickoff update to `AAI-932`.
- [ ] Fast-forward local `main` to `origin/main`.
- [x] Recompute patch-equivalent branch list after the initial cleanup pass.
- [x] Remove delete-safe worktrees that only point at already-landed branches.
- [x] Delete local branches already proven patch-equivalent to `origin/main`.
- [x] Record outstanding merge/defer candidates with exact branch names and file scope.
- [x] Validate the handoff with `npm run linear:codex:check -- ...`.

## Files To Change

- `docs/ops/tasks/2026-07-04-mainline-branch-convergence-and-cleanup.md`
- `docs/ops/handoffs/2026-07-04-S113-mainline-branch-convergence-and-cleanup.md`
- `docs/ops/orchestration/session-board.md`
- `docs/ops/orchestration/review-queue.md` if review submission happens in this run

## Scope Checklist

- [x] Existing branch/worktree architecture reviewed before cleanup.
- [x] Existing publish/process docs identified before deleting anything.
- [x] Source-of-truth chosen as `origin/main` plus commit-level diffing.
- [x] Stale or duplicate paths identified separately from real merge candidates.
- [x] Acceptance criteria written as observable branch/worktree outcomes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] External system owner chosen for issue/workflow tracking (`AAI-932`).
- [ ] Local `main` updated to the remote source of truth.
- [x] Branch cleanup limited to delete-safe refs only.
- [x] Branch cleanup limited to delete-safe refs only.
- [ ] No unrelated feature work is reverted or silently discarded.
- [x] No unrelated feature work is reverted or silently discarded.
- [x] Checkpoint/docs branches are separated from product-code merge candidates.
- [x] Checkpoint/docs branches are separated from product-code merge candidates.
- [x] Errors remain specific and actionable; no silent git cleanup.
- [x] Errors remain specific and actionable; no silent git cleanup.

## Integration Checklist

- [ ] Linear issue, task doc, handoff, and session-board row all agree on scope.
- [x] Linear issue, task doc, handoff, and session-board row all agree on scope.
- [ ] Worktree inventory and branch inventory resolve to one canonical ledger.
- [x] Worktree inventory and branch inventory resolve to one canonical ledger.
- [ ] Delete actions occur only after worktree ownership is cleared.
- [x] Delete actions occur only after worktree ownership is cleared.
- [x] Deferred branches have explicit next owner action.
- [x] Deferred branches have explicit next owner action.

## Regression Guardrails

- [ ] Branch truth is based on `git log --cherry-pick --right-only` or equivalent,
      not only `git branch --no-merged`.
- [x] Branch truth is based on `git log --cherry-pick --right-only` or equivalent,
      not only `git branch --no-merged`.
- [ ] Cleanup fails loudly when a branch is still attached to a worktree.
- [x] Cleanup fails loudly when a branch is still attached to a worktree.
- [x] Cleanup ledger is written so future sessions can avoid repeating the audit.
- [x] Cleanup ledger is written so future sessions can avoid repeating the audit.

## Verification Checklist

- [ ] Static/process verification: task doc, handoff, session board, Linear kickoff.
- [ ] Targeted git verification on branch divergence and worktree ownership.
- [x] Final handoff validation command run.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated blockers documented with exact branch/worktree names.
- [x] Static/process verification: task doc, handoff, session board, Linear kickoff.
- [x] Targeted git verification on branch divergence and worktree ownership.
- [ ] Final handoff validation command run.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated blockers documented with exact branch/worktree names.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Initial branch audit | `git fetch origin --prune`; `git branch -vv`; `git branch -r`; commit-level comparison script | Pass | Found 47 non-main refs, 25 patch-equivalent to `origin/main`, and a smaller set of real outstanding work bundles. |
| Worktree ownership audit | `git worktree list` | Pass | Confirmed several named branches still mounted in active worktrees and therefore not delete-safe yet. |
| Linear binding | `AAI-932` | Pass | Existing issue matches this cleanup scope and remains the canonical tracker. |
| Control-plane setup | Task doc, handoff, session-board row, Linear kickoff comment | Pass | Claimed `S113` against `AAI-932` and recorded the cleanup scope in repo + Linear. |
| Redundant worktree cleanup | `git worktree remove /private/tmp/alleato-feedback-slice-check`; `git worktree remove /private/tmp/alleato-publish-prime-invoices` | Pass | Removed two clean, already-landed worktrees so their branches became delete-safe. |
| Delete-safe branch cleanup | `git branch -D ...` | Pass | Deleted 22 local branches already proven patch-equivalent to `origin/main` and not attached to active worktrees. |
| Redundant remote cleanup | `git push origin --delete codex/feedback-category-filter-checkpoint` | Pass | Removed the one clearly redundant remote checkpoint branch after confirming its patch-equivalent content was already on `main`. |
| Post-cleanup branch audit | commit-level comparison script; `git worktree list`; `git status --short --branch`; `git diff --name-only HEAD..origin/main` | Partial | Remaining blockers are now explicit: dirty attached redundant worktrees and a dirty `main` checkout that overlaps the one-commit remote fast-forward. |
| Branch publication triage | `git log --cherry-pick --right-only origin/main...<branch>`; `git diff --name-only origin/main...<branch>`; branch subset compare against `feat/meetings-tool` | Pass | Reduced the real remaining branches to publishable candidates, proved `feat/meetings-agenda`, `feat/meetings-pdf`, and `feat/meetings-admin-templates` are subsets of `feat/meetings-tool`, and proved `codex/subcontractor-invoice-procore-pdf-parity-taskdoc` is superseded by richer task content already on `main`. |
| Draft PR creation | PRs `#674`, `#675`, `#676`, `#677`, `#678`, `#679`, `#680`; existing PR `#528` | Pass | Every real remaining branch now has an explicit review lane or an existing PR. |
| Handoff validation | `npm run linear:codex:check -- docs/ops/handoffs/2026-07-04-S113-mainline-branch-convergence-and-cleanup.md` | Pass | Handoff format and required fields validate after the PR/disposition update. |

## Remaining Ledger

- Existing review lane: `codex/eve-agent` already has open PR `#528`, so no new
  PR was needed.
- New draft PRs opened from the branch audit:
  `#674` `chore/docs-ops-backfill-commit`,
  `#675` `claude/issue-613-20260701-2240`,
  `#676` `codex/change-order-flow-rehome`,
  `#677` `codex/eve-pr-527-fixes`,
  `#678` `feat/2026-07-03-batch-financial-and-feedback-updates`,
  `#679` `fix/meetings-detail-transcript-first`,
  `#680` `feat/meetings-tool`.
- Covered by a superset branch, so no separate PR is needed:
  `feat/meetings-agenda`,
  `feat/meetings-pdf`,
  `feat/meetings-admin-templates` are subsets of `feat/meetings-tool`.
- Superseded on `main`, so no separate PR or direct push is needed:
  `codex/subcontractor-invoice-procore-pdf-parity-taskdoc`. A clean detached
  cherry-pick attempt hit an add/add conflict because `main` already has a
  richer version of the same task doc.
- Still cleanup-only work after the PR pass:
  attached redundant worktrees and local branches that are already
  patch-equivalent or intentionally preserved still need a later delete pass.

## Risks / Gaps

- Several already-landed branches are still attached to named worktrees, so
  final deletion must be sequenced through worktree removal first.
- The new PRs are intentionally drafts. Some are broad checkpoint branches and
  still need review, possible splitting, or rebasing before merge.
- The main checkout remains dirty with unrelated July 6 work, so no direct
  publish-through on those paths was attempted from this convergence pass.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
