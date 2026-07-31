# Form ↔ Database FK Validation Gate

**Trigger:** Any time you are creating or editing a form that writes to a database table via dropdown/select fields.

## Before writing ANY form code that includes select/dropdown fields

1. Open `frontend/src/types/database.types.ts`
2. Find the table the form writes to
3. For EACH dropdown field, check:
   - What column does the selected value get stored in?
   - What table does that column's FK point to? (check `Relationships` array)
   - What API does the dropdown fetch its options from?
   - What table does THAT API query?
4. **If the FK target table and the dropdown source table are DIFFERENT → you have an ID mismatch**

## If mismatch found

You MUST add:
- **Read path**: API returns a mapped ID that the form can match against its dropdown options
- **Write path**: API resolves the form's dropdown ID back to the correct FK-compatible ID before INSERT/UPDATE

## Known mismatches

| Form Field | DB Column FK Target | Dropdown Source | Fix |
|-----------|-------------------|----------------|-----|
| Budget Code (**`change_event_line_items` ONLY**) | `budget_lines` | `project_budget_codes` | Map via `budget_lines.project_budget_code_id` (already done in change-events API). NOTE: there is no `project_cost_codes` table — the dropdown source is `project_budget_codes`. For commitments (`contract_line_items`), direct costs, and prime SOV, `budget_code_id` already targets `project_budget_codes.id` → **no resolution needed**. |

> **Vendor is NOT a mismatch — do not add one.** There is **no `vendors` table** (it does not exist in the DB). Every `vendor_id` FK points to `companies.id`, and the vendor dropdown already returns `companies.id`. No resolution needed. The only vendor defence still required is the **scope** fix (global FK vs project-scoped dropdown): the edit form must inject the record's existing `vendor:companies(name,id)` as an option + pass `selectedLabel`. See `docs/patterns/form-id-mismatch-prevention.md`.

## Verification

After any form edit work, ALWAYS test:
1. Create a record with dropdown selections
2. Navigate away
3. Come back and click Edit
4. **ALL dropdowns must show the correct pre-filled values**

If any dropdown shows a placeholder ("Select...") instead of the saved value, you have an ID mismatch.

## Full reference

`docs/patterns/form-id-mismatch-prevention.md`

## Why this gate exists

A single ID mismatch between database FK targets and form dropdown sources caused budget code and vendor fields to disappear every time a user clicked Edit on change events. This was invisible during creation (values get saved) but broke every edit flow. It cost an entire night of debugging because the root cause (different tables with different UUIDs) wasn't checked upfront.
