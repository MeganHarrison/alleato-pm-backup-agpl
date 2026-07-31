# Task: Duplicate Migration Version Repair

Status: Complete

## Scope

Repair the duplicate local Supabase migration version `20260709120000` without rerunning already-live schema changes, restore deterministic migration-ledger verification, and update the task records that were blocked by the duplicate.

## Linear

- Issue creation is deferred because the configured Linear connector is unavailable with `oauth_token_invalid_grant`; record the exact blocker in the handoff and retry after connector reauthentication.

## Checklist

- [x] Identify every file sharing version `20260709120000` and its commit chronology.
- [x] Verify the remote ledger state for both July 9 changes.
- [x] Verify both schema effects are already live before changing migration history.
- [x] Keep the earlier pay-app migration at `20260709120000` and rename the later tasks migration to a unique chronological version.
- [x] Mark both verified-live migration versions as applied in the linked remote ledger without rerunning SQL.
- [x] Rerun the repository verifier for both repaired July 9 migrations and the previously blocked operational/drawing migrations.
- [x] Update affected task and handoff evidence with the repaired verifier results.
- [x] Commit and push only task-owned migration/process files while preserving concurrent drawing-verification edits.

## Failure-Loudly Guardrail

The repository migration verifier must pass for each repaired and previously blocked migration. A schema-only check or a local filename rename is insufficient; local versions, remote versions, and the live schema contract must all agree.

## Evidence

- `20260709120000_add_payapp_number_to_subcontractor_invoices.sql` was committed first (`1c5129fe3`, 2026-07-09 09:57 EDT).
- The tasks migration was committed later (`0a819f584`, 2026-07-09 17:12 EDT) and is now `20260709171205_tasks_metadata_id_nullable_for_manual_tasks.sql`.
- Linked migration list now shows matching Local and Remote entries for `20260709120000`, `20260709171205`, `20260710120000`, and `20260713143000`.
- The repository verifier passes independently for all four versions.
- Task-owned repair and evidence files were published to `origin/main` in commit `3e7e6c9359adeab080a41648cb353143b7e7295c`; concurrent drawing-verification edits remained unstaged and untouched.
- The linked remote ledger has no `20260709120000` row.
- Live schema proof: `public.tasks.metadata_id` is nullable; `public.subcontractor_invoices.jobplanner_pay_app_number` exists and is nullable; `idx_subcontractor_invoices_pay_app` exists.
