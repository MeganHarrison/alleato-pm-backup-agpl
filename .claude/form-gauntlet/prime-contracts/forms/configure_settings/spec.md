## Form: configure_settings

**Title:** Configure Prime Contract Settings
**URL Path:** /67/prime-contracts/configure
**How to Open:** Navigate directly to /67/prime-contracts/configure

### Fields
| Field | Type | Required | Test Value |
|-------|------|----------|------------|
| co_tier_count | button-toggle | no | 2 (click "2 Tiers") |
| allow_standard_users_create_pcco | toggle switch | no | true (on) |
| default_distribution_prime_contract | text | no | "test@alleato.com" |

### Submit Action
"Save Settings" button

### Success Criteria
- [ ] Toast shows "Settings saved"
- [ ] Navigating away and back shows saved values still set

### Cleanup
yes — reset: co_tier_count=1, allow_standard_users_create_pcco=false, default_distribution_prime_contract=blank
