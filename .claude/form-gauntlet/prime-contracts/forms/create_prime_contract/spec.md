## Form: create_prime_contract

**Title:** Create Prime Contract
**URL Path:** /67/prime-contracts/new
**How to Open:** Navigate directly to /67/prime-contracts/new

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| contract_number | text | yes | "PC-GAUNTLET-001" |
| title | text | yes | "Gauntlet Test Contract" |
| status | select | no | "draft" |
| default_retainage | number | no | 10 |
| start_date | date | no | 04/01/2026 |
| description | textarea | no | "Automated form gauntlet test contract" |

### Submit Action
Submit / Create / Save button at bottom of ContractForm

### Success Criteria
- [ ] Toast shows "Prime contract created"
- [ ] Browser redirects to /67/prime-contracts/[newId]
- [ ] Contract "PC-GAUNTLET-001" appears in list at /67/prime-contracts

### Cleanup
yes — delete via delete_single_contract after verification
