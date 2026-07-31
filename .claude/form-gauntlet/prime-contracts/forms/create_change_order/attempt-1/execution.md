# Form Gauntlet: Create Change Order — Execution Report

**Date:** 2026-03-22
**Contract:** Gauntlet Test Contract - #PC-GAUNTLET-001
**Contract ID:** 20c40a53-f2d7-4b22-a257-cc1b3a80efaa
**Contract URL:** http://localhost:3000/67/prime-contracts/20c40a53-f2d7-4b22-a257-cc1b3a80efaa

---

## Status: SUBMITTED_SUCCESSFULLY (after bug fix)

---

## Test Data Used

| Field | Value Submitted |
|-------|----------------|
| CO Number | CO-GAUNTLET-001 |
| Description | Gauntlet change order test |
| Amount | 5000 |
| Status | pending (form showed "Pending") |

---

## Steps Executed

1. Navigated to contract detail page via JavaScript (`window.location.reload()` after `history.pushState`)
2. Unlocked agentation overlay (unchecked "Block page interactions" checkbox that was blocking all clicks)
3. Navigated from prime contracts list → clicked "Gauntlet Test Contract" row
4. Clicked "Change Orders" tab on contract detail page
5. Clicked "+ New Change Order" button — modal opened
6. Attempted form submission → **FAILED** (status 400, DB constraint violation)
7. Fixed bug (see below)
8. Re-opened modal, filled form, submitted — **SUCCESS**

---

## Bug Found and Fixed

### Root Cause
The form had `"draft"` as the default/only status option, but the `contract_change_orders` database table has a check constraint (`valid_approval_date`) that only allows `'pending'`, `'approved'`, or `'rejected'` — not `'draft'`.

### Error from API (first attempt)
```json
{
  "error": "Failed to create change order",
  "details": "new row for relation \"contract_change_orders\" violates check constraint \"valid_approval_date\""
}
```

### Files Fixed

1. **`frontend/src/app/api/projects/[projectId]/contracts/[contractId]/change-orders/validation.ts`**
   - Removed `"draft"` from `status` enum in `createChangeOrderSchema` and `updateChangeOrderSchema`
   - Changed default from `"draft"` to `"pending"`

2. **`frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/components/PrimeContractDialogs.tsx`**
   - Removed `<option value="draft">Draft</option>` from status select
   - Status select now only shows "Pending" option
   - Updated `onChange` type from `"draft" | "pending"` to `"pending"`

3. **`frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx`**
   - Changed initial `coForm.status` from `"draft" as "draft" | "pending"` to `"pending" as "pending"`

4. **`frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/types.ts`**
   - Updated `ChangeOrderFormState.status` type from `"draft" | "pending"` to `"pending"`

---

## Submit Method

- Button text: "Create Change Order"
- Submitted via click on modal's submit button
- API endpoint: `POST /api/projects/67/contracts/20c40a53-f2d7-4b22-a257-cc1b3a80efaa/change-orders`

---

## Modal Behavior

- Modal opened correctly from "+ New Change Order" button on Change Orders tab
- Form fields: CO Number (text), Description (textarea), Amount (number), Status (select)
- After fix: Status dropdown defaulted to "Pending" (only option)
- Modal closed after successful submission
- Change order appeared immediately in the table on the Change Orders tab

---

## API Response (successful)

- Status: 201 Created
- The change order `bc918031-7a72-4976-b888-f53bce7b0863` was created

## Secondary Error (non-blocking)

A PDF generation call was made automatically after creation:
```
POST /api/document-center/prime-contract-change-order/bc918031-7a72-4976-b888-f53bce7b0863/pdf
→ 500: "Parent prime contract not found"
```
This is a separate bug in the PDF generation endpoint (not the form creation itself). The change order was successfully created despite this secondary failure.

---

## Toast Text

- First attempt: "Failed to create change order" (red/error toast, bottom right)
- After fix + successful submit: Toast was not captured (disappeared before screenshot). The change order row appeared in the table confirming success.

---

## Screenshots

| Screenshot | Path |
|-----------|------|
| Form filled (before submit, after fix) | `/tmp/form-gauntlet-create_change_order-before.png` |
| After submission (CO visible in table) | `/tmp/form-gauntlet-create_change_order-after.png` |

---

## Result in UI

Change order visible in table after submission:

| CO Number | Description | Amount | Status | Requested |
|-----------|-------------|--------|--------|-----------|
| CO-GAUNTLET-001 | Gauntlet change order test | $5,000.00 | Pending | 3/22/2026 |
