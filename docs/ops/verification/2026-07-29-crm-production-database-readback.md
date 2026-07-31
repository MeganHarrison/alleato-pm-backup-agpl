# CRM production database readback

Supabase project: `lgveqfnpkxvzbnnwuled`

- Applied CRM core migration `20260728160000`.
- Applied release hardening migration `20260729010000`.
- Applied atomic matching migration `20260729013000`.
- Applied conversion idempotency migration `20260729014500`.
- Remote migration ledger reports all four versions as applied.
- `supabase/tests/crm_v4_contract.sql` completed 26 assertions, including CRM tables, task links, policies, RPCs, default pipeline stages, permission templates, and project conversion idempotency.
