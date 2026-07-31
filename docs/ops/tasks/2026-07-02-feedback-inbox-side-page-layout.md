# Task: Feedback Inbox Side Page Layout

Status: Blocked/Deferred - Browser proof unavailable from Codex auth context
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-891
Linear URL: https://linear.app/megankharrison/issue/AAI-891/fix-feedback-inbox-side-page-layout-and-basic-triage-controls
Related Handoff: N/A

## Objective

Make `/feedback-inbox` match the established Emails side-page workspace pattern so client feedback triage has basic search, filter, sort, source-page access, and collapsible/resizable pane behavior.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: Alleato operator triaging client-submitted feedback.
Primary job: inspect submitted feedback, open the source page, route/fix/comment, and move to the next item.
Primary decision: what feedback needs action now and where it belongs.
Tier 1: feedback title/comment, source page, status, age, reporter, screenshot.
Tier 2: filter/search/sort controls, GitHub issue, comment path.
Tier 3: tool context, raw metadata, selector, ID, delete.
Hide until requested: raw debug metadata and dangerous actions.
Remove: default full-width status dropdown and bespoke split-page shell.
Primary action: open source page, update status/create issue/comment.
Failure-loudly behavior: feedback load/update failures must show specific toasts and preserve the current item list/selection.

## Acceptance Criteria

- [x] Feedback inbox uses the shared side-page/split workspace structure, not a bespoke two-pane shell.
- [x] Left rail visually matches the Emails side-page header density and icon-control pattern.
- [x] Default view shows active items: submitted/open/github_failed plus in-progress/PR-created statuses.
- [x] The always-visible `Submitted` dropdown is removed from the rail header.
- [x] Filter capability remains available through an icon control.
- [x] Search is available in the rail and filters visible feedback by title, comment, source page, submitter, and GitHub issue.
- [x] Sort is available in the rail and supports newest, oldest, priority, and source/page sorting.
- [x] The left pane can be collapsed and resized on desktop, with preferences stored locally.
- [x] Every feedback item with `page_url` exposes an `Open submitted page` affordance near the top of detail.
- [x] List rows are scan-friendly: title/comment/source/status/age are visually separated instead of same-weight property pills.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing email side-page primitive/pattern reused before adding new UI.
- [x] Default status query updated without silently dropping active in-progress work.
- [x] Filter/search/sort state has recoverable empty states.
- [x] No new one-off decorative wrappers, metric cards, or helper panels.
- [x] Failure-loudly behavior preserved for load, update, GitHub, comments, and delete paths.

## Planned Files

- `docs/ops/tasks/2026-07-02-feedback-inbox-side-page-layout.md`
- `frontend/src/app/(admin)/feedback-inbox/page.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-queue.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/list-item-context-menu.tsx`
- `frontend/src/app/(admin)/feedback-inbox/constants.ts`
- `frontend/src/app/(admin)/feedback-inbox/types.ts`

## Integration Checklist

- [x] Linear kickoff comment recorded.
- [x] Feedback rail controls use the same underlying filtered/sorted list used by selection and keyboard navigation.
- [x] Selection remains valid after filter/search/sort changes.
- [x] Mobile selection/back behavior remains functional.
- [x] No migration/provider change required, or read-back evidence recorded if that changes.

## Regression Guardrails

- [x] Design doctrine surface complexity audit run.
- [x] Design doctrine split-page consistency audit run.
- [x] Focused type/lint check run for touched files.
- [ ] Browser/user-flow verification run for `/feedback-inbox`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task template gate | `nl -ba docs/ops/tasks/TASK-TEMPLATE.md` | Process gap | Template path referenced by AGENTS is missing; this file mirrors existing task-ledger shape. |
| Linear tracking | Linear `AAI-891` | Pass | Issue created before code edits. |
| Design doctrine surface audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs ...feedback files...` | Pass | Page/detail/queue/context-menu passed. |
| Design doctrine split-page audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-split-page-consistency.mjs frontend/src/app/(admin)/feedback-inbox/page.tsx` | Pass | Route now uses `SplitPageFrame` + `SplitPage`. |
| Focused ESLint | `npx eslint -c eslint.config.mjs --quiet ...feedback files...` | Pass | No errors for task-owned feedback files. |
| Changed ESLint debt gate | `cd frontend && npm run lint:changed:debt` | Pass | No new ESLint debt across changed frontend files. |
| Changed type debt gate | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt. |
| Broad typecheck | `cd frontend && npm run typecheck` | Fail unrelated after one task-owned fix | Initial run found `feedback-queue.tsx` nullable GitHub href, fixed. Remaining errors are broad existing repo debt in admin site-map/training/user-management, API routes, comments/emails/training docs, PostHog, documents, and table primitives. |
| Browser auth check | Playwright storage states against local/prod `/feedback-inbox` | Blocked/Deferred | `user.json` reaches `access-denied?reason=admin-dashboard-allowlist`; `noblesville-budget-user.json` and `projects-user.json` redirect to login. Codex does not have an owner-authorized browser state for this admin route. |

## Blocked/Deferred Item

Cause: available Codex browser auth states do not have admin allowlist access to `/feedback-inbox`.
Detection gap: previous verification paths assumed saved auth was enough, but admin allowlist access is separate from authentication.
Prevention step: keep a current owner/admin storage state for admin-only UI proof, or provide a controlled admin test identity for `/feedback-inbox`.
Owner: Codex/app verification setup.
Next action: verify visually in the already owner-authorized in-app browser or refresh a Codex-accessible admin storage state, then mark this task complete.

## Files Changed

- `docs/ops/tasks/2026-07-02-feedback-inbox-side-page-layout.md`
- `frontend/src/app/(admin)/feedback-inbox/page.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-queue.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/list-item-context-menu.tsx`
- `frontend/src/app/(admin)/feedback-inbox/constants.ts`
- `frontend/src/app/(admin)/feedback-inbox/types.ts`
