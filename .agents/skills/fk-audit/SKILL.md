---
name: fk-audit
description: >
  Audit form dropdowns against database FK targets to catch ID mismatches.
  Use when building, editing, or reviewing any form with select/dropdown fields
  that write to database tables. Traces the complete ID chain: database column FK target
  vs dropdown API source table. Reports mismatches that cause edit forms to show empty
  placeholders instead of saved values. Can audit a single form or scan the entire codebase.
  Trigger for: "audit FK", "check form dropdowns", "validate form IDs", "fk-audit",
  "form mismatch", "dropdown IDs", "why is my dropdown empty on edit".
metadata:
  filePatterns:
    - "frontend/src/components/domain/**/*Form*"
    - "frontend/src/components/domain/**/*form*"
    - "frontend/src/app/api/**/route.ts"
  bashPatterns:
    - "fk-audit"
priority: 95
---

# Form ↔ Database FK Validation Audit

> **Why this exists:** A mismatch between database FK targets and form dropdown sources
> causes dropdowns to show empty placeholders on edit — even though the data is saved correctly.
> This is invisible during record creation but breaks every edit flow. It cost an entire night
> of debugging. This skill prevents that from ever happening again.

---

## Inputs

| Parameter | Required | Example |
|-----------|----------|---------|
| Target | No | A form file, table name, or "all" to scan everything |

If no target is given, scan **all** forms with dropdowns in the codebase.

---

## Phase 1: Find All Forms with Dropdowns

### If target is a specific form file:
Read that file and proceed to Phase 2.

### If target is "all" or omitted:

Find every form component that contains select/dropdown/combobox fields:

```bash
grep -rl "Selector\|Combobox\|Select>\|<select\|SelectTrigger\|SelectValue" \
  frontend/src/components/domain/ \
  frontend/src/app/ \
  --include="*.tsx" --include="*.ts"
```

Also find form components by naming convention:

```bash
find frontend/src/components/domain -name "*Form*" -o -name "*form*" | grep -E "\\.tsx$"
find frontend/src/app -path "*/new/page.tsx" -o -path "*/edit/page.tsx"
```

For each form found, proceed through Phases 2-4.

---

## Phase 2: Trace Path A — Database FK Targets

For each dropdown/select field in the form, determine what column it writes to.

### Step 2a: Find the form's submit handler

Look for where the form data is sent:
- `fetch("/api/..."` or `supabase.from("...").insert/update/upsert`
- The API route it calls (usually in `frontend/src/app/api/`)

### Step 2b: Find the database table and column

Read the API route's POST/PATCH handler. Identify:
- **Table name**: the Supabase `.from("table_name")` call
- **Column name**: what column the dropdown's value maps to (e.g., `budget_code_id`, `vendor_id`, `commitment_id`)

### Step 2c: Find the FK target

Read `frontend/src/types/database.types.ts`. Search for the table, then find its `Relationships` array:

```
Search for: "Tables" → "{table_name}" → "Relationships"
```

For each relationship where `columns` includes the dropdown's column:
- Note the `referencedRelation` — this is the **FK target table**
- Note the `referencedColumns` — this is the **FK target column** (usually `id`)

**Record:**
```
Column: {column_name}
FK Target Table: {referencedRelation}
FK Target Column: {referencedColumns[0]}
```

---

## Phase 3: Trace Path B — Dropdown Option Sources

For each dropdown/select field, determine where it loads its options from.

### Step 3a: Find the dropdown component

In the form file, find the component rendering the dropdown:
- `<BudgetCodeSelector>`, `<VendorCombobox>`, `<ContractCombobox>`
- `<Select>`, `<Combobox>`, or custom selector components

### Step 3b: Find the options API

Read the dropdown component source. Look for:
- `fetch("/api/..."` or `useQuery` hook that fetches options
- The `value` prop — what field from the fetched data is used as the option value

### Step 3c: Find the source table

Read the API route that the dropdown fetches from. Identify:
- **Source table**: the Supabase `.from("table_name")` call
- **ID field**: what column is returned as the option's `id`/`value`

**Record:**
```
Dropdown Component: {component_name}
Options API: {api_route}
Source Table: {table_name}
ID Field: {column_name} (usually "id")
```

---

## Phase 4: Compare and Report

For each dropdown field, compare:

