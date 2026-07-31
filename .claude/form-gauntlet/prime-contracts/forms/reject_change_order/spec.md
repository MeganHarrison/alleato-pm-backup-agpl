## Form: reject_change_order

**Title:** Reject Change Order
**URL Path:** /67/prime-contracts/[contractId]
**How to Open:** Change orders tab → row action on a change order with status "pending" → "Reject"
NOTE: May need to first change a CO status to "pending" before rejecting is possible

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| rejection_reason | textarea | yes | "Rejected by form gauntlet automated test" |

### Submit Action
"Reject Change Order" button (red/destructive)

### Success Criteria
- [ ] Modal closes
- [ ] Change order status shows "Rejected"

### Cleanup
no
