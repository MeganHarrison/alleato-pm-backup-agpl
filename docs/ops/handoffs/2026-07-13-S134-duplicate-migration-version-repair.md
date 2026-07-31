# Handoff: Duplicate migration version repair

## Intake Block

1) Session ID: S134
2) Task ID: MIGRATION-VERSION-REPAIR-2026-07-13
3) Linear issue: Blocked - connector OAuth grant invalid
4) Linear URL: unavailable
5) Current status: Complete - published and remote-verified
6) Files owned: `supabase/migrations/20260709120000_add_payapp_number_to_subcontractor_invoices.sql`; renamed tasks migration; affected task/handoff evidence; this handoff; session board
7) Commands run and outcome: Git chronology inspection passed; live schema and ledger inspection passed
8) Evidence artifacts: command evidence recorded below
9) Top findings: duplicate local version; neither July 9 migration is in remote ledger; both schema effects are already live
10) Recommended next action: none for this repair; proceed with the now-unblocked operational webhook and drawing verification work
11) Handoff file path: `docs/ops/handoffs/2026-07-13-S134-duplicate-migration-version-repair.md`
12) Migration ledger evidence: Local and Remote match for `20260709120000`, `20260709171205`, `20260710120000`, and `20260713143000`

## Failure Record: Linear kickoff

- Cause: the configured Linear connector is unavailable with `oauth_token_invalid_grant`.
- Detection gap: connector readiness was not available before continuing the existing repository blocker.
- Prevention: preserve the local task/handoff evidence and retry issue creation after connector reauthentication.
- Owner: workspace integration administrator.
- Related to current task: process-only; it does not block the deterministic migration repair.

## Verification Evidence

- `git log --follow` proves the pay-app migration predates the tasks migration.
- `supabase_migrations.schema_migrations` contains no `20260709120000` row.
- `information_schema.columns` proves both target columns have the intended live nullability and type.
- `pg_indexes` proves `idx_subcontractor_invoices_pay_app` exists.
- Renamed only the later tasks migration to `20260709171205_tasks_metadata_id_nullable_for_manual_tasks.sql`.
- `supabase migration repair --linked --status applied` succeeded for `20260709120000` and `20260709171205`; no schema SQL was rerun.
- `npm run db:migrations:verify-applied -- <file>` passes for both repaired July 9 migrations, drawing annotations `20260710120000`, and operational logs `20260713143000`.
- `npm run codex:finish -- --message "Repair duplicate migration versions" --staged-only` passed and published commit `3e7e6c9359adeab080a41648cb353143b7e7295c`; local `HEAD` matched `origin/main` afterward.
