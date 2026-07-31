# Task: JobPlanner Commitment SOV FK Backfill

Status: Verified
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session; only Linear comment tools are exposed.
Related Handoff: None

## Objective

Use live JobPlanner commitment line-item data as the source of truth to resolve
remaining legacy purchase-order and subcontract SOV rows that still have
`project_budget_code_id IS NULL`, then backfill only rows whose source mapping
is proven by JobPlanner cost code and cost type.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before broad DB/data repair.
- [x] Regenerate Supabase database types before DB-backed work.
- [x] Pull live JobPlanner project, commitment, cost-code, and cost-type data.
- [x] Build a dry-run resolver for unresolved PO and subcontract SOV rows.
- [x] Apply only exact JobPlanner-backed mappings.
- [x] Roll back rejected auto-create attempt and disable mutating budget-code creation.
- [x] Apply link-only existing-PBC rows where JobPlanner proves a single source cost type.
- [x] Leave ambiguous or unmatched rows unchanged with row-level evidence.
- [x] Verify DB read-back for all applied rows.
- [x] Verify target PO SOV rows read back with FK-backed budget-code rows.
- [x] Verify create subcontract, create purchase order, create change event, prime PCO, prime change order, commitment PCO, and commitment change order through real API routes.
- [x] Avoid unrelated dirty checkout changes.

## Verification Checklist

- [x] Dry-run counts reconcile with current unresolved DB counts.
- [x] Applied row count equals DB read-back FK-backed delta.
- [x] No applied row has a missing `project_budget_code_id` after update.
- [x] No row is mapped without a JobPlanner commitment line-item proof.
- [x] Remaining unresolved rows are quantified and classified.
- [x] Missing budget-code candidates are report-only; no canonical `project_budget_codes` are created by the resolver.
- [x] Text-only nonzero SOV inserts fail for both PO and subcontract SOV tables.
- [x] Disposable DB-level workflow verifier cleans up after itself.
- [x] Disposable route-level workflow verifier cleans up after itself.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| DB types preflight | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded with existing inbucket deprecation warning. |
| Exact PO repair | Pass | Commitment `b27bee18-9d25-4d31-a54f-145700317e02` matched JobPlanner project `3729`, commitment `3119`; two visible PO SOV rows now link to `21-1313 / S / Wet-Pipe Sprinkler System - Subcontract`. |
| Dry-run resolver | Pass | `docs/ops/evidence/2026-07-07-jobplanner-commitment-sov-fk-backfill/dry-run.json` found 200 JobPlanner-proven updates from 268 unresolved rows. |
| Apply resolver | Pass | `docs/ops/evidence/2026-07-07-jobplanner-commitment-sov-fk-backfill/apply.json` applied 54 PO rows and 146 subcontract rows. |
| DB post-apply counts | Pass | `purchase_order_sov_items`: 255 FK-backed, 10 legacy-text rows still missing FK. `subcontract_sov_items`: 949 FK-backed, 58 legacy-text rows still missing FK. |
| Post-apply resolver rerun | Pass | Resolver returned 0 additional safe updates after apply; remaining blockers are 38 missing project budget codes, 14 weak parent matches, 9 missing JobPlanner project matches, and 7 ambiguous source cost types. |
| Unsafe create-mode rollback | Pass | `rollback-unsafe-create-mode.txt` rolled back 5 PO SOV FKs, 33 subcontract SOV FKs, and 26 created `project_budget_codes` rows from the rejected create-mode attempt. |
| Create-mode disabled | Pass | `--create-missing-budget-codes` now fails loudly and directs operators to report-only ledger mode. |
| Link-only amount-unmatched dry-run | Pass | `link-only-amount-unmatched-dry-run.json` found 7 additional existing-PBC FK updates where JobPlanner proved one source cost type even though the source amount was zero. |
| Link-only amount-unmatched apply | Pass | Applied 2 PO rows and 5 subcontract rows; script now throws if an intended update affects zero rows. |
| Final DB counts | Pass | `purchase_order_sov_items`: 257 FK-backed, 8 legacy-text rows still missing FK. `subcontract_sov_items`: 954 FK-backed, 53 legacy-text rows still missing FK. `project_budget_codes`: 3466 rows. |
| Target PO SOV FK readback | Pass | DB readback for PO `2026b0d8-d4f5-4ab9-9f99-360783c86fe8` shows all 5 rows have real `project_budget_code_id`, including the repaired `21-4000 / S` line. |
| DB-level workflow contract verification | Pass | `financial-workflow-verification.json` passed 26 checks: table-level create/readback for subcontract, PO, change event, prime PCO/change order, commitment PCO/change order, FK joins, negative SOV guardrails for missing, inactive, and wrong-project `project_budget_code_id`, and zero-row cleanup readback. |
| Route-level workflow verification | Pass | `financial-api-workflow-verification.json` passed 12 checks through authenticated Next API routes on `http://localhost:3001`: create PO with FK-backed SOV, create subcontract with FK-backed SOV, create change event and budget-linked line item, create/link PCOs through `change-events/add-to-pco` with one copied line each, promote prime PCO to PCCO, promote commitment PCO to CCO, and zero-row cleanup readback. |
| Focused component test | Pass | `cd frontend && npx jest src/components/commitments/tabs/__tests__/ScheduleOfValuesTab.columns.test.tsx --runInBand` passed 8/8. |

## Failure Analysis

Cause: the previous deterministic backfill could only use local legacy budget-code
text. Rows with multiple typed candidates, missing project budget codes, or
blank legacy data could not be safely mapped without source-system context.

Detection gap: local-only checks correctly refused ambiguous mappings, but the
workflow did not then consult JobPlanner for the source commitment line-item
cost type.

Prevention: this task only applies rows where JobPlanner line items prove the
exact cost-code and cost-type pair, then writes the FK to the matching
`project_budget_codes.id`.

Additional detection gap found during this task: the first apply path trusted a
Supabase update with no error but did not verify affected row count. Prevention:
the backfill script now uses `.select("id")` after each update and throws unless
exactly one row was updated.

Rejected approach: creating missing `project_budget_codes` directly from the
JobPlanner resolver. Cause: that promoted heuristic parent/source matching into
canonical budget master data. Prevention: create-mode is disabled by design and
the script only emits `missing-budget-code-candidates.json` for explicit budget
setup review.

## Final Status

- [x] JobPlanner-backed resolver implemented.
- [x] Dry-run and apply evidence captured.
- [x] 207 SOV rows backfilled with real `project_budget_code_id` values.
- [x] Remaining unresolved rows quantified by blocker class.
- [x] Workflow create chain verified through disposable DB records and real Next API routes.
- [x] Target PO SOV verified by DB readback.

## Remaining Risks

- `38` rows have a source-proven cost-code/cost-type but no matching local
  `project_budget_codes` row, so those need budget-code setup before FK backfill.
- `14` rows did not meet the parent-commitment confidence threshold.
- `9` rows are on local projects that did not match a JobPlanner project.
