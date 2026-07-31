# CRM-native leads

Task ID: ALL-52

Session: S019FB13

Status: Complete

Delivery lane: High-risk

Verification contract: Required

## Problem

The current Add lead dialog only enrolls an existing `companies` record. New prospects
must be usable before they exist in Acumatica and must not appear in non-CRM company
selectors.

## Acceptance contract

- A user with CRM write access can create a lead using an organization name and
  optional contact name, email, and phone.
- Lead creation does not insert or update `companies`.
- The new lead appears in CRM Relationships after the API refresh.
- Deals and manual activities can target either a lead or an existing CRM account.
- A CRM follow-up uses the shared `tasks` table and can target a lead.
- Existing company-backed CRM rows continue to work.
- A lead-backed deal cannot convert to a project until the lead is explicitly linked
  to a company.
- Migration, RLS, generated types, focused tests, authenticated browser proof, and
  migration-ledger readback are complete before release is called done.

## Owned paths

- `supabase/migrations/20260730013000_crm_native_leads.sql`
- `supabase/migrations/20260730020000_crm_native_lead_workflows.sql`
- `supabase/migrations/20260730021000_crm_native_lead_insert_permissions.sql`
- `supabase/migrations/20260730022000_crm_native_lead_conversion_replay.sql`
- `supabase/migrations/20260730024200_crm_deal_relationship_owner_rls.sql`
- `supabase/migrations/20260730025000_crm_lead_conversion_account_guard.sql`
- `supabase/tests/crm_native_leads.test.sql`
- `frontend/src/types/database.types.ts`
- `frontend/src/lib/app-surface/app-surface.generated.json`
- `frontend/src/app/(main)/crm`
- `frontend/src/app/api/crm`
- `frontend/src/features/crm`
- `frontend/src/features/tasks`
- `frontend/src/hooks/use-crm`
- `frontend/src/lib/crm`
- `frontend/src/app/api/tasks`
- `CONTEXT.md`
- `docs/adr/0001-crm-native-lead-identity.md`
- `docs/ops/verification/2026-07-30-crm-native-leads-*`
- `docs/architecture/PROJECT-MAP.md`
- `docs/architecture/SYSTEM-MAP.md`
- `docs/architecture/generated/system-map.json`
- `tests/agent-browser-runs/2026-07-30-crm-native-leads`
- this task and its handoff

## Completion evidence

- Production database migrations applied and ledgered.
- Linked pgTAP verification passed all 38 assertions.
- Focused Jest passed 6 suites and 17 tests.
- Focused lint, scoped type verification, and `git diff --check` passed.
- Independent code, database, and security reviews approved the final scope.
- Authenticated exact-build browser verification passed at 1600x900 and 390x844.
- The Add Lead dialog requires an organization, accepts optional contact details,
  explicitly excludes Acumatica creation, and remained inside both viewports without
  horizontal overflow.
- Verification contract:
  `docs/ops/verification/2026-07-30-crm-native-leads-manifest.json`
- Verification result:
  `docs/ops/verification/2026-07-30-crm-native-leads-result.json`

## Stop condition

Stop rather than create placeholder company rows, weaken CRM permissions, or publish a
migration that has not been verified in the production migration ledger.
