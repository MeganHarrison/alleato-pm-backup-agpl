# Task: Worktree Cleanup Closeout

Status: In Progress
Owner: Codex
Created: 2026-07-06
Related Issue: AAI-932

## Objective

Finish the incomplete repo cleanup by removing delete-safe clean worktrees,
recomputing the remaining dirty lanes, and producing an exact ledger for what
still blocks a fully clean `alleato-pm` checkout.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and
evidence is filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document cause, detection gap, prevention step, owner,
and next action.

## Attention Brief

Primary user: Megan managing a repo that should already be consolidated to
`main`.
Primary job: remove stale worktree noise without destroying unpublished work.
Primary decision: which worktrees are safe to delete now and which dirty lanes
still require publish, archive, or discard decisions.
Tier 1: main-vs-origin truth, clean worktree removal, exact dirty ledger.
Tier 2: stale branch refs, historical cleanup notes, attached detached HEADs.
Hide until requested: full branch lists, long per-file worktree diffs.
Remove: clean attached worktrees that do not contain unpublished edits.
Failure-loudly behavior: if a worktree still has local changes, stop before
deletion and record the exact path and status instead of force-removing it.

## Acceptance Criteria

- [x] `main` vs `origin/main` truth is re-verified before any delete action.
- [x] Every clean non-primary worktree is removed successfully.
- [x] The remaining worktree inventory is re-run after cleanup.
- [x] Every remaining dirty worktree is listed with a clear disposition bucket:
      `publish`, `archive`, `discard`, or `needs review`.
- [x] Evidence records the exact removal commands and the post-cleanup git
      state.

## Task List

- [x] Capture current `main`, `origin/main`, and worktree truth.
- [x] Create the cleanup closeout task doc.
- [x] Remove clean non-primary worktrees.
- [x] Re-run worktree inventory after clean removal.
- [x] Classify all remaining dirty worktrees.
- [x] Record blockers for the dirty main checkout and any risky lanes.

## Verification Checklist

- [x] `git status --short --branch`
- [x] `git rev-parse HEAD`
- [x] `git rev-parse origin/main`
- [x] `git worktree list --porcelain`
- [x] Post-cleanup dirty/clean summary captured

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Pre-clean sync truth | `git rev-parse HEAD`; `git rev-parse origin/main` | Pass | Both were `8c7c2e63b65558e7715722b558d4bd56ce2f2365` at task start. |
| Pre-clean main status | `git status --short --branch` | Pass | `main` matched `origin/main` but had 22 local changes in the primary checkout. |
| Pre-clean worktree inventory | `git worktree list --porcelain` plus per-worktree status audit | Pass | Found 42 registered worktrees total: 23 clean and 19 dirty. |
| Clean worktree removal | `git worktree remove <path>` in a guarded loop | Pass | Removed every clean non-primary worktree without forcing any dirty path. |
| Stale metadata cleanup | `git worktree prune -v` | Pass | Pruned registry entries whose directories were already gone. |
| Post-clean inventory | `git worktree list --porcelain` plus per-worktree status audit | Pass | Remaining registry now contains 19 worktrees total: 0 clean and 19 dirty. |
| Post-clean main status | `git status --short --branch` | Partial | `main` still matches `origin/main`, but the primary checkout now shows 28 local changes after the new task artifact and existing July 6 edits. |

## Remaining Dirty Worktree Ledger

### Publish

- `/Users/meganharrison/Documents/alleato-pm`
- `/private/tmp/alleato-ai-assistant-debug-and-agent-surface`
- `/private/tmp/alleato-ai-sdk-v7`
- `/private/tmp/alleato-change-events-settings`
- `/private/tmp/alleato-drawings-and-local-dev`
- `/private/tmp/alleato-feedback-inbox-and-tasks`
- `/private/tmp/alleato-submittals-pdf-export`
- `/Users/meganharrison/.codex/worktrees/055d/alleato-pm`
- `/Users/meganharrison/.codex/worktrees/30e0/alleato-pm`
- `/Users/meganharrison/.codex/worktrees/4909/alleato-pm`
- `/Users/meganharrison/.codex/worktrees/bf84/alleato-pm`
- `/Users/meganharrison/.codex/worktrees/dfd6/alleato-pm`
- `/Users/meganharrison/Documents/alleato-pm-wt/accounting`

### Archive

- `/private/tmp/alleato-repo-cleanup-and-doc-maps`
- `/Users/meganharrison/.codex/worktrees/4f92/alleato-pm`

### Needs Review

- `/private/tmp/pr-conflicts/claude-issue-613-20260701-2240`
- `/Users/meganharrison/.codex/worktrees/4059/alleato-pm`
- `/Users/meganharrison/.codex/worktrees/b10a/alleato-pm`
- `/Users/meganharrison/.codex/worktrees/bc29/alleato-pm`

## Risks / Gaps

- Dirty worktrees still contain unpublished local edits; deleting them without a
  disposition pass would destroy work.
- The primary checkout is itself dirty, so repo-clean status is blocked even
  after all clean auxiliary worktrees are removed.
- One historical conflict-resolution worktree still contains 1451 local changes
  and needs a deliberate archive-or-publish decision before deletion.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
