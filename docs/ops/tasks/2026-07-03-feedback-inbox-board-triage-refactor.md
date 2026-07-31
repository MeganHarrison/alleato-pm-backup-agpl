# Task: Feedback Inbox Board And Triage Refactor

Status: In Progress - Browser proof blocked by admin auth
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-891
Linear URL: https://linear.app/megankharrison/issue/AAI-891/fix-feedback-inbox-side-page-layout-and-basic-triage-controls
Related Handoff: N/A

## Objective

Keep `/feedback-inbox` board view, but refactor both board and split modes to use one quieter triage workflow with clearer hierarchy, lower cognitive load, and tighter reuse of shared board/split patterns.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: Alleato operator triaging client-submitted feedback.
Primary job: review submitted feedback, decide what to do next, act on the item, and continue through the queue.
Primary decision: does this item need review, GitHub routing, discussion, or defer/archive.
Tier 1: feedback title, comment, screenshot, status, priority, source page, GitHub state.
Tier 2: search, status scope, one compact filter control, item-level actions, comments.
Tier 3: bulk edit, tool assignment internals, resource management, debug metadata, delete.
Hide until requested: raw metadata, tool internals, destructive controls, crawl actions, verbose resource admin.
Remove: dashboard-like board chrome, redundant row metadata, noisy header controls, page-local visual wrappers.
Primary action: update status, open source page, create/open GitHub issue, comment, move to next item.
Failure-loudly behavior: review actions must preserve selection, keep entered feedback, and show specific error toasts when status/comment/GitHub/tool actions fail.

## Acceptance Criteria

- [x] Board view remains available on `/feedback-inbox`.
- [x] Split and board modes share the same top-level triage model, filters, status groupings, and visual hierarchy.
- [x] The left rail/header is reduced to the minimum controls needed for review and no longer feels like an admin toolbar.
- [x] Queue rows are scan-first: one primary line and one supporting metadata line max.
- [x] Board cards use the shared `BoardView` pattern without adding dashboard-style chrome or extra summaries.
- [x] Detail view emphasizes the decision workflow before secondary admin/debug information.
- [x] Tool assignment remains available but its internal context is hidden by default or moved behind a quieter disclosure path.
- [x] Dropdown/popover surfaces on this route stay within doctrine complexity budgets.
- [x] The page preserves the next useful action after status/comment/GitHub actions.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing split-page and board primitives identified before adding new UI.
- [x] Split and board modes use the same status lane model and item summaries.
- [x] The page removes or demotes non-triage controls before restyling.
- [x] No new one-off decorative wrappers, metric cards, or helper panels.
- [x] Failure-loudly behavior preserved for load, status, comments, GitHub, tool assignment, and delete flows.

## Planned Files

- `docs/ops/tasks/2026-07-03-feedback-inbox-board-triage-refactor.md`
- `frontend/src/app/(admin)/feedback-inbox/page.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-queue.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/tool-context-section.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/list-item-context-menu.tsx`
- `frontend/src/app/(admin)/feedback-inbox/constants.ts`
- `frontend/src/app/(admin)/feedback-inbox/helpers.ts`
- `frontend/src/app/(admin)/feedback-inbox/types.ts`

## Integration Checklist

- [x] Linear kickoff comment recorded.
- [x] Board and split item selection open the same canonical detail workflow.
- [x] Search/filter/sort state drives both split rows and board cards consistently.
- [x] Selection remains valid after search/filter/sort changes.
- [x] Mobile list/detail behavior remains functional for split mode.
- [ ] No migration/provider change required, or read-back evidence recorded if that changes.

## Regression Guardrails

- [x] Design doctrine surface complexity audit run.
- [x] Design doctrine split-page consistency audit run.
- [x] Focused lint/type checks run for touched files.
- [ ] Browser/user-flow verification run for `/feedback-inbox`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task file | `docs/ops/tasks/2026-07-03-feedback-inbox-board-triage-refactor.md` | Pass | Full-process refactor tracked before code edits. |
| Linear kickoff | Comment `b5cd2925-faa0-4858-8cd7-a918268330a0` on `AAI-891` | Pass | Scope and verification plan recorded before code edits. |
| Design doctrine surface audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/app/(admin)/feedback-inbox/page.tsx frontend/src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx frontend/src/app/(admin)/feedback-inbox/_components/feedback-queue.tsx frontend/src/app/(admin)/feedback-inbox/_components/tool-context-section.tsx frontend/src/app/(admin)/feedback-inbox/_components/list-item-context-menu.tsx` | Pass | All touched feedback inbox files passed after refactor. |
| Design doctrine split-page audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-split-page-consistency.mjs frontend/src/app/(admin)/feedback-inbox/page.tsx` | Pass | Shared split-page contract still passes. |
| Focused ESLint | `cd frontend && npx eslint -c eslint.config.mjs --quiet src/app/(admin)/feedback-inbox/page.tsx src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx src/app/(admin)/feedback-inbox/_components/feedback-queue.tsx src/app/(admin)/feedback-inbox/_components/tool-context-section.tsx src/app/(admin)/feedback-inbox/_components/list-item-context-menu.tsx` | Pass | No focused lint errors. |
| Changed type debt gate | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected in changed changes. |
| Local browser auth check | `agent-browser auth login alleato-test-3001 && agent-browser open http://localhost:3001/feedback-inbox && agent-browser get url` | Blocked | Redirected to `http://localhost:3001/access-denied?reason=admin-dashboard-allowlist`. |

## Blocked/Deferred Item

Cause: Codex browser states still do not have admin allowlist access to `/feedback-inbox`.
Detection gap: authenticated local and production browser sessions still stop at access control before route content can be inspected.
Prevention step: maintain a Codex-usable admin browser state for admin-only route proof, or keep owner-authorized in-app browser verification available for these surfaces.
Owner: Codex/app verification setup.
Next action: verify the updated route visually in an admin-authorized browser session and attach artifact evidence.

## Files Changed

- `docs/ops/tasks/2026-07-03-feedback-inbox-board-triage-refactor.md`
- `frontend/src/app/(admin)/feedback-inbox/page.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-queue.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx`
- `frontend/src/app/(admin)/feedback-inbox/_components/tool-context-section.tsx`
