# Fix: submittals.responsible_contractor_id save/pre-fill bug

**Date:** 2026-06-14
**Status:** Applied (migration live, code fixed, types regenerated)

---

## Trace Result

### What id space does the form use?

Both `submittal-form-page.tsx` and `submittal-form-dialog.tsx` call `useProjectCompanies`
which queries `/api/projects/[projectId]/directory/companies` → `companyService.getCompanies`
→ `SELECT * FROM project_companies JOIN companies`. The returned `ProjectCompany.id` is the
`project_companies` **junction table UUID** — not `companies.id`.

However both forms used `c.id` (junction UUID) as the combobox option value. The correct id
to store as `responsible_contractor_id` is `companies.id` (the canonical company UUID), not
the junction row id.

### What is the FK target?

`submittals.responsible_contractor_id` has **no FK constraint** in the database (confirmed
via the Relationships array in `database.types.ts` — no entry for this column). The column
was an INTEGER type. The GET/LIST routes did a manual secondary lookup against `companies.id`.

### Root cause (two-layer bug)

1. **DB column type wrong**: `responsible_contractor_id` was `integer` but should be `uuid`.
   This is why `z.coerce.number()` in the API routes converted UUID strings to NaN — any
   UUID value sent by the form was silently dropped (NaN → undefined → field excluded from
   Supabase update).

2. **Form option value wrong**: Both forms used `c.id` (the `project_companies` junction
   UUID) as the combobox option value. The column stores a reference to `companies.id`
   (resolved by the GET routes). These are different UUIDs — so even if the coercion bug
   were fixed, the stored value would not match the option list on Edit.

---

## Fixes Applied

### 1. DB migration — `/supabase/migrations/20260614033301_fix_submittals_responsible_contractor_id_type.sql`
```sql
ALTER TABLE submittals
  ALTER COLUMN responsible_contractor_id TYPE uuid USING NULL;
```
Applied live via psql. Confirmed column is now `uuid`.

### 2. API schema — both write routes changed from:
```ts
responsible_contractor_id: z.coerce.number().int().nullable().optional()
```
to:
```ts
responsible_contractor_id: z.string().uuid().nullable().optional()
```
Files: `route.ts` (PATCH/PUT) and `route.ts` (POST) under `submittals/`.

### 3. GET route — removed `String()` coercion on lookup (cleanup only, no semantic change):
`companies.eq("id", data.responsible_contractor_id)` — UUID now passes through cleanly.

### 4. LIST route — removed `String()` coercions in batch-resolve; added type guard for the
filter so TypeScript is satisfied without casts.

### 5. Form combobox option values — both forms changed from `c.id` to `c.company_id`:
- `submittal-form-page.tsx`: `companyOptions` now maps `c.company_id` as option value
- `submittal-form-dialog.tsx`: `<SelectItem value={c.company_id}>` (was `c.id`)

Both filter `c.company_id` truthy to guard against any orphan junction rows.

### 6. DB types regenerated — `responsible_contractor_id` now typed as `string | null`.

### 7. Smoke test guardrail added — `scripts/api-smoke-contracts.mjs` now includes:
- `PUT .../submittals/[id]` unauthorized → must return 401 (not 500)
- `POST .../submittals` unauthorized → must return 401 (not 500)

These catch any future schema regression where the create/update handler throws before auth.

---

## Read path verification

- **Detail view** (`submittal-detail-client.tsx`): renders `submittal.responsible_contractor?.name`
  — resolved by the GET route secondary lookup. Works correctly once the column stores the
  right UUID.
- **Edit pre-fill** (`submittal-form-page.tsx` `buildDefaults`): uses
  `submittal?.responsible_contractor_id` from `SubmittalDetail`. After the fix, this is a
  `companies.id` UUID which matches the new combobox option values. Pre-fill will work.

---

## Prevention

- **Guardrail added**: smoke test entries for POST/PUT submittals routes catch handler-level
  500s before they reach production.
- **Gate reference**: `.claude/rules/FORM-FK-VALIDATION-GATE.md` — this bug is the canonical
  case of a dropdown source table mismatch. The gate's "Always test: Load → Edit → verify ALL
  dropdowns pre-fill" step directly detects this class of failure.
