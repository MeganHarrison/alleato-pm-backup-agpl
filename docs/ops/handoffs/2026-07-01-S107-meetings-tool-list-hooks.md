# Handoff: 2026-07-01 — Meetings tool list and hooks

## Intake Block

1) Session ID: S107
2) Task ID: AAI-865
3) Linear issue: AAI-865
4) Linear URL: https://linear.app/megankharrison/issue/AAI-865/meetings-tool-align-hooks-and-replace-project-list-with-new-series
5) Current status: In Progress
6) Files changed (absolute paths):
- /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-01-meetings-tool.md
- /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-01-S107-meetings-tool-list-hooks.md
- /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md
7) Commands run and outcome (pass/fail counts):
- `git log --oneline feat/meetings-tool --` - pass
- `git diff --name-only main...feat/meetings-tool` - pass
- targeted branch/code review of current meetings API + page + hook contracts - pass
8) Evidence artifacts (screenshot/video/report/log paths):
- none yet
9) Top 3 findings (frontend-visible issues first):
- The project meetings page still renders raw `document_metadata` meetings instead of the structured meetings model.
- The rewritten meetings APIs exist on `feat/meetings-tool`, but the hooks still expect the legacy response shapes and update verb.
- The branch contains real backend foundation through agenda/follow-up APIs, but the list/create/detail UI follow-through is unfinished.
10) Recommended next action (one line): Port or rebase the meetings foundation, then rebuild hooks and the project list/create route against the structured API contract.
11) Handoff file path: docs/ops/handoffs/2026-07-01-S107-meetings-tool-list-hooks.md
12) Migration ledger evidence: existing migration lives on `feat/meetings-tool`; live ledger verification pending integration/resume.

## Linear Updates

- Kickoff comment:
- Milestone comments:
- Completion/blocker comment:

## Current Status

This session owns the critical-path slice: align the hooks and replace the
project meetings list/create workflow so the route uses the structured meetings
tables and APIs. It also owns the contract truth that the dedicated UI port
session must consume.

## Exact Next Step

Diff the current `main` meetings files against the `feat/meetings-tool`
foundation and start porting the smallest working list/create contract.

After the list/create contract is stable, publish the exact meeting detail hook
shape and payload assumptions for the dedicated UI port session.

## Known Pitfalls

- Do not wire the page to the new API while leaving the old hook response shapes in place.
- Do not fall back silently to `document_metadata` when structured meeting loads fail.
- Keep transcript prep/digest compatibility through `transcript_document_id`.
- Do not let the UI port session define new payload shapes ad hoc; `S107` owns
  hook and route contract truth.

## Resume Commands

```bash
git -C /Users/meganharrison/Documents/alleato-pm-wt/meetings-tool log --oneline --decorate --max-count=12
git -C /Users/meganharrison/Documents/alleato-pm diff --name-only main...feat/meetings-tool
sed -n '1,240p' /Users/meganharrison/Documents/alleato-pm-wt/meetings-tool/frontend/src/hooks/use-meetings.ts
sed -n '1,220p' '/Users/meganharrison/Documents/alleato-pm-wt/meetings-tool/frontend/src/app/(main)/[projectId]/meetings/page.tsx'
```

## Evidence

Implementation not started yet; kickoff and branch-truth review complete.
