# Task: Commitment SOV Budget Code FKs

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Add durable database-level budget-code ownership fields for commitment SOV rows
without breaking existing text-backed reads and writes.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before writing the migration.
- [x] Regenerate Supabase database types before schema work.
- [x] Add nullable `project_budget_code_id` to `subcontract_sov_items`.
- [x] Add nullable `project_budget_code_id` to `purchase_order_sov_items`.
- [x] Add FK constraints to `project_budget_codes(id)`.
- [x] Add indexes for both new FK columns.
- [x] Add project-match validation so cross-project budget-code references fail loudly.
- [x] Verify migration syntax and generated-type expectations.
- [x] Record application status or deferral explicitly.

## Verification Checklist

- [x] Current generated table shapes reviewed.
- [x] Migration file reviewed for destructive operations.
- [x] SQL syntax checked locally where possible.
- [x] Supabase types regenerated after migration application.
- [x] Migration ledger checked.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| Task template lookup | Partial | `docs/ops/tasks/TASK-TEMPLATE.md` does not exist in this checkout; followed active task structure instead. |
| DB types preflight | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded with only the existing inbucket deprecation warning. |
| Type inspection | Pass | Confirmed `project_budget_codes.id` is typed as `string`/UUID, parent `subcontracts.project_id` and `purchase_orders.project_id` are `number`, and both SOV tables currently only have `budget_code text`. |
| Migration dry run | Pass | Ran `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "begin" -f supabase/migrations/20260706120000_add_commitment_sov_project_budget_code_fks.sql -c "rollback"`; SQL applied inside rollback. |
| Migration apply | Pass | Ran `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260706120000_add_commitment_sov_project_budget_code_fks.sql`. |
| Ledger repair | Pass | Inserted version `20260706120000` into `supabase_migrations.schema_migrations` after direct SQL application. |
| Column read-back | Pass | Verified both `subcontract_sov_items.project_budget_code_id` and `purchase_order_sov_items.project_budget_code_id` exist as nullable `uuid`. |
| FK read-back | Pass | Verified both new FK constraints reference `project_budget_codes(id)`. |
| Trigger read-back | Pass | Verified both SOV tables have `BEFORE INSERT` and `BEFORE UPDATE` project-budget-code validation triggers. |
| Trigger behavior | Pass | Transactional test inserted same-project references and confirmed cross-project references raise check violations for both SOV tables; transaction rolled back. |
| Migration ledger verification | Pass | `npm run db:migrations:verify-applied -- supabase/migrations/20260706120000_add_commitment_sov_project_budget_code_fks.sql` passed. |
| DB types post-apply | Pass | Regenerated `frontend/src/types/database.types.ts`; generated types include `project_budget_code_id` and both new FK relationships. |

## Final Status

- [x] Migration created.
- [x] Verification evidence recorded.
- [x] Remaining risks and next implementation slice documented.

## Remaining Risks

- Existing rows are not backfilled yet.
- Current application write paths can still send only legacy budget-code text because API/UI changes are a separate slice.
- The legacy budget-code column remains as transitional display/snapshot text and should not be removed until all reads have moved to the FK path.

## Next Implementation Slice

Build the resolver/backfill path:

1. Classify existing SOV rows into `safe_match`, `ambiguous`, `unresolved`, and `missing_budget_code`.
2. Backfill only safe matches.
3. Leave ambiguous/unresolved rows visible for manual repair instead of guessing.
4. Update SOV create/edit/import APIs to require or derive `project_budget_code_id`.
