# Task: Commitment SOV Real FK Finish

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Finish the purchase-order and subcontract commitment SOV migration so the UI,
API, and existing data use `project_budget_code_id` as the real relationship
instead of treating legacy `budget_code` text as authoritative.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before implementation.
- [x] Regenerate Supabase database types before database-backed edits.
- [x] Update commitment SOV UI state to carry `project_budget_code_id`.
- [x] Render SOV budget-code labels from canonical project budget-code options when available.
- [x] Submit `project_budget_code_id` from PO and subcontract SOV edits.
- [x] Backfill deterministic unresolved PO SOV rows, including compact legacy code formats.
- [x] Backfill deterministic unresolved subcontract SOV rows, including compact legacy code formats.
- [x] Add fail-loud DB/API guardrail preventing new text-only SOV rows where a row has a budget code.
- [x] Record unresolved/ambiguous legacy counts after backfill.
- [x] Avoid unrelated dirty checkout changes.

## Verification Checklist

- [x] Supabase migration applied or explicitly blocked with ledger evidence.
- [x] Supabase generated types remain consistent after schema changes.
- [x] Targeted unit/API/component tests pass.
- [x] Browser proof: purchase-order SOV renders FK-backed budget code.
- [x] Browser proof: subcontract SOV renders FK-backed budget code.
- [x] DB read-back: verified visible PO SOV row has `project_budget_code_id`.
- [x] DB read-back: verified visible subcontract SOV row has `project_budget_code_id`.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| Browser truth baseline | Fail | `docs/ops/evidence/2026-07-07-commitment-sov-ui-verification/commitment-000125-po-sov.png` showed the PO SOV UI rendering, but DB read-back showed `purchase_order_sov_items.project_budget_code_id` was `null`. |
| DB baseline counts | Fail | `purchase_order_sov_items`: 42 FK-backed, 230 missing. `subcontract_sov_items`: 111 FK-backed, 925 missing. |
| DB types preflight | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded with existing inbucket deprecation warning. |
| Migration dry run | Pass | Transactional dry run of `supabase/migrations/20260707133000_finish_commitment_sov_project_budget_code_fks.sql` returned 692 subcontract rows and 157 PO rows eligible for deterministic typed-code backfill, then rolled back. |
| Migration apply | Pass | Applied `supabase/migrations/20260707133000_finish_commitment_sov_project_budget_code_fks.sql`; backfilled 692 subcontract rows and 157 PO rows. |
| Migration ledger | Pass | `npm run db:migrations:verify-applied -- supabase/migrations/20260707133000_finish_commitment_sov_project_budget_code_fks.sql` passed after repairing remote ledger version `20260707133000` to applied. |
| DB post-backfill counts | Pass | `purchase_order_sov_items`: 199 FK-backed, 73 missing. `subcontract_sov_items`: 803 FK-backed, 233 missing. Remaining rows are unresolved/ambiguous and cannot be newly mutated as text-only/nonzero rows. |
| DB guardrail transaction | Pass | Rolled-back `psql` transaction confirmed text-only/nonzero inserts are rejected for both SOV tables and FK-backed inserts pass. |
| PO DB read-back | Pass | Commitment `000125` row `b07bcdf1-0dc9-404f-89a5-fdad10f934ae` now has `project_budget_code_id=ddbbd440-6850-412a-ac88-50729a6455d8` and canonical stored display `50-6500.S`. |
| Subcontract DB read-back | Pass | Subcontract `SC-001` row `0a1135d9-6b1a-4dc7-8538-b05352148607` has `project_budget_code_id=c8827fa7-a449-4c58-9a61-86ee392a4538` and canonical stored display `09-2116.S`. |
| PO browser proof | Pass | `docs/ops/evidence/2026-07-07-commitment-sov-ui-verification/commitment-000125-po-sov-fk-backed.png` shows PO `000125` SOV row and totals after DB backfill. |
| Subcontract browser proof | Pass | `docs/ops/evidence/2026-07-07-commitment-sov-ui-verification/subcontract-sc-001-sov-fk-backed.png` shows subcontract `SC-001` SOV row and totals after DB backfill. |
| Focused tests | Pass | `npm run test:unit -- --runTestsByPath ...` passed 13/13 across `ScheduleOfValuesTab`, line-items API, and line-items import API. |
| ESLint | Pass with existing warnings | Focused ESLint on touched frontend files returned 0 errors and existing warnings in the commitment detail page and legacy route. |
| Changed type debt | Pass | `npm run typecheck:changed` passed with no new `any` debt. |

## Failure Analysis

Cause: prior work added nullable FK columns and cut over some write paths, but the
commitment SOV page still modeled budget code selection around legacy text and
the legacy backfill intentionally stopped after only the safest exact matches.

Detection gap: the work was verified with API/unit/static checks but not with
browser proof plus DB read-back of the exact visible SOV row.

Prevention: this task cannot close until both PO and subcontract SOV screens have
browser artifacts and DB read-back showing visible rows are FK-backed.

## Final Status

- [x] Code changes complete.
- [x] Migration applied and ledger verified.
- [x] Browser and DB verification complete for one purchase-order SOV and one subcontract SOV.
- [x] Remaining unresolved legacy rows quantified.

## Remaining Risks

- `73` PO SOV rows and `233` subcontract SOV rows still lack `project_budget_code_id` because they did not resolve to exactly one typed project budget code.
- Those unresolved rows now fail loudly in the SOV UI as `Unmapped: ...` when they cannot map to an active project budget code option.
- New nonzero/text SOV rows are blocked at the database trigger if they do not include `project_budget_code_id`.
