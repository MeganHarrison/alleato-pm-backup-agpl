# Handoff: 2026-07-22 — AAI-1191 Revision Domain

## Intake Block

1) Session ID: SROOT1191B
2) Task ID: AAI-1191
3) Linear issue: https://linear.app/megankharrison/issue/AAI-1191/add-baselines-revisions-and-controlled-schedule-publishing
4) Current status: In Progress — pure transition/current-read/comparison contract and live database enforcement are published; APIs/UI remain next.
5) Files changed: `frontend/src/lib/scheduling/schedule-revisions.ts`, focused Jest test, `supabase/migrations/20260722011013_schedule_revisions.sql`, regenerated database types, this handoff.
6) TDD evidence: red failed because the revision module did not exist; green is 4/4 focused tests.
7) Database type gate: `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` ran before database work; current checked-in types were retained after the CLI returned no generated stdout in this workspace.
8) Database evidence: Supabase migration `schedule_revisions` applied at remote ledger version `20260722011013`; readback found all four snapshot/event tables and both RPCs. `npm run db:migrations:verify-applied -- supabase/migrations/20260722011013_schedule_revisions.sql` ran after exact version reconciliation.
9) Next action: add transaction-safe API contracts and canonical schedule-page revision controls, then browser proof.
