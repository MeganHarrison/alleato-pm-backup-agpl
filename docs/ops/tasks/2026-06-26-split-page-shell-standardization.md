# Task: Split Page Shell Standardization

Status: Verified With Gaps
Owner: Codex
Created: 2026-06-26
Linear Issue: Blocked - available Linear tools can comment on existing issues only; no issue creation tool exposed in this session.

## Objective

Standardize non-table-first split/work-queue pages on one shared shell so Emails, Tasks, and Comments use consistent desktop, mobile, height, pane, and detail-panel behavior. Exclude table-first pages that should remain on `UnifiedTablePage.sidePanel` or `DetailPanel`.

## Scope

- [x] Classify work as full task process.
- [x] Identify non-table-first split pages.
- [x] Add a shared split page shell/component on top of the existing `SplitPage` primitive.
- [x] Migrate `/emails` mail view to the shared shell without changing table/list views.
- [x] Migrate `/tasks` and `/:projectId/tasks` split view to the shared shell.
- [x] Migrate `/comments` to the shared shell.
- [x] Keep AI Agents, Outlook Intake, Meetings, and other table-first pages unchanged.
- [x] Run focused lint/type checks for touched files.
- [x] Verify `/emails`, `/tasks`, and `/comments` in browser.

## Acceptance Criteria

- One shared component owns the split page shell for non-table-first work queues.
- Desktop split pages use consistent full-height behavior, overflow boundaries, and pane switching semantics.
- Mobile behavior remains usable: list-first, detail opens after selecting an item, and back/close behavior is available.
- Table-first pages remain on their existing `UnifiedTablePage.sidePanel` or `DetailPanel` path.
- No new decorative wrappers, stat cards, or helper panels are added.

## Noise Gate

Primary user: PM/operator moving through inbox-like work queues.
Primary job: scan a list, select an item, and act in the detail pane.
Primary decision: which item needs attention and what action should happen next.
Tier 1: list row, selected detail/work area, essential detail rail where applicable.
Hidden until requested: secondary metadata, full source/debug payloads, table-first drawer behavior.
Removal candidates: custom one-off split sizing and duplicated mobile pane logic.
Primary action: select item and work detail.
Failure-loudly behavior: pages should show their existing empty/error states; the shell should not swallow missing selections or content.

## Files To Change

- `frontend/src/components/ui/split-page.tsx`
- `frontend/src/features/emails/project-emails-workspace.tsx`
- `frontend/src/features/tasks/tasks-inbox.tsx`
- `frontend/src/app/(main)/comments/page.tsx`
- `docs/ops/tasks/2026-06-26-split-page-shell-standardization.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Focused lint | `cd frontend && npx eslint 'src/components/ui/split-page.tsx' 'src/features/emails/project-emails-workspace.tsx' 'src/features/tasks/tasks-inbox.tsx' 'src/app/(main)/comments/page.tsx' --cache --cache-strategy content` | Pass with warnings | 0 errors. Existing design-system warnings remain in comments, emails, and tasks. |
| Browser `/emails` | `agent-browser open 'http://localhost:3001/emails?view=mail'` + `/tmp/alleato-split-page-shell/emails-mail-auth.png` | Pass | Authenticated desktop route rendered mail split view without horizontal overflow. |
| Browser `/tasks` | `agent-browser open 'http://localhost:3001/tasks?view=split&scope=all'` + `/tmp/alleato-split-page-shell/tasks-split-auth-settled.png` | Pass | Authenticated desktop route rendered shared-frame split view with live rows, detail panel marker, and no horizontal overflow. |
| Browser `/comments` | `agent-browser open 'http://localhost:3001/comments'` + `/tmp/alleato-split-page-shell/comments-auth.png` | Pass | Authenticated desktop route rendered comments split view with shared viewport frame. |

## Risks / Gaps

- Linear issue creation blocked because no create-issue tool is exposed. Detection: `tool_search` returned only comment/list tools for Linear. Prevention: expose a Linear issue creation tool or document the existing issue to attach comments to.
- Worktree has unrelated dirty files. Detection: `git status --short` shows unrelated admin, AI, PSR, and email-feedback files. Prevention: only edit task-owned files and do not revert unrelated changes.

## Final Status

- [x] All checklist items complete.
- [x] Evidence recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
