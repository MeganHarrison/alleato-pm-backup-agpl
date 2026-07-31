# Task: Commitment SOV Budget Code Resolver Dry Run

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Classify legacy commitment SOV budget-code text values so only unambiguous,
project-scoped matches are eligible for automatic `project_budget_code_id`
backfill.

## Scope Checklist

- [x] Classify as full task process.
- [x] Preserve resolver SQL for repeatable dry runs.
- [x] Run the resolver against live data.
- [x] Separate safe, ambiguous, unresolved, and missing legacy rows.
- [x] Record counts by SOV table and match method.
- [x] Avoid mutating existing SOV rows in this dry-run slice.

## Verification Checklist

- [x] Resolver limits candidates to the parent commitment project.
- [x] Resolver prefers exact UUID, then cost-code plus cost-type, then cost-code-only.
- [x] Cost-code-only rows are safe only when exactly one project budget code matches.
- [x] Results show why broad automatic backfill would be unsafe.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| Legacy row counts | Pass | `subcontract_sov_items`: 1,036 total, 1,007 with legacy budget-code text, 0 with FK before backfill. `purchase_order_sov_items`: 272 total, 265 with legacy budget-code text, 0 with FK before backfill. |
| Resolver dry run | Pass | Query saved in `scripts/database/commitment-sov-budget-code-resolver-dry-run.sql` and run against live data. |
| Safe matches | Pass | 111 subcontract rows and 42 PO rows can be auto-backfilled safely. |
| Ambiguous rows | Pass | 857 subcontract rows and 218 PO rows are ambiguous `cost_code_only` matches and must not be guessed. |
| Missing/unresolved rows | Pass | 29 subcontract and 7 PO rows have missing budget codes; 39 subcontract and 5 PO rows are unresolved. |
| Post-backfill rerun | Pass | After `20260706123000_backfill_commitment_sov_project_budget_code_ids.sql`, the resolver reports zero remaining `safe_match` rows. |

## Final Status

- [x] Resolver dry run complete.
- [x] Automatic backfill boundary documented.
- [x] Unsafe rows left for manual/UX repair path.

## Next Implementation Slice

Cut over write paths so new SOV rows must carry `project_budget_code_id`; keep
ambiguous, missing, and unresolved legacy rows visible for manual repair.