| | Path A (DB FK) | Path B (Dropdown) |
|---|---|---|
| **Table** | `{FK target table}` | `{Dropdown source table}` |
| **ID Column** | `{FK target column}` | `{Dropdown ID field}` |

### If tables match: PASS
The dropdown uses the same table the FK points to. No mismatch.

### If tables differ: MISMATCH FOUND

This is the bug. The dropdown will show the correct value on **create** (because the form sends whatever ID it has), but on **edit**, the API returns the FK table's ID, which the dropdown can't match against its own options (which use the source table's IDs).

**For each mismatch, report:**

```markdown
## MISMATCH: {form_name} → {field_name}

| | FK Target | Dropdown Source |
|---|---|---|
| Table | `{fk_table}` | `{dropdown_table}` |
| ID | `{fk_table}.id` | `{dropdown_table}.id` |

**Impact:** Edit form shows empty placeholder for {field_name} because
`{fk_table}.id` (stored in DB) will never match `{dropdown_table}.id` (in dropdown options).

**Fix required:**
- **Read path** (GET API): Map `{fk_table}.id` → `{dropdown_table}.id` before sending to client
- **Write path** (POST/PATCH API): Resolve `{dropdown_table}.id` → `{fk_table}.id` before INSERT/UPDATE

**Mapping strategy:** {describe how to map between the two tables — e.g., shared columns, name match, etc.}
```

---

## Phase 5: Check for Existing Resolutions

Before flagging a mismatch as unfixed, check if the API already handles it:

Search the GET API for mapping logic:
```bash
grep -n "Map\|map\|resolve\|projectBudgetCodeId\|formVendorId\|mapping" {api_route_file}
```

Search the POST/PATCH API for reverse resolution:
```bash
grep -n "resolve\|Resolve\|mapping\|matchingBudgetLine\|company_id" {api_route_file}
```

If resolution exists in both directions, mark the mismatch as **RESOLVED** with a note about where the mapping lives.

---

## Phase 6: Live Verification (if dev server is running)

For each form with dropdowns (whether mismatches were found or not):

1. Find an existing record that has values for the dropdown fields
2. Navigate to the edit form for that record
3. Check if all dropdowns show the correct pre-filled values

```bash
# Check if dev server is running
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

If running, use agent-browser to verify:
```bash
agent-browser open {edit_url}
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser screenshot /tmp/fk-audit-{form_name}.png
```

Read the screenshot. For each dropdown:
- Shows correct value → PASS
- Shows "Select..." or empty → FAIL (mismatch not resolved)

---

## Phase 7: Generate Audit Report

Save to `docs/reports/fk-audit-{date}.md`:

```markdown
# Form ↔ FK Audit Report

**Date:** {date}
**Scope:** {target or "full codebase"}

## Summary

| Status | Count |
|--------|-------|
| Forms audited | {N} |
| Dropdown fields checked | {N} |
| Mismatches found | {N} |
| Already resolved | {N} |
| **Needs fix** | **{N}** |

## Results by Form

### {FormName} ({file_path})

| Field | DB Column | FK Target | Dropdown Source | Status |
|-------|-----------|-----------|----------------|--------|
| {field} | `{column}` | `{fk_table}` | `{dropdown_table}` | MATCH / MISMATCH (resolved) / MISMATCH (NEEDS FIX) |

{For each NEEDS FIX: include the fix details from Phase 4}

## Known Resolved Mismatches

These mismatches exist but have ID resolution in place:

| Form | Field | FK Table | Dropdown Table | Resolution Location |
|------|-------|----------|---------------|-------------------|
| ChangeEventForm | Budget Code | budget_lines | project_cost_codes | GET/PATCH in change-events API |
| ChangeEventForm | Vendor | companies | vendors | GET/PATCH in change-events API |

## Recommended Actions

{Prioritized list of fixes needed}
```

---

## Quick Reference: Known Mismatches

These are documented mismatches in this codebase. They should already have resolution logic:

| Form Field | DB Column FK Target | Dropdown Source | Resolution |
|-----------|-------------------|----------------|------------|
| Budget Code | `budget_lines` | `project_cost_codes` | Map via `cost_code_id` + `cost_type_id` |
| Vendor | `companies` | `vendors` | Map via company name match |
| Commitment | `subcontracts` / `purchase_orders` | Combined list with `sub-`/`po-` prefixes | Prefix-based parsing |

Full reference: `docs/patterns/form-id-mismatch-prevention.md`
