# Task: Admin Dashboard Tabs Product Board

Status: Complete
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-760 - https://linear.app/megankharrison/issue/AAI-760/add-admin-dashboard-tabs-with-product-board-view
Related Handoff: N/A

## Objective

Add tabs to `/admin` so the existing admin page directory remains the first view and the existing Product Board kanban board is available as a second tab.

## Attention Brief

Primary user: Admin/operator using the global admin dashboard.
Primary job: Move between the admin route directory and product planning board without leaving the admin surface.
Primary decision: Whether to browse admin destinations or triage product-board items.
Tier 1: Two clear page-level views: Directory and Product Board.
Tier 2: Existing directory links and existing product-board controls.
Tier 3: Board search, filters, table toggle, and card details.
Hide until requested: Extra summaries, helper panels, or duplicate product-board explanation.
Remove: Any new stat cards, decorative panels, or bespoke board UI.
Primary action: Open an admin destination or work a product-board card.
Failure-loudly behavior: The Product Board tab reuses the existing board client, so API/load errors surface through the existing board error state instead of silently rendering an empty board.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Exact reported surface reviewed: `/admin`.
- [x] Existing Product Board implementation identified for reuse.
- [x] Noise-gate attention brief written before implementation.
- [x] Acceptance criteria written as observable behavior.

## Implementation Checklist

- [x] `/admin` has two page-level tabs: Directory and Product Board.
- [x] Directory tab preserves the existing admin route directory.
- [x] Product Board tab reuses the existing kanban board implementation.
- [x] No page-local duplicate kanban implementation is created.
- [x] No stat cards, helper panels, nested cards, or duplicate primary CTAs are added.

## Verification Checklist

- [x] Targeted lint or TypeScript check run for touched files.
- [x] Browser/user-flow verification against `/admin` records both tabs render.
- [x] Evidence artifacts recorded below.

## Files Planned

- `docs/ops/tasks/2026-06-27-admin-dashboard-tabs-product-board.md`
- `frontend/src/app/(admin)/admin/page.tsx`
- `frontend/src/app/(admin)/admin/admin-directory-view.tsx`
- `frontend/src/features/product-board/product-board-client.tsx`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint --quiet 'src/app/(admin)/admin/page.tsx' 'src/app/(admin)/admin/admin-directory-view.tsx'` | Pass | Touched files lint clean. |
| Browser/user-flow | `agent-browser open http://localhost:3001/admin`; click `Product Board`; click `Directory` | Pass | Product Board tab rendered kanban columns and cards on `/admin`; Directory tab preserved route links. |
| Browser/user-flow | `agent-browser reload`; click `Product Board`; DOM check for `SUBMITTED`, `PLANNED`, `IN PROGRESS`, `SHIPPED` | Pass | Re-verified after moving directory grid out of `page.tsx` for strict page-grid guardrail. |
| Browser artifact | `docs/ops/evidence/2026-06-27-admin-dashboard-tabs-product-board/admin-product-board-tab.png` | Pass | Screenshot of `/admin` with Product Board tab selected. |
| Browser artifact | `docs/ops/evidence/2026-06-27-admin-dashboard-tabs-product-board/admin-directory-tab.png` | Pass | Screenshot of `/admin` with Directory tab selected. |

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
