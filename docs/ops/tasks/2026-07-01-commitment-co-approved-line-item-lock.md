# Task: Approved commitment CO line-item lock for GitHub issue 588

Status: In Progress
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-835 - https://linear.app/megankharrison/issue/AAI-835/commitment-co-lock-line-item-edits-when-approved
Related Handoff: docs/ops/handoffs/2026-07-01-S106-commitment-co-approved-line-item-lock.md

## Objective

Ensure approved commitment change orders cannot add, edit, or delete line
items from the real `/[projectId]/change-orders/commitment/[commitmentCoId]`
surface, then publish the fix to `main` and verify the exact production route
stops exposing the mutation affordances.

## Scope Checklist

- [x] Confirm the current `main` branch and production route still expose the bug.
- [x] Identify every bypass path on the commitment CO detail workflow.
- [x] Hide or disable commitment CO line-item mutation affordances when status is Approved.
- [x] Reject direct commitment CO line-item POST/PUT/DELETE mutations when Approved.
- [x] Reuse a shared status/lock helper across UI and server paths.
- [x] Add regression tests for the approved-lock helper and server guardrail.
- [x] Run focused verification and record command evidence.
- [x] Push the fix to `origin/main`.
- [ ] Verify the exact production route after deploy.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| `main` state | `git rev-parse HEAD && git rev-parse origin/main` | Pass | Both matched before the fix work started. |
| Bug still present on `main` | `frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx`, `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/route.ts`, `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/[lineItemId]/route.ts` | Pass | The page still rendered `Add Line Item` and row edit/delete actions; API routes had no approved lock. |
| Production repro | `agent-browser open 'https://projects.alleatogroup.com/876/change-orders/commitment/aa35f3c3-5ec0-4568-b126-f8671b4791cc?scommentId=w33evEzq5iaCVM5ub0AH'` + snapshot/text capture | Pass | Production route is Approved and still exposes `Edit`, row edit/delete actions, and `Add Line Item`. |
| Detail-page lock | `frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx` | Pass | Approved commitment COs now hide line-item actions and add-row/button affordances, and render quiet lock copy. |
| API mutation guardrail | `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/route.ts`, `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/[lineItemId]/route.ts`, `frontend/src/lib/change-orders/commitment-change-order-line-item-lock.server.ts` | Pass | POST/PUT/DELETE now read `commitment_change_orders_with_scope.status` and throw `PRECONDITION_FAILED` with `COMMITMENT_CHANGE_ORDER_LINE_ITEMS_LOCKED` details for approved COs. |
| Focused lint | `cd frontend && npx eslint 'src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx' 'src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/route.ts' 'src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/[lineItemId]/route.ts' 'src/lib/change-orders/commitment-change-order-status.ts' 'src/lib/change-orders/commitment-change-order-line-item-lock.server.ts' 'src/lib/change-orders/__tests__/commitment-change-order-status.unit.test.ts' 'src/lib/change-orders/__tests__/commitment-change-order-line-item-lock.server.unit.test.ts' --no-warn-ignored` | Pass with warnings | No errors; existing page design-system warnings remain outside this task’s delta. |
| Focused tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/change-orders/__tests__/commitment-change-order-status.unit.test.ts src/lib/change-orders/__tests__/commitment-change-order-line-item-lock.server.unit.test.ts` | Pass | 4 tests passed across the shared status helper and server guard. |
| Route guardrails | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs && cd frontend && npm run typecheck:changed` | Pass | Changed-route raw-error guard passed; repo `typecheck:changed` script reported no new `any` debt. |
| Push to `main` | `npm run codex:finish -- --message "Lock approved commitment CO line items" --allow-staged --files ...` | Pass | Published task-owned files to `origin/main` at `1635ee376e01f9813c8e8b0c68b3110b9ce470a5`. |
| Production recheck | `mcp__codex_apps__vercel._list_deployments` | Pending | Production deployment `dpl_6QMGPgt5anCQA1GAHnVF6C1hhqyq` for commit `1635ee376e01f9813c8e8b0c68b3110b9ce470a5` is still `BUILDING`, so route-level live verification is not complete yet. |

## Risks / Gaps

- The checkout contains unrelated dirty files, so publish must scope exact task-owned files.
- Production Vercel deployment must be checked after push; deployed `main` truth and live route truth are separate checkpoints.
- The prior GitHub/Linear status comments for this issue are not reliable evidence of shipped code.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Final response includes what is done, what remains, and recommended next steps.
