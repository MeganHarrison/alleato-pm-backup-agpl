# CRM-native lead database readback

Linked production Supabase project: `lgveqfnpkxvzbnnwuled`

Applied migration ledger entries:

- `20260730013000 crm_native_leads`
- `20260730020000 crm_native_lead_workflows`
- `20260730021000 crm_native_lead_insert_permissions`
- `20260730022000 crm_native_lead_conversion_replay`
- `20260730024200 crm_deal_relationship_owner_rls`
- `20260730025000 crm_lead_conversion_account_guard`

Final readback confirmed:

- `crm_leads` exists independently of `companies`.
- `tasks.crm_lead_id` links CRM-native lead follow-ups into the shared Tasks system.
- Authenticated users cannot insert system-managed lead status, health, conversion, or
  version fields.
- Deal row-level security aligns the deal owner with the selected account or lead owner.
- Conversion rejects inactive or incompatible accounts, is replay-safe for the same
  account, and rejects a different-account replay.
- Conversion reparents deals, activities, and tasks and clears the task's lead identity.
- The final linked transactional pgTAP run passed all 38 assertions.
