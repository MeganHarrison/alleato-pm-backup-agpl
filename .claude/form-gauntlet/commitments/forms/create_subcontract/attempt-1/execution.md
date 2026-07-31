# Form Gauntlet Execution Report: Create Subcontract

**Date:** 2026-03-22
**URL:** http://localhost:3000/760/commitments/new?type=subcontract
**Auth:** test1@mail.com / test12026!!!
**Status:** SUBMITTED_SUCCESSFULLY

---

## Test Data Used

| Field | Selector | Value Entered |
|-------|----------|---------------|
| Title | `#title` (text input) | `Test Subcontract - Electrical FG` |
| Contract # | `#contractNumber` (text input) | `SC-FG-001` |
| Vendor | `#contractCompanyId` (combobox button) | `A Brannan Builders LLC` (first available vendor from 395 options) |
| Status | Select (default) | `Draft` (left as default) |
| Default Retainage | `#defaultRetainagePercent` (number input) | `10` |
| Description | `#description` (textarea) | `Form gauntlet test subcontract` |
| Executed | checkbox | Not checked (left as default) |

**Skipped fields (as specified):** dates, privacy, SOV line items, attachments, inclusions/exclusions, invoice contacts.

---

## Submit Method

Clicked the **"Create Subcontract"** button (purple button at bottom-right of form) via `page.getByRole('button', { name: 'Create Subcontract' })`.

---

## Immediate Response

- **Toast notification:** No Sonner toast was detected. The page redirected directly to the commitments list.
- **URL change:** Changed from `/760/commitments/new?type=subcontract` to `/760/commitments` (commitments list page).
- **Dialog behavior:** No dialog appeared. Form submitted and redirected seamlessly.
- **New record visible:** The commitments list now shows 2 rows:
  1. `SC-7487-0001` | Fire Alarm | subcontract | approved | $306,000.00
  2. `SC-FG-001` | Test Subcontract - Electrical FG | subcontract | draft | $0.00

---

## Screenshot Paths

| Screenshot | Path |
|-----------|------|
| Initial page load | `/tmp/form-gauntlet-create_subcontract-initial.png` |
| Form loaded after login | `/tmp/form-gauntlet-create_subcontract-loaded.png` |
| Vendor dropdown open | `/tmp/form-gauntlet-vendor-dropdown.png` |
| Before submit (full page) | `/tmp/form-gauntlet-create_subcontract-before.png` |
| After submit (full page) | `/tmp/form-gauntlet-create_subcontract-after.png` |

---

## Errors Encountered

- **Validation errors:** None. The form submitted without any validation issues.
- **Console errors:** None observed.
- **API errors:** None observed.

---

## Observations

1. **Vendor combobox:** Uses a command palette pattern (cmdk). Clicking the combobox opens a popover with a search input and 395 vendor options. Typing filters the list. Selecting an option closes the popover and displays the vendor name.
2. **Contract # field:** Accepts manual entry. The spec mentioned auto-generation, but the field was empty by default and accepted the manually entered value `SC-FG-001` without issue.
3. **Retainage field:** Number input with placeholder `0.00`. Accepted `10` without issue.
4. **No toast on success:** The form redirected to the commitments list without showing a toast/notification. The successful creation is confirmed by the new row in the commitments table.
5. **SOV line items:** A default empty line item row was present but not filled (as specified to skip). This did not block submission.
6. **Form layout:** Full-page form with sections: General Information, Attachments, Schedule of Values, Inclusions & Exclusions, Contract Dates, Contract Privacy, Invoice Contacts.
7. **Login required:** Initial navigation redirected to login page. After authentication, the form loaded correctly.
