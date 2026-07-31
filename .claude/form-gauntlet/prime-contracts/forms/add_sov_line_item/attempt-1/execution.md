# Form Execution Report: Add SOV Line Item

## Status: SUBMISSION_FAILED

## Test Info
- **Contract ID:** 20c40a53-f2d7-4b22-a257-cc1b3a80efaa
- **Contract URL:** http://localhost:3000/67/prime-contracts/20c40a53-f2d7-4b22-a257-cc1b3a80efaa
- **Executed:** 2026-03-22
- **Auth:** test1@mail.com

## Test Data Used

| Field | Value Attempted |
|-------|----------------|
| line_number | 1 |
| description | "Gauntlet SOV Line Test" |
| quantity | 2 |
| unit_of_measure | "SF" |
| unit_cost | 1000.00 |

## Submit Method

**No form submission possible — UI form cannot be opened.**

## What Was Found

### Existing Data
When the page was loaded, there was already a row in the SOV table:
- "Gauntlet SOV Line Test", qty 2, UOM SF, unit cost $1,000.00, total $2,000.00

This was created via direct API in a previous test run.

### Modal Dialog (Broken — Never Triggered)
The code has a complete `PrimeContractDialogs` component with an "Add Schedule of Values Line" modal dialog at `/frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/components/PrimeContractDialogs.tsx`. This modal includes:
- Budget Code selector
- Line Number input
- Description textarea
- Quantity input
- Unit Cost input
- Unit of Measure input
- "Add SOV Line" submit button

**The modal dialog is controlled by `showAddLineItemDialog` state in `page.tsx`. This state is initialized to `false` and is never set to `true`.** `setShowAddLineItemDialog(true)` does not appear anywhere in the codebase.

### Inline Editing (Also Broken)
The "Add" dropdown button in the SOV table header offers:
- "Line Item" — calls `handleAddSovLine()` which adds to `sovDraftItems` state
- "Group"

However, `handleAddSovLine()` does NOT set `isSovEditing` to `true`. The SOV table only displays `sovDraftItems` when `isSovEditing === true`. Without activating edit mode, the new draft item is silently discarded and never appears in the UI.

## Immediate Response
After clicking "Add" → "Line Item":
- No modal dialog appeared
- No inline editing row appeared
- No error message displayed
- No toast notification
- The page remained in read-only view mode

## Screenshot Paths
- **Before:** `/Users/meganharrison/Documents/alleato-pm/.claude/form-gauntlet/prime-contracts/forms/add_sov_line_item/attempt-1/before.png`
- **After:** `/Users/meganharrison/Documents/alleato-pm/.claude/form-gauntlet/prime-contracts/forms/add_sov_line_item/attempt-1/after.png`

## Errors Found

### Bug 1: Modal Dialog Never Triggered
- **File:** `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx`
- **State:** `showAddLineItemDialog` (line 138) — initialized to `false`
- **Problem:** `setShowAddLineItemDialog(true)` is never called. The dialog exists but has no trigger.
- **Impact:** The "Add Schedule of Values Line" modal is completely inaccessible

### Bug 2: Inline Edit Mode Not Activated on "Add Line Item"
- **File:** `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx`
- **Function:** `handleAddSovLine()` (line 1003)
- **Problem:** `handleAddSovLine()` adds to `sovDraftItems` but does NOT call `setIsSovEditing(true)`. Since `isSovEditing` stays `false`, the new draft item is never displayed in the SOV table.
- **Impact:** Clicking "Add > Line Item" silently does nothing visible to the user

## Data Verification
The contract API confirms the existing SOV line item:
```
GET /api/projects/67/contracts/20c40a53-f2d7-4b22-a257-cc1b3a80efaa/line-items
Response: [{"id":"2012aec8...","description":"Gauntlet SOV Line Test","quantity":2,"unit_of_measure":"SF","unit_cost":1000,"total_cost":2000}]
```

## Console Errors
None — the bugs are silent failures, not error conditions.

## Network Errors
None — no API calls were made for the add operation (the form could not be opened).
