# Commitment SOV FK Path Map

Last reviewed: 2026-07-06

This document maps the exact code paths that currently depend on text-backed
commitment SOV budget codes. It is the scope boundary for the eventual
`project_budget_code_id` migration.

Implementation status:

- `20260706120000_add_commitment_sov_project_budget_code_fks.sql` added nullable
  `project_budget_code_id` columns to `subcontract_sov_items` and
  `purchase_order_sov_items`.
- The migration also added FK constraints, indexes, and project-match triggers
  so a SOV row cannot reference a budget code from a different project.
- Application write/read paths still need to move from text normalization to the
  FK path.
- `20260706123000_backfill_commitment_sov_project_budget_code_ids.sql`
  backfilled the 153 safe matches: 111 `subcontract_sov_items` rows and 42
  `purchase_order_sov_items` rows. The resolver now reports zero remaining safe
  automatic matches; ambiguous/unresolved/missing rows remain intentionally null.

## Baseline Type Generation

Command run before this path map:

```bash
npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts
```

Original result:

- Command succeeded.
- `frontend/src/types/database.types.ts` changed by remote schema drift: it added `daily_corpus_syntheses`, `subcontracts_with_invoice_stats`, and generated relationships to that new view.
- At that point, the four affected tables did not expose a canonical budget-code
  FK.

Current result after the schema migration:

- `subcontract_sov_items` exposes `project_budget_code_id`.
- `purchase_order_sov_items` exposes `project_budget_code_id`.
- `subcontractor_sov_items` and `subcontractor_invoice_line_items` still do not
  expose a canonical budget-code FK.

## Scope Answer

The fake budget-code connection is not everywhere. The budget, direct-cost,
prime-contract, and change-order tables generally already have relational budget
fields. The hard schema repair is concentrated in commitment SOV and the
downstream subcontractor billing copies of those SOV rows.

| Scope | Table | Current Budget Link | Required Change |
| ----- | ----- | ------------------- | --------------- |
| Must fix | `subcontract_sov_items` | `budget_code text` only | Add `project_budget_code_id -> project_budget_codes(id)`. |
| Must fix | `purchase_order_sov_items` | `budget_code text` only | Add `project_budget_code_id -> project_budget_codes(id)`. |
| Must decide | `subcontractor_sov_items` | `budget_code text` plus `source_sov_item_id -> subcontract_sov_items(id)` | Prefer deriving through `source_sov_item_id`; add direct FK only if split lines can stand alone. |
| Must decide | `subcontractor_invoice_line_items` | `budget_code text` invoice snapshot only | Add canonical FK and source SOV line reference if invoice lines must support budget-driven reporting. |
| Do not fix in this pass | `budget_lines` | `project_budget_code_id -> project_budget_codes(id)` | Already relational. |
| Do not fix in this pass | `direct_cost_line_items` | `budget_code_id -> project_budget_codes(id)` | Already relational. |
| Do not fix in this pass | `contract_line_items` | `budget_code_id -> project_budget_codes(id)` | Already relational for prime contract SOV. |
| Do not fix in this pass | `change_event_line_items` | `budget_line_id` / legacy `budget_code_id -> budget_lines(id)` | Naming is bad, but relationship is real. |
| Do not fix in this pass | `commitment_change_order_lines` | `budget_line_id`, `cost_code_id`, `cost_type_id` FKs | Already relational enough for this problem. |
| Do not fix in this pass | `acumatica_*` mirror tables | Raw ERP `cost_code` text | Mirrors should preserve external source values. Domain projections should add canonical FKs. |

## Write Paths To Update

