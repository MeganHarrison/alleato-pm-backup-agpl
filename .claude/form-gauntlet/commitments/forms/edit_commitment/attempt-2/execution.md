# Edit Commitment Form — Execution Report

**Attempt:** 2
**Date:** 2026-03-22
**Executor:** Form Gauntlet Agent

---

## Commitment Used

- **ID:** `20ab813b-80bb-4c95-b679-c1e1ad30a7ee`
- **Original Title:** Test Subcontract SC-GAUNTLET-001
- **Original Contract #:** SC-GAUNTLET-001 (display-only in form)
- **Type:** Subcontract

---

## Navigation Path

1. Opened `http://localhost:3000/67/commitments`
2. Clicked row link "Test Subcontract SC-GAUNTLET-001" → navigated to detail page
3. Detail page URL: `http://localhost:3000/67/commitments/20ab813b-80bb-4c95-b679-c1e1ad30a7ee`
4. Clicked "Edit" button (ref e59 on detail page) → inline edit mode activated on same URL

---

## Edit Mode Observations

Edit mode opened inline on the same URL (no navigation). Form fields exposed:

| Field | Accessible in Snapshot? | Notes |
|-------|------------------------|-------|
| Contract # | NO (not in a11y tree) | Input exists in DOM (`name="contractNumber"`) but hidden from snapshot |
| Status | YES (combobox) | |
| Title | YES (textbox) | |
| Vendor | YES (combobox) | |
| Description | YES (textbox) | |
| Start Date | YES (button/datepicker) | |
| Completion Date | YES (button/datepicker) | |
| Contract Date | YES (button/datepicker) | |
| Signed Received | YES (button/datepicker) | |

---

## Test Data Entered

| Field | Value Set | Method |
|-------|-----------|--------|
| Contract # | `SC-GAUNTLET-001-EDITED` | JavaScript (React native input setter + change event dispatch) — required because field not in a11y tree |
| Title | `Test Subcontract SC-GAUNTLET-001 EDITED` | `agent-browser fill @e59` |
| Status | `Draft` (unchanged) | Left as-is |
| Description | `Updated by form gauntlet` | `agent-browser fill @e61` |

---

## Submit Method

Clicked "Save" button (`button[type="submit"]`) using:
1. First attempt: `agent-browser click @e66`
2. Second attempt (after refill): `agent-browser find role button click --name "Save"`

---

## Immediate Response

### Toast Message
**None visible.** No success or error toast was displayed to the user after clicking Save.

### Edit Mode Exited?
**No.** The form remained in edit mode after all Save attempts. Fields stayed editable.

### Page Title Updated?
**No.** Page header still shows "Test Subcontract SC-GAUNTLET-001" (original title).

### URL After Save
`http://localhost:3000/67/commitments/20ab813b-80bb-4c95-b679-c1e1ad30a7ee` (unchanged)

---

## API Response (Captured via fetch monitoring)

```
PUT /api/commitments/20ab813b-80bb-4c95-b679-c1e1ad30a7ee
Status: 400 Bad Request
Body: {"error":"Could not find a relationship between 'subcontracts' and 'companies' in the schema cache"}
```

**Root Cause:** The API route attempts a Supabase query that joins `subcontracts` with `companies`, but the relationship does not exist in the Supabase schema cache. This causes the PUT request to return 400, the save fails silently (no error toast shown to user), and the form stays in edit mode.

---

## Screenshot Paths

| Screenshot | Description |
|------------|-------------|
| `/tmp/form-gauntlet-edit_commitment-attempt2-01-list.png` | Commitments list page with SC-GAUNTLET-001 visible |
| `/tmp/form-gauntlet-edit_commitment-attempt2-02-detail.png` | Detail page (read-only view) |
| `/tmp/form-gauntlet-edit_commitment-attempt2-03-edit-mode.png` | Edit mode after clicking Edit button |
| `/tmp/form-gauntlet-edit_commitment-attempt2-before.png` | Form filled out, before clicking Save |
| `/tmp/form-gauntlet-edit_commitment-attempt2-with-contract.png` | Contract # field filled via JS |
| `/tmp/form-gauntlet-edit_commitment-attempt2-after.png` | After Save click — form still in edit mode, no toast |

---

## Errors

1. **Contract # field not accessible via keyboard/snapshot** — The `contractNumber` input (`name="contractNumber"`) is present in the DOM but not exposed in the accessibility tree. It could not be filled via `agent-browser fill` or semantic locators. Required JavaScript `HTMLInputElement.prototype.value` setter + `change` event dispatch.

2. **Silent 400 error on save** — API returns `400 {"error":"Could not find a relationship between 'subcontracts' and 'companies' in the schema cache"}` but the UI shows no error toast or message. User has no feedback that save failed. Form stays in edit mode permanently.

---

## Status

**SUBMISSION_FAILED**

### Failure Mode
- Form submitted (PUT request fired)
- Server returned 400 error
- No user-visible error feedback (silent failure)
- Edit mode not exited
- Data not saved

### Bug Classification
- **Backend Bug:** Supabase relationship error between `subcontracts` and `companies` tables in the API route handler
- **UX Bug:** Missing error toast/message when save fails — user has no feedback
- **Accessibility Bug:** Contract # input not exposed in accessibility tree
