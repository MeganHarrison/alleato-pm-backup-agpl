# Form ↔ Database ID Mismatch Prevention

## The Problem (2026-03-30)

Change event edit form showed empty dropdowns for Budget Code and Vendor because:

- `change_event_line_items.budget_line_id` → FK to `budget_lines.id`
- `change_event_line_items.budget_code_id` → FK to `budget_lines.id` (legacy alias for `budget_line_id`; stores `budget_lines.id`, NOT `project_budget_codes.id`)
- `BudgetCodeSelector` dropdown → returns `project_budget_codes.id` (via `/api/projects/[id]/budget-codes`, which queries the **`project_budget_codes`** table)
- **Different tables, different UUIDs. Form can never match — for `change_event_line_items` specifically.**

> **Verified live 2026-06-14.** There is **no `project_cost_codes` table** — the dropdown source is **`project_budget_codes`**. And `budget_code_id` does NOT uniformly point to `budget_lines`: only `change_event_line_items.budget_code_id` does. `contract_line_items` (commitments), `direct_cost_line_items`, and `prime_contract_sovs` all have `budget_code_id` → `project_budget_codes.id`, which **matches the dropdown directly — no resolution needed there**. The single real mismatch (`change_event_line_items`) is already resolved in its line-items API.

> **Vendor note (resolved — do NOT re-add as a mismatch):** There is **no `vendors` table**. It does not exist in the database. Every `vendor_id` column in every table is an FK to **`companies.id`** (verified live: `change_event_line_items`, `direct_costs`, `prime_contracts`, `project_vendors` all → `companies.id`). The vendor dropdown API (`/api/projects/[id]/vendors`) already returns `companies.id`. So the value the dropdown supplies IS the value stored — **no ID resolution is needed for vendor**. The original 2026-03 vendor mismatch is dead. The only real vendor concern left is the **scope mismatch** documented below (global FK vs project-scoped dropdown), not a table mismatch. `vendor_id` is a legacy column *name* only.

This pattern will recur anywhere a form dropdown loads options from a different table than what the database column references.

## The Rule

**BEFORE building any form that edits a database record with FK dropdowns:**

1. Check `database.types.ts` — find the FK relationship for each column
2. Check the form component — find what table/API each dropdown loads its options from
3. **If the FK target table ≠ the dropdown source table → you MUST add ID resolution**

## Known Mismatches in This Codebase

| Column | FK Target | Form Dropdown Source | Resolution |
|--------|-----------|---------------------|------------|
| `change_event_line_items.budget_code_id` / `budget_line_id` | `budget_lines` | `project_budget_codes` (via `/api/projects/[id]/budget-codes`) | **The only budget-code mismatch.** Resolve via `budget_lines.project_budget_code_id`; fallback through `cost_code_id` + `cost_type_id`. (`contract_line_items`, `direct_cost_line_items`, `prime_contract_sovs` need NO resolution — their `budget_code_id` already targets `project_budget_codes.id`.) |
| `change_event_line_items.vendor_id` | `companies` | `/api/projects/[id]/vendors` (already returns `companies.id`) | No mapping needed — there is no separate `vendors` table; the API joins through `project_vendors` and exposes the underlying `companies.id` directly. (The original 2026-03 mismatch has been resolved at the API layer.) |
| `*.commitment_id` | `subcontracts` or `purchase_orders` | Combined list with `sub-`/`po-` prefixes | Prefix-based parsing (already working) |
| `direct_costs.vendor_id` | `companies` | `/api/projects/[id]/vendors` (project-scoped companies) | Form injects the record's existing `vendor:companies(*)` as a synthetic option + uses `selectedLabel` fallback so Edit always renders the saved vendor even if it's outside the scoped dropdown set |
| `subcontract_sov_items.budget_code` (text) | _none — text storage by design_ | `project_budget_codes` (via `BudgetCodeSelector`) | `useSubcontractFormState` uses pure helpers `reconcileSovBudgetCodes` (matches text against id/code/fullLabel) and `synthesizeMissingBudgetCodes` (renders a placeholder option for stale codes). See `frontend/src/components/domain/contracts/subcontract-form/sovBudgetCodeReconciliation.ts` and its unit tests. |
| `purchase_order_sov_items.budget_code` (text) | _none — text storage by design_ | `project_budget_codes` | Same text-roundtrip pattern as subcontract SOV. |
| `project_directory_memberships.permission_template_id` | `permission_templates` | `permission_templates` | Resolved by the project directory permissions API which now exposes `permission_template_id` directly, replacing the earlier brittle by-name lookup in `members-tab.tsx`. |

## Scope Mismatch (variant)

Even when the dropdown endpoint and the FK column reference the same table, you can hit the
same symptom ("Select vendor..." placeholder on Edit) if the dropdown is **scoped** and the
stored FK is **global**. Example: `/api/projects/[id]/vendors` only returns vendors in
`project_vendors` for this project, but `direct_costs.vendor_id` can point at any
`companies.id` (imports, older records, company removed from project, etc.).

**Required defence for every edit form with a scoped FK dropdown:**

1. The GET API for the record must return the FK target's human-readable label
   (e.g. `vendor:companies(name, id)`).
2. The form must inject the currently-assigned FK target into the dropdown options when it
   isn't already present, AND pass a `selectedLabel` fallback to the combobox so the user
   never sees a placeholder when the FK is populated.
3. Verification: load a record whose FK points at a target outside the scoped set → click
   Edit → the combobox MUST show the assigned label, not the placeholder.

## Checklist for Any New Edit Form

- [ ] List every dropdown/select field in the form
- [ ] For each: what API does it fetch options from? What `id` field does it use?
- [ ] For each: what column does the database store? What table does the FK point to?
- [ ] If they differ: add mapping in the API (read path) and reverse-mapping (write path)
- [ ] Test by: load record → click Edit → verify all dropdowns show correct selections

## How the Fix Works

### Read path (API → Form)
The GET API maps stored IDs to form-compatible IDs:
- `budgetLineId`: stored `budget_lines.id`
- `projectBudgetCodeId`: budget_lines.id → project_budget_codes.id (via `budget_lines.project_budget_code_id`)
- Vendor: **no mapping** — stored `vendor_id` IS `companies.id`, and the dropdown already returns `companies.id`. (See the scope-mismatch section for the one defence vendor edit forms still need.)

### Write path (Form → API)
The POST/PATCH line items API resolves form IDs back to FK-compatible IDs:
- If `budgetCodeId` is not found in `budget_lines`, checks `project_budget_codes` and resolves or creates the matching `budget_lines` row
- Vendor: **no resolution** — the dropdown value is already a `companies.id`; store it directly. There is no `vendors` table to look through.

## Audit history

A full-codebase Form ↔ DB FK audit ran on 2026-05-01
(`docs/reports/fk-audit-2026-05-01.md`). All historical mismatches were
verified RESOLVED in production code paths. Two follow-ups landed in the
same change:

- The orphaned `ChangeEventLineItemsGrid.tsx` (which would have re-introduced
  the 2026-03 mismatch if anyone wired it back in) was removed.
- The `members-tab.tsx` permission template dropdown was switched from a
  brittle name-based lookup to the canonical UUID match, with a regression
  test on the API.

Re-run the audit (`/fk-audit`) any time a form dropdown is added, modified,
or pointed at a new options endpoint.
