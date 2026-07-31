# Task: Operational Request and Commit Log

Status: Done

## Scope

Add an owner/admin observability surface that shows incoming application requests and GitHub push commits, including who authored each commit and who pushed it.

## Checklist

- [x] Verify existing audit/logging surfaces and identify the logging gap.
- [x] Record the Linear kickoff blocker when the connector requires reauthentication.
- [x] Add append-only database tables for request events and pushed commits.
- [x] Add middleware request logging that does not block user traffic.
- [x] Add a GitHub push webhook receiver that verifies signatures and records commits.
- [x] Add an admin frontend page that shows recent requests and recent pushed commits.
- [x] Apply the Supabase migration and verify the remote migration ledger.
- [x] Configure the production GitHub webhook and verify a push event writes rows.
- [x] Run focused lint/type checks for changed files.
- [x] Browser-verify the admin observability page and capture evidence.

## Failure-Loudly Guardrail

The request logger must not silently disappear. Missing service-role configuration should emit an explicit server error log, and the admin read/API/webhook paths must return specific errors if the backing tables or webhook secret are missing.

## Evidence

- Existing `db_audit_log` reviewed: it captures business-table mutations, not request traffic or GitHub push commits.
- Linear connector attempted and blocked by `oauth_token_invalid_grant`; recovered through the local Linear API key with issue `AAI-1062` and completion comment `e3dbb753-e7ec-4523-bf67-a17efbb77347`.
- Impeccable preflight completed for the admin observability surface; scope is a quiet owner/admin inspection page with no KPI cards or decorative panels.
- Migration `20260713143000_operational_request_commit_logs.sql` was applied directly with `psql "$DATABASE_URL"` because `supabase db push` would encounter unrelated migration drift.
- Supabase ledger was repaired and verified for exact version `20260713143000`; `supabase migration list --linked` shows Local and Remote both populated for that version.
- Repo verifier `npm run db:migrations:verify-applied -- supabase/migrations/20260713143000_operational_request_commit_logs.sql` passes after S134 repaired the duplicate July 9 version.
- Focused checks passed: targeted ESLint, `npm run check:routes`, Impeccable surface complexity audit, `frontend` changed-type debt check, and `git diff --check` for task-owned files.
- Local request logging wrote rows to `public.app_request_log`; proof query showed recent middleware rows including `/observability`, `/auth/login`, and `/api/users/me/profile`.
- Production Vercel deployment for commit `136e72889` is `READY`.
- GitHub webhook read-back shows an active push webhook to `https://projects.alleatogroup.com/api/webhooks/github` with last response `200 OK`.
- Push-event proof: `developer_commit_log` contains commit `136e728892cf` with message `Allow app admins to view operational logs` and pusher `MeganHarrison`.
- Request-log proof: `app_request_log` contains production `/observability` rows with status `200` for `test1@mail.com`.
- Browser evidence captured production `/observability` as an app-admin user:
  - `docs/ops/evidence/2026-07-13-operational-request-commit-log/observability-production-admin.png`
  - `docs/ops/evidence/2026-07-13-operational-request-commit-log/observability-production-commits.png`
