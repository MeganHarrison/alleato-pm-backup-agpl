## Form: create_change_order

**Title:** Create Change Order
**URL Path:** /67/prime-contracts/[contractId]
**How to Open:** On contract detail page → "New Change Order" button

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| change_order_number | text | yes | "CO-GAUNTLET-001" |
| description | textarea | yes | "Gauntlet change order test" |
| amount | number | yes | 5000.00 |
| status | select | no | "draft" |

### Submit Action
"Create Change Order" button

### Success Criteria
- [ ] Modal closes
- [ ] "CO-GAUNTLET-001" appears in change orders tab/table
- [ ] Amount shows $5,000.00

### Cleanup
yes — reject or this will be cleaned when parent contract deleted
