# CRM-native lead release action log

- Implemented `crm_leads` as the CRM-owned identity for prospects that do not yet
  belong in Acumatica or the company directory.
- Added lead-target support to deals, activities, CRM follow-ups, and the existing
  shared Tasks system.
- Added an explicit lead conversion boundary that links to an existing CRM account
  and atomically reparents the lead's related work.
- Applied and ledgered the six CRM-native lead migrations in the linked production
  Supabase project `lgveqfnpkxvzbnnwuled`.
- Generated database types while preserving the authoritative scheduling cascade and
  schedule-cost RPC declarations.
- Ran focused UI, API, Tasks, SQL, lint, type, and independent review checks.
- Verified the authenticated production CRM at desktop and mobile viewports, including
  the Add Lead dialog, required organization validation, and relationship view controls.
