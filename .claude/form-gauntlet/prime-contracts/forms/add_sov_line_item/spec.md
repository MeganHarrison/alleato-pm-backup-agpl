## Form: add_sov_line_item

**Title:** Add Schedule of Values Line Item
**URL Path:** /67/prime-contracts/[contractId] (need a contractId — create one first or use existing)
**How to Open:** On contract detail page → look for "Add SOV Line" or "+" button to open modal

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| line_number | number | yes | 1 |
| description | textarea | yes | "Gauntlet SOV Line Test" |
| quantity | number | no | 2 |
| unit_cost | number | no | 1000.00 |
| unit_of_measure | text | no | "SF" |

### Submit Action
"Add SOV Line" button in modal footer

### Success Criteria
- [ ] Modal closes after submission
- [ ] Row with description "Gauntlet SOV Line Test" appears in SOV table

### Cleanup
yes — delete via delete_line_item
