# Create Subcontract Form — Fix Report (Attempt 1)

## Issue 1: Vendor Not Persisted (shows "—" on detail page)

### Root Cause
The form fetches vendors from `/api/projects/[projectId]/vendors`, which returns rows from the `vendors` table. Each vendor option is:
```
{ value: vendor.id, label: vendor.vendor_name, companyId: vendor.company_id }
```
The form's `contractCompanyId` field was being set to `option.value` — the **vendor's own UUID**, not the company UUID.

The `subcontracts.contract_company_id` column is a FK to the `companies` table. The GET detail API then looks up the company name via:
```sql
SELECT id, name, type FROM companies WHERE id = contract_company_id
```
Since a vendor UUID was stored there instead of a company UUID, the lookup returned nothing, so `contract_company` was `null` and the detail page showed "—".

### Fix
In `CreateSubcontractForm.tsx`, changed the `onSelect` handler to store `option.companyId` (the company FK) instead of `option.value` (the vendor ID). Falls back to `option.value` only if a vendor has no linked company.

Also updated the `selectedVendor` memo to match on either `companyId === contractCompanyId` or `value === contractCompanyId` so the display label and invoice-contact lookup remain correct for both new and pre-existing stored values.

### Files Changed
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/domain/contracts/CreateSubcontractForm.tsx`
  - `onSelect` handler: stores `option.companyId || option.value` instead of `option.value`
  - `selectedVendor` memo: matches on `companyId` first, then `value`

---

## Issue 2: Contract Number Shows "—" on Detail Page

### Root Cause
The GET `/api/commitments/[id]` endpoint spreads the raw DB row into `responseData`. The subcontracts table column is named `contract_number`. However, the `normalizeCommitment` function in the detail page read `record.number` (line 174), not `record.contract_number`.

The `commitments_unified` view may expose the field as `number`, but the raw `subcontracts` table row spread into `responseData` uses `contract_number`. So `record.number` was `undefined`, causing the normalizer to return `""`, and the `safeNumber` guard treated an empty string as falsy, rendering "—".

### Fix
In the detail page `normalizeCommitment` function, updated the mapping to prefer `record.contract_number` and fall back to `record.number` for any legacy data path:
```ts
number: typeof record.contract_number === "string" ? record.contract_number : (typeof record.number === "string" ? record.number : ""),
```

### Files Changed
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx`
  - Line 174: `normalizeCommitment` — `number` field now reads `record.contract_number`

---

## Issue 3: Retainage Not Displayed on Detail Page

### Root Cause
The GET `/api/commitments/[id]` endpoint spreads the raw `subcontracts` DB row which contains the column `default_retainage_percent`. However, `normalizeCommitment` read `record.retention_percentage` (line 197) — a field name that does not exist in the `subcontracts` schema (it belongs to the `Commitment` TypeScript type but is not the DB column name). The result was always `Number(undefined ?? 0) = 0`, and the display condition `retention_percentage !== 0` was never true.

### Fix
Updated the normalizer to read `record.default_retainage_percent` first, falling back to `record.retention_percentage` for any legacy usage:
```ts
retention_percentage: Number(record.default_retainage_percent ?? record.retention_percentage ?? 0),
```

### Files Changed
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx`
  - Line 197: `normalizeCommitment` — `retention_percentage` now reads `record.default_retainage_percent`

---

## TypeScript Verification

```
cd frontend && npx tsc --noEmit 2>&1 | grep -E "(commitment|subcontract|CreateSubcontract)"
# No output — no errors in affected files
```

---

## Summary

All three issues were field-name mismatches between the database column names and what the frontend code referenced:

| Issue | DB Column | Was Reading | Fixed To |
|-------|-----------|-------------|----------|
| Vendor | `companies.id` via FK | `vendors.id` (wrong table) | `vendors.company_id` |
| Contract # | `contract_number` | `number` | `contract_number` |
| Retainage | `default_retainage_percent` | `retention_percentage` | `default_retainage_percent` |

No database migrations required.
