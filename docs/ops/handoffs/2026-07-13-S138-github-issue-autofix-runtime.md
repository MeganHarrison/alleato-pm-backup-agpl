# Handoff: 2026-07-13 — GitHub issue autofix runtime

## Intake Block

1) Session ID: S138
2) Task ID: GITHUB-ISSUE-AUTOFIX-2026-07-13
3) Linear issue: Not created
4) Linear URL: Blocked - Linear app requires reauthentication
5) Current status: Done
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-13-github-issue-autofix-runtime.md`, `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S138-github-issue-autofix-runtime.md`
7) Commands run and outcome (pass/fail counts): workflow inspection, repo label/secret/variable repair, live issue creation, and GitHub Actions verification completed; one expected pre-fix workflow failure on issue #3, one successful end-to-end post-fix workflow chain on issue #4
8) Evidence artifacts (screenshot/video/report/log paths): GitHub CLI workflow/run output in terminal history
9) Top 3 findings (frontend-visible issues first):
- New GitHub issues did not reliably enter the Codex autofix lane because the repo was missing required labels and the issue-open router still depended on a Claude-specific path.
- The first live test issue failed with `401 Bad credentials` because `AUTOFIX_GITHUB_TOKEN` had been written incorrectly, proving the automation was not actually working before repair.
- After replacing the issue-open router with deterministic Codex routing and correcting repo secrets, a new issue automatically received `codex:fix`, triggered `Issue Handler`, triggered `Autofix Issue`, and opened PR #5 without human intervention.
10) Recommended next action (one line): Let PR #5 complete its normal review/check/auto-merge path and close the failed disposable issue #3 if no longer needed.
11) Handoff file path: `docs/ops/handoffs/2026-07-13-S138-github-issue-autofix-runtime.md`
12) Migration ledger evidence: Not applicable

## Linear Updates

- Kickoff comment: Blocked - Linear app requires reauthentication
- Milestone comments: None yet
- Completion/blocker comment: Pending

## Current Status

Live GitHub issue autofix routing is working end to end for newly created issues.

## Exact Next Step

Monitor PR #5 through merge and optionally clean up disposable validation issue #3.

## Known Pitfalls

- Repo-level GitHub secrets and variables may be empty while org-level config is hidden from the current token.
- Labels referenced by the issue template/workflows must actually exist or issue automation will drift silently.
- Writing a GitHub secret with the wrong CLI form can produce a valid-looking secret name with an unusable token value; the workflow then fails later with `401 Bad credentials`.

## Resume Commands

```bash
gh workflow list --repo The-Alleato-Group/project-management
gh run list --repo The-Alleato-Group/project-management --limit 30 --json databaseId,displayTitle,event,headBranch,name,status,conclusion,workflowName,createdAt
gh api 'repos/The-Alleato-Group/project-management/labels?per_page=100' --jq '.[].name'
```

## Evidence

- Task file: `docs/ops/tasks/2026-07-13-github-issue-autofix-runtime.md`
- Workflow change published on `main` in commit `8ac35e663922947921fe0e3d80487b10be4fa5aa`
- Repo variable read-back: `AUTOFIX_ENGINE=codex`
- Repo secrets read-back timestamps:
  - `AUTOFIX_GITHUB_TOKEN` updated `2026-07-13T18:43:10Z`
  - `OPENAI_API_KEY` updated `2026-07-13T18:43:11Z`
- Failed proof before repair:
  - Issue `#3` created
  - `Issue Handler` run `29275524741` failed with `401 Bad credentials`
- Successful proof after repair:
  - Issue `#4`: `https://github.com/The-Alleato-Group/project-management/issues/4`
  - routing comment: `https://github.com/The-Alleato-Group/project-management/issues/4#issuecomment-4961399411`
  - `Issue Handler` run `29275614213` concluded `success`
  - `Autofix Issue` run `29275624228` concluded `success`
  - PR `#5`: `https://github.com/The-Alleato-Group/project-management/pull/5`
