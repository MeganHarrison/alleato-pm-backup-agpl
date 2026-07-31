# Task: Product Board Leadership Review Column

Status: Complete
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-773
Linear URL: https://linear.app/megankharrison/issue/AAI-773/add-leadership-review-column-to-product-board
Related Handoff: N/A

## Objective

Add a Leadership review workflow column to `/product-board` as a real board status, not a display-only lane.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Acceptance Criteria

- [x] Product board shows a `Leadership review` column between `In Progress` and `Shipped`.
- [x] Status controls and create-card controls can select `leadership_review`.
- [x] API validation accepts `leadership_review`.
- [x] Supabase `admin_feedback_items.board_status` check constraint accepts `leadership_review`.
- [x] Existing board ordering and drag/drop behavior continues to work.

## Failure-Loudly Behavior

- API zod validation rejects unknown statuses.
- Database check constraint rejects unknown statuses.
- Migration verification must read back the applied migration version; otherwise this remains blocked/deferred.
- Browser verification must show the actual `/product-board` surface, not a nearby admin route.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Planned Files

- `frontend/src/lib/admin-feedback/constants.ts`
- `frontend/src/features/product-board/board-column.tsx`
- `frontend/src/features/product-board/board-item-dialog.tsx`
- `frontend/src/features/product-board/board-unified-table.tsx`
- `frontend/src/features/product-board/add-board-item-dialog.tsx`
- `frontend/src/features/product-board/board-table-view.tsx`
- `frontend/src/features/product-board/product-board-client.tsx`
- `frontend/src/lib/ai/tools/action-tools.ts`
- `frontend/src/lib/ai/rag-assistant-prompt.ts`
- `frontend/src/lib/ai/tools/contract/write-tools.contract.ts`
- `frontend/src/lib/admin-feedback/__tests__/constants.test.ts`
- `supabase/migrations/20260630111500_add_leadership_review_board_status.sql`

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Supabase types gate | `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts` | Blocked/Restored | Failed with `Unauthorized`; restored generated file and inspected checked-in type, where `admin_feedback_items.board_status` is `string`. No new DB columns were added. |
| DB migration apply | `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260630111500_add_leadership_review_board_status.sql` plus exact ledger insert | Pass | Applied only this migration and recorded version `20260630111500`. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260630111500_add_leadership_review_board_status.sql` | Pass | `Supabase migration ledger check passed: 20260630111500`. |
| Constraint read-back | `select conname, pg_get_constraintdef(oid) ... admin_feedback_items_board_status_check` | Pass | Constraint includes `leadership_review`. |
| Static/type/lint | `./node_modules/.bin/eslint ... product-board/admin-feedback/AI files` from `frontend/` | Pass with warning | Existing unrelated `design-system/no-raw-date-input` warning in `board-item-dialog.tsx`. |
| Targeted tests | `npm run test:unit -- --runInBand --runTestsByPath src/lib/admin-feedback/__tests__/constants.test.ts` | Pass | Guardrail confirms canonical status order and label. |
| API proof | Temporary DB row + `PATCH /api/admin/feedback/board/<id>` with `{"board_status":"leadership_review"}` + delete | Pass | API returned `{"success":true}`, DB read-back returned `leadership_review`, cleanup count was `0`. |
| Browser/user-flow | `agent-browser open http://localhost:3001/product-board`; visible text read-back | Pass | Page text includes `Leadership review0` between In Progress and Shipped; dialog status controls include Leadership review. |
| End-to-end proof | `.codex-artifacts/product-board-leadership-review/leadership-review-column.png` | Pass | Screenshot captured after live route verification. |

## Files Changed

- `docs/ops/tasks/2026-06-30-product-board-leadership-review.md` - Task done gate and evidence.
- `frontend/src/lib/admin-feedback/constants.ts` - Canonical board status list and label.
- `frontend/src/features/product-board/product-board-client.tsx` - Five-column board grid.
- `frontend/src/features/product-board/board-column.tsx` - Leadership review column styling.
- `frontend/src/features/product-board/board-item-dialog.tsx` - Leadership review status control styling.
- `frontend/src/features/product-board/board-unified-table.tsx` - Leadership review status ordering/styling.
- `frontend/src/features/product-board/add-board-item-dialog.tsx` - Create-card status styling.
- `frontend/src/features/product-board/board-table-view.tsx` - Legacy table status ordering/styling.
- `frontend/src/lib/ai/tools/action-tools.ts` - `addBoardItem` schema/status description.
- `frontend/src/lib/ai/rag-assistant-prompt.ts` - Product Board prompt status table.
- `frontend/src/lib/ai/tools/contract/write-tools.contract.ts` - Contract note aligned with DB check.
- `frontend/src/lib/admin-feedback/__tests__/constants.test.ts` - Status contract regression test.
- `supabase/migrations/20260630111500_add_leadership_review_board_status.sql` - Remote check constraint update.

## Risks / Gaps

- Existing unrelated dirty files are present in the checkout, including product-board files from prior work. Changes must be scoped and staged carefully.
- `docs/ops/tasks/TASK-TEMPLATE.md` was missing, so this task file follows the existing task markdown shape.
- Supabase type generation is currently blocked by remote auth (`Unauthorized`); checked-in types were restored after the failed attempt and no generated type changes are required because the changed field is already typed as `string`.
- Local Supabase status is blocked because Docker is not running; remote read-back used `DATABASE_URL`.
- Existing unrelated lint warning remains in `frontend/src/features/product-board/board-item-dialog.tsx` for raw `<Input type="date">`.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