| Owner Path | Tables Written | Current Behavior | FK Migration Impact |
| ---------- | -------------- | ---------------- | ------------------- |
| [line-items route](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/route.ts:10) | `subcontract_sov_items`, `purchase_order_sov_items` | PUT accepts the legacy budget-code column from the client and writes it directly. | Add `project_budget_code_id` to payload, validate it belongs to the same project, derive legacy display text during transition. |
| [line-items import route](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/route.ts:1) | `subcontract_sov_items`, `purchase_order_sov_items` | Imports from `budget_lines`, constructs a `cost_code_id.cost_type_code` string, and writes it to the legacy budget-code column. | Use `budget_lines.project_budget_code_id` as the canonical FK; reject/import-skip budget lines without a project budget code. |
| [subcontracts create route](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/subcontracts/route.ts:157) | `subcontract_sov_items` | Creates SOV rows from request `item.budgetCode`. | Accept/select `project_budget_code_id`; server derives display text and rejects raw-only budget codes. |
| [purchase orders create route](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/purchase-orders/route.ts:155) | `purchase_order_sov_items` | Creates PO SOV rows from request `item.budgetCode`. | Same as subcontract create. |
| [commitments import route](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/commitments/import/route.ts:173) | `subcontract_sov_items`, `purchase_order_sov_items` | Bulk commitment import writes text budget codes. | Map imported codes to project budget codes or mark unresolved in import result. |
| [legacy commitment route](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/commitments/[commitmentId]/route.ts:620) | `subcontract_sov_items`, `purchase_order_sov_items` | Updates/deletes SOV rows through older route surface. | Must be cut over or made read-only; otherwise it can bypass the new FK rule. |
| [AI action tools](/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tools/action-tools.ts:3264) | `subcontract_sov_items`, `purchase_order_sov_items` | AI tool inserts commitment SOV rows. | Must require canonical FK or disable this write path until migrated. |
| [Acumatica projection](/Users/meganharrison/Documents/alleato-pm/backend/src/services/acumatica_sync.py:2436) | `subcontract_sov_items` | Projects `Details[].CostCode` into legacy budget-code text. | Add resolver from Acumatica cost code to project budget code; unresolved rows must be logged and visible. |
| [Acumatica PO projection](/Users/meganharrison/Documents/alleato-pm/backend/src/services/acumatica_sync.py:2561) | `purchase_order_sov_items` | Deletes and reinserts Acumatica PO SOV rows with legacy budget-code text. | Same resolver requirement; also preserve `project_budget_code_id` on reinserts. |
| [SSOV route](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/subcontractor-sov/route.ts:1) | `subcontractor_sov_items` | Writes subcontractor-submitted legacy budget-code text; import action copies from source SOV row. | If rows come from source SOV, derive through `source_sov_item_id`. If users split rows manually, require canonical FK or explicit unresolved status. |
| [subcontractor invoice create](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/route.ts:700) | `subcontractor_invoice_line_items` | Inserts invoice line snapshots with legacy budget-code text. | Add canonical FK/source SOV reference at seed time while keeping snapshot text for historical display. |

## Read Paths To Update

| Owner Path | Reads | Current Behavior | FK Migration Impact |
| ---------- | ----- | ---------------- | ------------------- |
| [budget grand totals](/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/budget/compute-grand-totals.ts:759) | `subcontract_sov_items`, `purchase_order_sov_items` | Resolves committed/pending costs by normalizing legacy budget-code text. | Prefer `project_budget_code_id`; keep temporary fallback for unresolved legacy rows only. |
| [budget export](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/budget/export/route.ts:206) | SOV tables | Exports budget-related commitment costs by text code. | Read canonical FK and join labels from `project_budget_codes`. |
| [budget pending cost changes](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/budget/pending-cost-changes/route.ts:71) | SOV tables | Aggregates pending commitments by text code. | Use FK for grouping. |
| [budget details](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/budget/details/route.ts:382) | SOV tables | Shows/drills commitment lines by text code. | Use FK for rollup and label; display unresolved legacy rows distinctly. |
| [budget commitments](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/budget/commitments/route.ts:78) | SOV tables | Commitment budget drilldown reads legacy budget-code text. | Use FK. |
| [commitment scope lookup](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/commitments/scope-lookup/route.ts:122) | SOV tables | Finds matching scope by text budget code. | Use FK-backed matching. |
| [change event commitment options](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/change-events/commitment-options/route.ts:178) | SOV tables | Matches commitments by budget code candidates. | Use FK and only fallback to legacy text for unresolved rows. |
| [subcontractor invoice detail](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/route.ts:97) | SOV tables plus invoice line items | Enriches invoice lines by matching SOV values/text. | Use source SOV IDs/FKs to avoid text matching. |
| [subcontractor invoice PDF](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pdf/route.ts:88) | SOV tables plus invoice line items | PDF enrichment relies on SOV rows and text budget code. | Use source SOV IDs/FKs; keep snapshot text for display. |
| [company details](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/directory/companies/[companyId]/details/route.ts:234) | SOV tables | Vendor/company detail shows SOV budget codes. | Display canonical label from FK when present. |
| [record documents helper](/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/documents/record-documents.ts:1443) | SOV tables | Document attachment context reads line items. | Include FK in selects where labels/grouping matter. |
| [Acumatica export](/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/acumatica/export-service.ts:252) | SOV tables | Exports commitment SOV to Acumatica from current rows. | Decide whether export sends raw ERP code, canonical cost code, or stored display text. |

