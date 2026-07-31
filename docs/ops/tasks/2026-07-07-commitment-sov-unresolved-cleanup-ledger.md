# Task: Commitment SOV Unresolved Cleanup Ledger

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Classify the remaining legacy purchase-order and subcontract SOV rows that still
have `project_budget_code_id IS NULL` after the deterministic FK backfill, and
produce an explicit cleanup ledger with exact reasons and next actions.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before implementation.
- [x] Query current unresolved PO and subcontract SOV rows from Supabase.
- [x] Classify rows by missing code, no typed project budget-code candidate, null-type-only candidate, ambiguous typed candidates, or other reason.
- [x] Produce a durable cleanup artifact under `docs/ops/evidence/`.
- [x] Identify whether any remaining rows are safe for another automated backfill.
- [x] Avoid unrelated dirty checkout changes.

## Verification Checklist

- [x] DB counts reconcile to the known unresolved totals.
- [x] Cleanup artifact includes row-level IDs, parent commitment, project, legacy budget code, amount, reason, candidate IDs, and recommended action.
- [x] No database mutations are made unless a safe automated class is proven.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| Corrected classification query | Pass | Queried all unresolved PO/subcontract SOV rows and loaded project-budget-code candidates for all 26 represented projects. |
| DB count reconciliation | Pass | Ledger totals reconcile to 306 unresolved rows: 73 `purchase_order_sov_items`, 233 `subcontract_sov_items`. |
| Reason classification | Pass | `no_project_budget_code_match`: 142; `ambiguous_typed_matches`: 128; `blank_code_nonzero_amount`: 29; `blank_code_zero_amount`: 7. |
| Row-level ledger | Pass | `docs/ops/evidence/2026-07-07-commitment-sov-unresolved-cleanup/unresolved-commitment-sov-ledger.csv` has 307 lines: one header plus 306 rows. |
| Summary artifact | Pass | `docs/ops/evidence/2026-07-07-commitment-sov-unresolved-cleanup/unresolved-commitment-sov-summary.json` stores the machine-readable counts. |
| Human summary | Pass | `docs/ops/evidence/2026-07-07-commitment-sov-unresolved-cleanup/README.md` summarizes counts, reasons, and actions. |
| Automated backfill decision | Pass | Zero rows classified as `safe_typed_match_remaining`; no database mutation was made. |

## Failure Analysis

Cause: the first deterministic migration only backfilled rows whose legacy text
resolved to exactly one active typed project budget code. The remaining rows are
not all equal; some may be missing source codes, some may reference inactive or
null-type codes, and some may be genuinely ambiguous.

Detection gap: previous verification stopped at aggregate unresolved counts
instead of producing a row-level ledger for cleanup ownership.

Prevention: this task will preserve row-level evidence and avoid guessing any
financial mapping that is not deterministic.

## Final Status

- [x] Cleanup ledger complete.
- [x] No additional safe automated backfill identified.
- [x] Remaining rows require manual mapping, missing project-budget-code creation, or intentional exclusion.

## Remaining Risks

- `128` rows have multiple typed candidates and require choosing the correct cost type.
- `142` rows have no matching project budget code and need project-budget-code setup or explicit exclusion.
- `29` rows have nonzero amounts with blank legacy budget-code text and require source data repair before trust.
- `7` rows have blank legacy budget-code text with zero amount and may be intentionally unmapped if confirmed.
