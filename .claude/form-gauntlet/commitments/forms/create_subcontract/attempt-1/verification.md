## Verification Report: Create Subcontract
**Verdict: FAIL**

### Criterion-by-Criterion

| Criterion | Result | Evidence |
|-----------|--------|----------|
| After submission, user is redirected to /760/commitments | MET | Record found at detail URL `http://localhost:3000/760/commitments/2bc312b4-c299-4fb4-bd41-f7d9ac808d0f`, and record appears in list at `/760/commitments` |
| Toast success message appears (or record exists proving success) | MET | Record exists in the commitments table — the subcontract was persisted to the database |
| New subcontract appears in commitments list | MET | Row visible in Subcontracts tab: `SC-FG-001 | Test Subcontract - Electrical FG | subcontract | draft` |
| Commitment has correct title | MET | Title "Test Subcontract - Electrical FG" confirmed on both list and detail page |
| Commitment has correct status | MET | Status "Draft" confirmed on detail page |
| Commitment has correct vendor | NOT MET | Detail page shows Subcontractor field as "—" (empty). "A Brannan Builders LLC" was NOT saved. Text search for "Brannan" returned zero matches on the detail page. |
| Commitment has correct contract number | PARTIAL | Contract number "SC-FG-001" appears in the list table's Number column, but the detail page "Contract #" field shows "—" (empty). This suggests the number was stored in a different field than what the detail view reads. |
| Default retainage saved correctly | NOT MET | No retainage value visible on the detail page. Text search for "Retainage" and "10" (as a field value) returned no matches in the detail page content. |

### What I Found

The subcontract record **was successfully created** and appears in the commitments list at `/760/commitments` under the Subcontracts tab. The list view shows the correct number (SC-FG-001), title, type (subcontract), and status (draft).

However, when clicking into the detail page, several fields are missing or empty:

1. **Subcontractor (vendor):** Shows "—" instead of "A Brannan Builders LLC". The vendor was either not saved during form submission or the detail page is not reading the correct field.
2. **Contract #:** Shows "—" on the detail page, despite "SC-FG-001" appearing in the list view's Number column. This indicates a field mapping discrepancy between the list view and detail view.
3. **Default Retainage:** Not displayed anywhere on the detail page. Either the field was not saved, or the detail page does not render it.
4. **Description:** "Form gauntlet test subcontract" IS correctly displayed.
5. **Status:** "Draft" IS correctly displayed.
6. **Visibility:** Shows "Private" (not part of test criteria but noted).

### Issues Found

1. **Vendor not persisted:** The form's vendor/subcontractor selection did not save to the commitment record. The detail page Subcontractor field is blank.
2. **Contract number field mapping mismatch:** The number "SC-FG-001" is stored (visible in list) but the detail page's "Contract #" field reads from a different column or is not populated.
3. **Retainage not saved or not displayed:** The 10% default retainage value is absent from the detail page entirely.

### Evidence Screenshots

- `/tmp/verify-create_subcontract-evidence-1.png`: Commitments list page showing the Subcontracts tab with "SC-FG-001 | Test Subcontract - Electrical FG" row visible with status "draft"
- `/tmp/verify-create_subcontract-evidence-2.png`: Detail page for the subcontract showing title, status (Draft), description, but missing Subcontractor ("—"), Contract # ("—"), and no retainage field
