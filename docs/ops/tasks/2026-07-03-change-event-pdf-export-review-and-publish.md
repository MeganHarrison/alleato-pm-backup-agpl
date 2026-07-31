# Task: Change Event PDF Export Review And Publish

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: N/A - user-directed review/publish request; no Linear issue was discoverable in-session
Related Handoff: N/A

## Objective

Review the in-progress change-event PDF export changes, fix any blocking regressions in the task-owned diff, and publish only the reviewed change-event PDF scope to `main` if it is not already committed and live.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Current checkout, branch divergence, and publish truth assessed.
- [x] Task-owned change-event PDF files isolated from unrelated dirt.
- [x] Review findings captured before publish.
- [x] Failure-loudly behavior defined.

Failure-loudly behavior: unsupported commitment types or failed commitment lookups must fail the export path explicitly instead of silently omitting contract numbers, and publish must stop on any failed targeted check or failed `codex:finish` step.

## Implementation Checklist

- [x] Blocking review findings fixed in task-owned files only.
- [ ] Guardrail test coverage added or updated for the failure mode.
- [ ] Clean publish lane prepared on `main` without unrelated branch dirt.

## Integration Checklist

- [ ] Change-event PDF and email routes share the same commitment-resolution behavior.
- [ ] Export project metadata includes the same address fields used by the PDF template.
- [ ] Publish scope excludes unrelated branch/worktree changes.

## Verification Checklist

- [ ] Targeted lint/test checks pass for the touched files.
- [ ] Merge/publish command result recorded.
- [ ] Post-push `HEAD == origin/main` truth verified.
- [ ] Production/live truth checked if publish succeeds.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Checkout truth | `git status --short`; `git rev-list --left-right --count origin/main...HEAD` | Pass | Local branch `feat/2026-07-03-batch-financial-and-feedback-updates` is dirty and diverged from `origin/main`, so in-place publish is unsafe. |
| Task-owned diff | `git status --short -- <change-event-pdf files>` | Pass | Change-event PDF work is local-only and uncommitted. |

## Risks / Gaps

- The source checkout contains unrelated dirty files and two unrelated branch commits, so publication must happen from a clean lane.
- A live production verification step may require waiting for deployment completion after push.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
