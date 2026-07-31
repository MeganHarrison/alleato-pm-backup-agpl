# Task: Quick Capture Backlog, Tags, And Metadata Columns

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-953 - https://linear.app/megankharrison/issue/AAI-953/add-quick-backlog-capture-and-mobile-responsive-tags-to-product-board
Related Handoff: docs/ops/handoffs/2026-07-06-S116-quick-capture-backlog-mobile-responsive-tags.md

## Objective

Add a minimal, low-friction capture path on the existing product board so
mobile/responsive ideas can be dumped into backlog quickly, tagged clearly on
the front end, assigned a tool/category/type when helpful, and filtered back
out later without opening a separate session or memory system.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing board/backlog flow reviewed against the current route and data
      model.
- [x] Existing shared primitives and board components identified before adding
      any new UI.
- [x] Source-of-truth owner chosen for backlog capture and topic filtering.
- [x] Deprecated or duplicate capture paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation
      hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked
      deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules,
      if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected
      pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable
      results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry
      run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery
      boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper
      sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external
      services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] A user can add a backlog item from the product board with a lightweight
      quick-capture flow.
- [x] A captured item can be tagged with mobile/responsive topic metadata at
      creation time.
- [x] A captured item can also capture optional tool, category, and type
      metadata at creation time.
- [x] Users can create new tool, category, and type values directly from the
      capture or inline-edit flow instead of being limited to preset options.
- [x] The product board exposes a visible filter for mobile/responsive items
      so the backlog can be triaged later.
- [x] The product board table exposes tool, category, and type columns so the
      metadata can be scanned later.
- [x] The product board table supports inline editing for the core backlog
      fields so the board can be updated without opening a separate drawer.
- [x] The new path reuses the existing admin feedback board source of truth.
- [x] The UI stays quiet and minimal on mobile and desktop.
- [ ] Verification evidence shows the capture/filter flow working on the real
      route with the new metadata columns.

## Failure-Loud Guardrails

- Capture fails with a specific error if required fields are missing or the
  board create request fails.
- Topic filtering does not silently hide items outside the selected tags.
- If mobile/responsive tagging cannot be represented cleanly in the existing
  data model, the change stops at the shared metadata helper rather than
  adding a page-local workaround.

## Initial Findings

- The product board already exists at `/product-board` and is backed by
  `admin_feedback_items`.
- The create route already supports minimal backlog insertion at
  `/api/admin/feedback/board/create`.
- Board items already render label metadata, so the likely path is to reuse the
  existing metadata structure rather than inventing a new store.
- The board currently has generic label-color filtering, but no first-class
  mobile/responsive topic filter.
- Tool, category, and type now ride the same metadata contract and are
  available in the create flow, item drawer, and table columns.

## Evidence

Linear issue:

- AAI-953: https://linear.app/megankharrison/issue/AAI-953/add-quick-backlog-capture-and-mobile-responsive-tags-to-product-board

Command evidence:

- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/features/product-board/__tests__/topics.test.ts src/app/api/admin/feedback/board/create/__tests__/route.test.ts` - PASS
- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/features/product-board/__tests__/metadata.test.ts src/app/api/admin/feedback/board/create/__tests__/route.test.ts` - PASS
- `cd frontend && ./node_modules/.bin/eslint src/features/product-board/topics.ts src/features/product-board/use-board-item.ts src/features/product-board/add-board-item-dialog.tsx src/features/product-board/product-board-client.tsx src/features/product-board/board-filter-bar.tsx src/features/product-board/board-card.tsx src/features/product-board/board-unified-table.tsx src/app/api/admin/feedback/board/create/route.ts src/features/product-board/__tests__/topics.test.ts src/app/api/admin/feedback/board/create/__tests__/route.test.ts` - PASS
- `cd frontend && ./node_modules/.bin/eslint 'src/features/product-board/metadata.ts' 'src/features/product-board/use-board-item.ts' 'src/features/product-board/add-board-item-dialog.tsx' 'src/features/product-board/board-item-dialog.tsx' 'src/features/product-board/board-unified-table.tsx' 'src/app/api/admin/feedback/board/create/route.ts' 'src/app/api/admin/feedback/board/create/__tests__/route.test.ts' 'src/features/product-board/__tests__/metadata.test.ts'` - PASS with one existing design-system warning in `frontend/src/features/product-board/board-item-dialog.tsx`
- `cd frontend && npm run typecheck:changed` - PASS (`No new 'any' type debt detected in changed changes.`)
- `agent-browser open 'http://localhost:3001/product-board?view=table'` - PASS to route, but the page rendered the local access-denied shell.
- `agent-browser snapshot` - PASS, snapshot captured the local access-denied shell.
- `agent-browser screenshot /tmp/product-board-quick-capture.png` - PASS, screenshot captured the blocked shell.

Changed files:

- `docs/ops/tasks/2026-07-06-quick-capture-backlog-mobile-responsive-tags.md`
- `docs/ops/handoffs/2026-07-06-S116-quick-capture-backlog-mobile-responsive-tags.md`
- `docs/ops/orchestration/session-board.md`
- `frontend/src/features/product-board/topics.ts`
- `frontend/src/features/product-board/metadata.ts`
- `frontend/src/features/product-board/use-board-item.ts`
- `frontend/src/features/product-board/add-board-item-dialog.tsx`
- `frontend/src/features/product-board/board-item-dialog.tsx`
- `frontend/src/features/product-board/product-board-client.tsx`
- `frontend/src/features/product-board/board-filter-bar.tsx`
- `frontend/src/features/product-board/board-card.tsx`
- `frontend/src/features/product-board/board-unified-table.tsx`
- `frontend/src/app/api/admin/feedback/board/create/route.ts`
- `frontend/src/features/product-board/__tests__/topics.test.ts`
- `frontend/src/features/product-board/__tests__/metadata.test.ts`
- `frontend/src/app/api/admin/feedback/board/create/__tests__/route.test.ts`

Current closeout gap:

- Browser/user-flow verification is blocked by the local allowlist/auth state
  on the live `/product-board` route.
