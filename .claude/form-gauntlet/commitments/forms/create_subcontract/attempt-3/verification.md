## Combined Execution + Verification Report
**Submission Status:** SUBMITTED_SUCCESSFULLY
**Verification Verdict:** FAIL

### Test Data
| Field | Value |
|-------|-------|
| Title | Test Subcontract - Plumbing FG4 |
| Contract # | SC-FG-004 |
| Vendor | 3 Quarterdeck LLC |
| Status | Draft |
| Default Retainage | 10 |
| Description | Form gauntlet test attempt 4 |

### Submission Result
Clicked "Create Subcontract" on the filled form. The app redirected to the commitments list page (`/760/commitments`) where the new record appeared in the table as the third row with contract number "SC-FG-004", title "Test Subcontract - Plumbing FG4", type "subcontract", and status "draft". No errors were displayed. Submission was successful.

### Criterion-by-Criterion Verification
| Criterion | Result | Evidence |
|-----------|--------|----------|
| Title = "Test Subcontract - Plumbing FG4" | PASS | Detail page shows "Test Subcontract - Plumbing FG4" under Title field |
| Contract # = "SC-FG-004" | PASS | Detail page shows "SC-FG-004" under Contract # field (not "---") |
| Subcontractor/Vendor = "3 Quarterdeck LLC" | FAIL | Detail page shows "---" (em dash) under Subcontractor field. The vendor was selected on the form and the Invoice Contacts section updated to confirm selection, but the vendor_id was not persisted to the database. |
| Status = "Draft" | PASS | Detail page shows "Draft" under Status field |
| Default Retainage = 10% | PASS | Detail page shows "10%" under Default Retainage % field |
| Description = "Form gauntlet test attempt 4" | PASS | Detail page shows "Form gauntlet test attempt 4" under Description field |

### Issues Found

**CRITICAL: Vendor/Subcontractor not saved (FAIL)**

The vendor "3 Quarterdeck LLC" was successfully selected in the form -- the combobox showed the value and the Invoice Contacts section dynamically updated to show a contact selector (confirming the vendor was registered in the form state). However, on the detail page after creation, the Subcontractor field displays "---" instead of "3 Quarterdeck LLC".

This indicates that the `vendor_id` field is either:
1. Not being included in the POST payload sent to the API when creating the subcontract, or
2. Not being mapped correctly from the form state to the API request body, or
3. Not being saved in the database despite being sent in the request.

This is the same vendor persistence bug observed in previous form gauntlet attempts. The form UI correctly captures the vendor selection but the value is lost during submission.

**Root cause investigation recommendation:** Check the `CreateSubcontractForm` component's submit handler to verify that `vendor_id` is included in the form data sent to the API. Also check the API route handler at `/api/projects/[projectId]/commitments` to verify it processes the `vendor_id` field.

### Screenshot Paths
| Screenshot | Path |
|------------|------|
| Before submission (form filled) | `/tmp/fg-attempt4-before.png` |
| After submission (commitments list) | `/tmp/fg-attempt4-after.png` |
| Commitments list with new record | `/tmp/fg-attempt4-list.png` |
| Detail page verification | `/tmp/fg-attempt4-detail.png` |
| Vendor dropdown (debug) | `/tmp/fg-attempt4-vendor-dropdown.png` |
