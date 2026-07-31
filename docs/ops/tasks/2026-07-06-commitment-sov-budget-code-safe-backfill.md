# Task: Commitment SOV Budget Code Safe Backfill

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Backfill `project_budget_code_id` only for legacy commitment SOV rows where the
resolver finds exactly one project-local budget-code match.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before writing the backfill migration.
- [x] Use the saved resolver logic from the dry-run artifact.
- [x] Update only `subcontract_sov_items` rows with exactly one safe match.
- [x] Update only `purchase_order_sov_items` rows with exactly one safe match.
- [x] Leave ambiguous, unresolved, and missing rows untouched.
- [x] Apply migration and record migration ledger evidence.
- [x] Rerun resolver dry run after backfill.

## Verification Checklist

- [x] Migration dry run succeeds inside rollback.
- [x] Migration apply succeeds.
- [x] Migration ledger verification passes.
- [x] Post-backfill counts match expected safe-match reduction.
- [x] DB types remain current.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| Resolver baseline | Pass | Saved resolver reported 153 safe rows: 111 subcontract and 42 PO. |
| Migration dry run | Pass | `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "begin" -f supabase/migrations/20260706123000_backfill_commitment_sov_project_budget_code_ids.sql -c "rollback"` returned 111 subcontract and 42 PO updates. |
| Migration apply | Pass | `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260706123000_backfill_commitment_sov_project_budget_code_ids.sql` returned 111 subcontract and 42 PO updates. |
| Ledger repair | Pass | Inserted version `20260706123000` into `supabase_migrations.schema_migrations` after direct SQL application. |
| Migration ledger verification | Pass | `npm run db:migrations:verify-applied -- supabase/migrations/20260706123000_backfill_commitment_sov_project_budget_code_ids.sql` passed. |
| FK count read-back | Pass | `subcontract_sov_items` now has 111 FK-backed rows; `purchase_order_sov_items` now has 42 FK-backed rows. |
| Resolver post-backfill | Pass | Saved resolver now reports zero `safe_match` rows remaining. Remaining rows: 857 subcontract ambiguous, 39 subcontract unresolved, 29 subcontract missing; 218 PO ambiguous, 5 PO unresolved, 7 PO missing. |
| DB types post-backfill | Pass | Regenerated `frontend/src/types/database.types.ts`; schema unchanged from FK migration and types remain current. |

## Final Status

- [x] Backfill migration created.
- [x] Backfill applied.
- [x] Verification evidence recorded.

## Remaining Risks

- `857` subcontract rows and `218` PO rows are ambiguous because the legacy text
  cost code maps to more than one project budget-code row. These need a manual
  repair workflow or stronger source data, not automatic guessing.
- Current write APIs still accept raw text budget codes. New rows can still
  bypass the FK until the API/UI write paths are cut over.
