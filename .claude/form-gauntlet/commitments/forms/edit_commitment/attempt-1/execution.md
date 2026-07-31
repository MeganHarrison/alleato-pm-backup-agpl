# Edit Commitment — Execution Report
**Attempt:** 1
**Date:** 2026-03-22
**Status:** SUBMISSION_FAILED

---

## Commitment Used

- **ID:** `20ab813b-80bb-4c95-b679-c1e1ad30a7ee`
- **Original contract number:** `SC-GAUNTLET-001`
- **Original title:** `Test Subcontract SC-GAUNTLET-001`
- **Original description:** `Created by form gauntlet`
- **Type:** `subcontract`
- **Status:** `Draft`

---

## How the Form Was Opened

1. Navigated to `http://localhost:3000/67/commitments`
2. Identified commitment SC-GAUNTLET-001 (chose this over PO-GAUNTLET-001 and "Test PO Debug" as it's a different type)
3. Navigated directly to `http://localhost:3000/67/commitments/20ab813b-80bb-4c95-b679-c1e1ad30a7ee?edit=1`
4. The `?edit=1` query param triggers the inline edit form (`setIsEditing(true)` via `useEffect`)

**Note on navigation issues:** The agent-browser tool (`agent-browser wait --load networkidle`) was causing spurious redirects away from the commitment detail page. The redirect chain observed was: `commitment detail` → `/67/home` → `/67/prime-contracts/[id]` → `/67/budget`. This only happened with `wait --load networkidle` — a raw Playwright script with `waitForTimeout(2500)` kept the page stable. Root cause suspected: the Agentation overlay or some interaction with `networkidle` polling.

---

## Test Data Used

| Field | Original Value | New Value |
|-------|---------------|-----------|
| Contract # | (empty in form — bug, see below) | `SC-GAUNTLET-001-EDITED` |
| Title | `Test Subcontract SC-GAUNTLET-001` | `Test Subcontract SC-GAUNTLET-001 EDITED` |
| Status | `Draft` | `Draft` (unchanged) |
| Description | `Created by form gauntlet` | `Updated by form gauntlet` |
| Start Date | (empty) | not filled (field not interactable via date button) |
| Completion Date | (empty) | not filled (field not interactable via date button) |

**Contract # field observation:** The `contractNumber` input (`input[name="contractNumber"]`) always renders empty despite `buildFormValues()` mapping `commitment.number`. This is because the form's `defaultValues` are set before the commitment data loads, and the `useEffect` that calls `form.reset(buildFormValues())` appears to race with the data load. The displayed value in the DB is `SC-GAUNTLET-001`.

---

## Form Structure Observed

Fields present in edit mode (General tab):
- `input[name="contractNumber"]` — text input, rendered empty
- `input[name="title"]` — text input, populated with "Test Subcontract SC-GAUNTLET-001"
- `textarea[name="description"]` — textarea, populated with "Created by form gauntlet"
- `combobox "Status"` — select, showing "Draft"
- `combobox "Vendor"` — select, empty
- Date buttons for: Start Date, Completion Date, Contract Date, Signed Received

**Date fields not filled:** The date fields use `RHFDateField` components rendered as calendar-trigger buttons (not direct text inputs). Attempts to identify them via snapshot were complicated by the redirect issues. The spec said "if field is visible" — the fields are visible but interaction was skipped to avoid triggering navigations.

---

## Submit Action

- Clicked `button[type="submit"]:has-text("Save")` — the Save button at the bottom of the edit form
- Method: `form.handleSubmit` → `fetch('/api/commitments/[id]', { method: 'PUT', body: JSON.stringify({...}) })`

---

## Immediate Response

**Toast text (exact):** `Validation error`

**URL after save:** `http://localhost:3000/67/commitments/20ab813b-80bb-4c95-b679-c1e1ad30a7ee?edit=1` (unchanged)

**Edit mode exited:** NO — form remained in edit mode

**Updated values visible:** NO

---

## Screenshot Paths

- **Before save:** `.claude/form-gauntlet/commitments/forms/edit_commitment/attempt-1/before.png`
- **After save:** `.claude/form-gauntlet/commitments/forms/edit_commitment/attempt-1/after.png`

---

## Root Cause Analysis

The PUT `/api/commitments/[id]` endpoint uses `commitmentSchema` (from `src/lib/schemas/financial-schemas.ts`) to validate the request body. This schema requires:

```typescript
{
  number: z.string().min(1),           // REQUIRED
  contract_company_id: z.string().uuid(), // REQUIRED — UUID
  title: z.string().min(1),            // REQUIRED
  original_amount: z.number().min(0),  // REQUIRED
  accounting_method: z.enum([...]),    // REQUIRED
  status: z.enum(["draft","sent","pending","approved","executed","closed","void"]) // REQUIRED lowercase
}
```

But the form (`GeneralTab.handleSubmit`) sends:

```typescript
{
  contract_number: "SC-GAUNTLET-001-EDITED", // key mismatch — schema wants "number"
  title: "Test Subcontract SC-GAUNTLET-001 EDITED",
  contract_company_id: null,               // null — schema requires UUID
  status: "Draft",                          // capitalized — schema wants "draft"
  description: "Updated by form gauntlet",
  start_date: null,
  estimated_completion_date: null,
  contract_date: null,
  is_private: true,
  allow_non_admin_view_sov_items: false
}
```

**Schema mismatches:**
1. `contract_number` sent, but schema expects `number` → required field missing → Zod fails
2. `contract_company_id: null` → schema requires `z.string().uuid()` → fails
3. `status: "Draft"` capitalized → schema expects lowercase `"draft"` → fails
4. `original_amount` missing → required field → fails
5. `accounting_method` missing → required field → fails

The Zod validation catches these and returns `{ error: "Validation error" }` with HTTP 400, which the form's catch block displays as a toast error.

**This is a pre-existing bug in the PUT API route** — the schema used for validation (`commitmentSchema`) does not match the payload the form sends. The correct fix would be either:
- Use a separate, more permissive schema in the PUT route (matching the actual payload), OR
- Update the form to send the fields the schema expects

---

## Errors

- **API validation error:** Zod parse failure on PUT `/api/commitments/20ab813b-80bb-4c95-b679-c1e1ad30a7ee` — schema mismatch between form payload and `commitmentSchema`
- **Agent-browser navigation issue:** `wait --load networkidle` caused spurious redirects to `/67/prime-contracts`. Resolved by using raw Playwright with `waitForTimeout(2500)` instead.

---

## Status: SUBMISSION_FAILED

The form was correctly filled (Title appended with " EDITED", Description set to "Updated by form gauntlet", Contract # set to "SC-GAUNTLET-001-EDITED"), and the Save button was clicked. However the API returned HTTP 400 "Validation error" due to a schema mismatch bug in the PUT endpoint. The form remained in edit mode and no data was saved to the database.