## Downstream Table Decision

| Table | Recommendation | Reason |
| ----- | -------------- | ------ |
| `subcontractor_sov_items` | Do not make it the primary repair table. First use `source_sov_item_id -> subcontract_sov_items(id)` to inherit the source row's `project_budget_code_id`. Add a nullable direct FK only for manual/split SSOV rows that do not map to one source row. | It is sparse and already has a source SOV FK. Duplicating every field too early increases migration surface. |
| `subcontractor_invoice_line_items` | Add `project_budget_code_id` plus a source pointer such as `source_subcontract_sov_item_id` / `source_purchase_order_sov_item_id`, or a polymorphic source if the project accepts that pattern. Keep legacy budget-code text as snapshot display text. | Invoice rows are historical billing records. They need immutable display text and a canonical FK for reporting/rollups. |

## Test And Verification Plan

1. Regenerate DB types before every schema step:

   ```bash
   npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts
   ```

2. Add an additive migration only:
   - `subcontract_sov_items.project_budget_code_id uuid null references project_budget_codes(id)`
   - `purchase_order_sov_items.project_budget_code_id uuid null references project_budget_codes(id)`
   - indexes on both columns
   - no removal of the legacy budget-code text column
   - no `NOT NULL` yet

3. Regenerate DB types and verify the new FK relationships appear.

4. Build resolver dry-run:
   - exact `budget_code == project_budget_codes.id`
   - exact `budget_code == cost_code_id.cost_type_code`
   - normalized `cost_code_id` match only when unambiguous for the project
   - classify `ambiguous`, `unresolved`, and `missing_budget_code`

5. Backfill only safe matches.

6. Re-run resolver and record before/after counts.

7. Update write paths in this order:
   - Acumatica projections
   - commitment SOV create/edit/import APIs
   - legacy commitment routes
   - AI action tool or disable it until migrated
   - SSOV and invoice seeding

8. Update read paths:
   - budget rollups first
   - budget details/export/drilldowns
   - invoice detail/PDF
   - secondary display routes

9. Targeted tests:
   - resolver unit tests
   - API test rejects raw text-only SOV save
   - API test rejects `project_budget_code_id` from another project
   - import test writes FK from `budget_lines.project_budget_code_id`
   - budget rollup test uses FK path
   - invoice seed test carries FK/source SOV reference into line items

10. Browser + DB read-back:
    - create subcontract SOV line
    - create PO SOV line
    - import SOV from budget
    - generate subcontractor invoice
    - verify DB rows carry FK and budget totals still reconcile

## Current Boundary

The first migration should only touch `subcontract_sov_items` and
`purchase_order_sov_items`. `subcontractor_sov_items` and
`subcontractor_invoice_line_items` should be addressed in the same program, but
after source SOV rows have canonical IDs. The rest of the budget tables are not
part of the fake-connection repair because they already use relational fields.
