## Form: edit_prime_contract

**Title:** Edit Prime Contract
**URL Path:** /67/prime-contracts/20c40a53-f2d7-4b22-a257-cc1b3a80efaa/edit
**How to Open:** Navigate directly to the /edit sub-route of an existing contract, or find an Edit button on the contract detail page

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| title | text | yes | "Gauntlet Test Contract EDITED" |
| status | select | no | "approved" |
| description | textarea | no | "Updated by form gauntlet" |

(All other fields can remain as-is from the original contract)

### Submit Action
"Save Changes" or "Update Contract" button (check the form for exact label)

### Success Criteria
- [ ] Toast shows success message
- [ ] Contract title shows "Gauntlet Test Contract EDITED" on the detail page
- [ ] Status badge shows "Approved" (or equivalent) on the detail page

### Cleanup
no — leave in edited state; cleaned up when parent contract is deleted
