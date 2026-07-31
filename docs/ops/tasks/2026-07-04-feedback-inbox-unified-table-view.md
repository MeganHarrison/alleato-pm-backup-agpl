# Task: Feedback Inbox Unified Table View

Status: In Progress
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-939 - https://linear.app/megankharrison/issue/AAI-939/add-unified-table-view-to-feedback-inbox
Related Handoff: N/A

## Objective

Add a dense unified table view option to `/feedback-inbox` so operators can see
many more feedback rows at once while preserving the existing split-page and
board workflows.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and
evidence is filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Attention Brief

Primary user: Alleato operator triaging internal and client feedback.
Primary job: scan many feedback rows quickly, compare fields across items, and
open details only when needed.
Primary decision: which item to inspect, verify, route, or fix next.
Tier 1: title, status, severity, tool, source page, submitter, GitHub issue,
created time.
Tier 2: category, request type, page path/url, screenshot presence.
Hide until requested: detail comments, raw selector metadata, destructive row
actions.
Primary action: switch to table view, scan rows, open detail panel for the
selected item.
Failure-loudly behavior: if the inbox data cannot load or a row update fails,
the table must preserve the existing toast/error path and not silently drop the
selection.

## Acceptance Criteria

- [x] Feedback inbox view switcher includes `Table` alongside `Split page` and `Board`.
- [x] Table mode uses the shared unified table system rather than a bespoke grid.
- [x] Table mode shows a dense multi-column row view with the key feedback
      fields needed for triage.
- [x] Existing feedback search, type filters, status tabs, and sort controls
      still affect the same underlying result set in table mode.
- [x] Clicking a table row opens the existing detail workflow instead of a new
      disconnected detail surface.
- [x] Column visibility controls are available in table mode so operators can
      show more or fewer fields as needed.

## Planned Files

- `docs/ops/tasks/2026-07-04-feedback-inbox-unified-table-view.md`
- `frontend/src/app/(admin)/feedback-inbox/page.tsx`
- `frontend/src/app/(admin)/feedback-inbox/types.ts`

## Verification Checklist

- [x] Focused lint/type checks run for touched files.
- [ ] Browser/user-flow verification run for local `/feedback-inbox` if an
      allowlisted auth session is available.
- [ ] Evidence recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear tracking | `AAI-939` | Pass | Issue created before code edits. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(admin)/feedback-inbox/page.tsx'` | Pass with existing warning | No errors. Remaining warning is the pre-existing arbitrary spacing warning on the existing search shell. |
| Changed-file type debt gate | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt introduced by the table-view change. |

## Files Changed

- `docs/ops/tasks/2026-07-04-feedback-inbox-unified-table-view.md`
- `frontend/src/app/(admin)/feedback-inbox/page.tsx`
