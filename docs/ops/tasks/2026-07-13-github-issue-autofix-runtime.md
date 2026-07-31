# GitHub Issue Autofix Runtime

Date: 2026-07-13
Linear: Not created - Linear app reauthentication required in this session
Status: Done

## Objective

Ensure newly created GitHub issues in `The-Alleato-Group/project-management` automatically enter the Codex autofix lane without manual intervention, then verify the live workflow with a real test issue.

## Scope

- GitHub Actions workflows under `.github/workflows/`
- GitHub repo labels, variables, and secrets needed for autofix
- Live end-to-end verification with a disposable GitHub issue

## Done Checklist

- [x] Create task markdown before implementation changes.
- [x] Prove whether the current issue-open automation is live and sufficient.
- [x] Repair any missing workflow logic, labels, variables, or secrets required for auto-entry into the fix lane.
- [x] Verify a newly created issue automatically triggers the issue-open workflow.
- [x] Verify the resulting label/fix workflow actually starts without manual intervention.
- [x] Capture concrete evidence from the live GitHub run chain.
- [x] Fill evidence section.

## Verification Plan

- Inspect `.github/workflows/issue-handler.yml` and `.github/workflows/autofix-issue.yml`
- Read repo labels/variables/secrets shape via `gh` where permissions allow
- Create a real test issue in `The-Alleato-Group/project-management`
- Poll `gh run list` / `gh run view` for `Issue Handler` and `Autofix Issue`
- Confirm issue comments/labels/PR or blocker artifacts on the test issue

## Evidence

- Existing workflows were present but not sufficient as configured: `.github/workflows/issue-handler.yml` depended on Claude-specific routing and the repo was missing the labels `area:frontend`, `autofix`, `codex:fix`, and `claude:fix`.
- Repo variable set: `AUTOFIX_ENGINE=codex`.
- Repo secrets set and verified by name/read-back timestamp: `AUTOFIX_GITHUB_TOKEN`, `OPENAI_API_KEY`.
- `.github/workflows/issue-handler.yml` was replaced with a deterministic issue-open router that:
  - triggers on `issues.opened`
  - requires `AUTOFIX_GITHUB_TOKEN`
  - adds `codex:fix` when missing
  - posts a routing comment showing `Path: codex:fix` and `Status: queued`
- Workflow YAML validated locally after the change.
- Pre-fix live failure proof:
  - Test issue `#3` triggered `Issue Handler` run `29275524741`
  - run failed with `401 Bad credentials` while adding labels because the repo secret had been written incorrectly
  - no successful autofix routing occurred for that issue
- Post-fix live success proof:
  - Test issue `#4`: `https://github.com/The-Alleato-Group/project-management/issues/4`
  - automatic routing comment posted at `2026-07-13T18:43:39Z` with `Path: codex:fix`
  - automatic label set includes `codex:fix`
  - `Issue Handler` run `29275614213` finished `success`
  - `Autofix Issue` run `29275624228` finished `success`
  - autofix workflow opened PR `#5`: `https://github.com/The-Alleato-Group/project-management/pull/5`

## Blockers

- Linear issue/comment updates remain blocked in this session because the Linear app requires reauthentication.

## Failure-Loud Guardrail

This task fails if a newly created issue still requires a human to add the fix label or otherwise manually kick off the autofix workflow.
