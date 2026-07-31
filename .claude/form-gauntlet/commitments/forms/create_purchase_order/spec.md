# Form Spec: Create Purchase Order

**form_id:** create_purchase_order
**Title:** Create Purchase Order
**URL Path:** /67/commitments/new?type=purchase_order
**How to Open:** Navigate directly to the URL

## Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| contractNumber | text | yes | "PO-GAUNTLET-001" |
| title | text | no | "Test PO PO-GAUNTLET-001" |
| status | select | yes | "Draft" |
| executed | checkbox | no | leave unchecked |
| accountingMethod | select | no | "amount" |
| description | textarea | no | "Created by form gauntlet" |

## Submit Action
Primary submit button ("Create Purchase Order" or "Save")

## Success Criteria
- [ ] After submit, browser redirects to /67/commitments
- [ ] New purchase order with number "PO-GAUNTLET-001" or title "Test PO PO-GAUNTLET-001" appears in the commitments list table
- [ ] No error toast or error alert is shown

## Cleanup
Delete via recycle bin or list delete action
