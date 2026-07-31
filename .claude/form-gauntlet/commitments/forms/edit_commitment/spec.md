# Form Spec: Edit Commitment (Inline)

**form_id:** edit_commitment
**Title:** Edit Commitment (Inline Detail Edit)
**URL Path:** /67/commitments/[commitmentId] with ?edit=1 query param
**How to Open:**
1. First navigate to /67/commitments to find an existing commitment
2. Click on a commitment to go to its detail page
3. Click the "Edit" button to enter edit mode (or add ?edit=1 to the URL)

## Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| contractNumber | text | yes | append "-EDITED" to existing value |
| title | text | yes | append " EDITED" to existing value |
| status | select | yes | keep as "Draft" |
| accountingMethod | select | no | keep existing |
| description | textarea | no | "Updated by form gauntlet" |
| startDate | date | no | "2025-01-01" |
| completionDate | date | no | "2025-12-31" |

## Submit Action
"Save" or "Save Changes" button

## Success Criteria
- [ ] Success toast displayed (e.g. "Saved", "Changes saved", "Commitment updated")
- [ ] Form exits edit mode (fields become read-only)
- [ ] Updated title/description visible on the page after save

## Cleanup
No cleanup required — but note which commitment was edited and what original values were for reference
