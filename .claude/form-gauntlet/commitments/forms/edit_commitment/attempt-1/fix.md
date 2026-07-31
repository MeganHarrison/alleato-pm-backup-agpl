# Fix Report: Commitment Detail Edit Form — PUT Handler Schema Mismatch

## Root Cause

The PUT handler at `/api/commitments/[id]/route.ts` validated the request body
against `commitmentSchema` from `financial-schemas.ts`. That schema was designed
for the commitment *creation* flow and required fields (`number`, `original_amount`,
`accounting_method`) and formats (`status` as lowercase enum, `contract_company_id`
as valid UUID) that the detail edit form never sends. The mismatch caused every PUT
request from the edit form to fail Zod validation with a 400 error before the
database was ever touched.

Specific mismatches:
- Form sends `contract_number`; schema required `number`
- Form sends `contract_company_id` as nullable string; schema required a valid UUID (no null)
- Form sends `status` as Title Case ("Draft", "Out for Signature"); schema required lowercase enum
- Form does not send `original_amount` or `accounting_method`; schema required both
- Form sends `accounting_method` as `"amount_based"` / `"unit_quantity"` / null; schema enum was `"amount" | "unit" | "percent"`

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/commitments/[id]/route.ts`

## What the Fix Does

1. Removed the import of `commitmentSchema` from `financial-schemas.ts` (it is no
   longer needed in this file).

2. Added a new `commitmentEditSchema` inline in the route file that exactly matches
   the form's actual payload:
   - `contract_number` — optional string
   - `title` — optional string
   - `contract_company_id` — optional nullable string (no UUID constraint)
   - `status` — optional string (any casing, passed through as-is)
   - `description`, `start_date`, `estimated_completion_date`, `contract_date`,
     `delivery_date` — optional nullable strings
   - `is_private`, `allow_non_admin_view_sov_items` — optional booleans
   - `accounting_method` — optional nullable string
   - `.passthrough()` to allow any additional fields without failing validation

3. Replaced `commitmentSchema.parse(body)` (throws on failure) with
   `commitmentEditSchema.safeParse(body)` (returns a result object), returning a
   400 response on failure without throwing.

4. Replaced the unsafe `...validatedData` spread into the Supabase update with an
   explicit `updatePayload` object that only sets fields that are defined
   (`!== undefined`) and only includes columns that exist in the target table:
   - Common columns (both tables): `contract_number`, `title`,
     `contract_company_id`, `status`, `description`, `is_private`,
     `allow_non_admin_view_sov_items`, `contract_date`
   - Subcontract-only: `start_date`, `estimated_completion_date`
   - Purchase-order-only: `delivery_date`, `accounting_method`

   This prevents accidentally writing unknown keys to the database and avoids
   overwriting existing data with `undefined`-sourced nulls.

## TypeScript Check Result

```
npx tsc --noEmit 2>&1 | grep "commitments/\[id\]"
(no output — zero errors in the changed file)
```

Pre-existing TypeScript errors in unrelated files (`crawled_pages`, `site-map`,
`support-articles`, `project-home-client`) are not introduced or affected by this
change.

## Prevention Recommendation

The `commitmentSchema` in `financial-schemas.ts` should be renamed to
`commitmentCreateSchema` or similar to make it clear it is only valid for the
creation flow. Update-oriented schemas should be derived from it using `.partial()`
and extended to relax constraints like UUID requirements on nullable FKs.
