# Handoff: Operational request and commit log

## Intake Block

1) Session ID: S133
2) Task ID: AAI-1062
3) Linear issue: AAI-1062
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1062/add-operational-request-and-github-commit-logs
5) Current status: Done - deployed to production and verified with request rows, commit rows, and browser screenshots
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-13-operational-request-commit-log.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S133-operational-request-commit-log.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/orchestration/session-board.md`; `/Users/meganharrison/Documents/github/project-management/supabase/migrations/20260713143000_operational_request_commit_logs.sql`; `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/observability/request-log.ts`; `/Users/meganharrison/Documents/github/project-management/frontend/src/middleware.ts`; `/Users/meganharrison/Documents/github/project-management/frontend/src/app/api/webhooks/github/route.ts`; `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(admin)/observability/page.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(admin)/admin/admin-dashboard-data.ts`
7) Commands run and outcome (pass/fail counts): PASS: targeted ESLint; PASS: `npm run check:routes`; PASS: Impeccable surface audit; PASS: `frontend` changed-type debt check; PASS: migration ledger proof for `20260713143000`; PASS: GitHub webhook read-back active with last response `200 OK`; PASS: production Vercel deployment `136e72889` READY; PASS: database proof for `/observability` request rows and commit `136e728892cf`; PASS: production browser proof for `/observability`; FAIL/RECOVERED: Linear connector OAuth invalid, recovered through local Linear API key.
8) Evidence artifacts (screenshot/video/report/log paths): `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-13-operational-request-commit-log/observability-production-admin.png`; `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-13-operational-request-commit-log/observability-production-commits.png`; `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-13-operational-request-commit-log/auth-gated-observability.png`
9) Top 3 findings (frontend-visible issues first): `/observability` now renders for app-admin users; request traffic is visible with user/status/request-id; GitHub push commits are visible with branch, SHA, message, author, and pusher.
10) Recommended next action (one line): Keep monitoring `/observability` during the next developer pushes and add filters/export only after real usage shows the table volume requires it.
11) Handoff file path: `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S133-operational-request-commit-log.md`
12) Migration ledger evidence: `supabase migration list --linked` shows `20260713143000 | 20260713143000 | 2026-07-13 14:30:00`

## Linear Updates

- Kickoff comment: Connector attempt failed with `oauth_token_invalid_grant`; local task and handoff evidence were created before implementation.
- Completion comment: Posted to `AAI-1062` as Linear comment `e3dbb753-e7ec-4523-bf67-a17efbb77347` with changed files, checks, deployment proof, database proof, and screenshot paths.

## Resolved Failure Record: Linear kickoff

- Cause: Linear connector returned `oauth_token_invalid_grant`.
- Detection gap: connector health is not checked before starting full-process local task evidence.
- Prevention: keep local task and handoff evidence complete, then retry Linear after connector reauthentication.
- Owner: workspace integration administrator for connector health; this task recovered through the local Linear API key.
- Related to current task: process-only; it did not block implementation or completion evidence.

## Summary

This session owns only the operational request log, GitHub push commit log, admin page, and setup verification for that surface.

Implemented append-only request and commit logging:

- `public.app_request_log` stores method, path, query, status, duration, decoded Supabase user fields, hashed client IP, user agent, referrer, source, metadata, and timestamp.
- `public.developer_commit_log` stores GitHub push commit rows with repository, branch, SHA, message, compare URL, author, committer, pusher, delivery ID, pushed time, received time, and raw payload metadata.
- Middleware writes request rows with `NextFetchEvent.waitUntil` so user traffic is not blocked.
- GitHub webhook verifies `x-hub-signature-256` using `GITHUB_WEBHOOK_SECRET` and records push commits idempotently.
- Admin route `/observability` shows recent app requests and pushed commits in a quiet owner/admin inspection view.

## Current State

- Existing audit log coverage was inspected.
- Supabase migration was applied directly with `psql "$DATABASE_URL"` and the exact migration version was marked applied with `supabase migration repair --linked --status applied 20260713143000`.
- `npm run db:migrations:verify-applied -- supabase/migrations/20260713143000_operational_request_commit_logs.sql` passes after S134 repaired the duplicate July 9 version.
- Type generation to a temporary file confirmed both new tables exist in remote schema, but committed `frontend/src/types/database.types.ts` was not replaced because the generated diff included unrelated remote schema changes.
- App-admin access correction was published in commit `136e72889`; `/observability` now uses the `user_profiles.is_admin` gate without broadening the legacy `/admin` dashboard allowlist.
- Production Vercel deployment for commit `136e72889` is `READY`.
- GitHub webhook read-back shows an active push webhook to `https://projects.alleatogroup.com/api/webhooks/github` with last response `200 OK`.
- Database proof shows request logging is active: `app_request_log` contains production `/observability` rows with status `200` for `test1@mail.com`.
- Database proof shows commit logging is active: `developer_commit_log` contains commit `136e728892cf` with message `Allow app admins to view operational logs` and pusher `MeganHarrison`.
- Production browser proof loaded `https://projects.alleatogroup.com/observability` as an app-admin test user with both `Requests` and `Pushed Commits` sections visible.

## Next Step

Monitor `/observability` during the next developer pushes; add filters/export only after real usage shows the table volume requires it.

## Verification Commands

- `pnpm --dir frontend exec eslint src/lib/observability/request-log.ts src/middleware.ts 'src/app/api/webhooks/github/route.ts' 'src/app/(admin)/observability/page.tsx' 'src/app/(admin)/admin/admin-dashboard-data.ts'` - passed.
- `npm run check:routes` - passed.
- `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs 'frontend/src/app/(admin)/observability/page.tsx'` - passed.
- `cd frontend && npm run typecheck:changed` - passed.
- `git diff --check -- <task-owned paths>` - passed.
- `set -a; source frontend/.env.local; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260713143000_operational_request_commit_logs.sql` - passed.
- `set -a; source frontend/.env.local; set +a; supabase migration repair --linked --status applied 20260713143000` - passed.
- `set -a; source frontend/.env.local; set +a; supabase migration list --linked | rg '20260713143000|Local|Remote'` - passed for exact version.
- `set -a; source frontend/.env.local; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select 'app_request_log' as table_name, count(*) from public.app_request_log union all select 'developer_commit_log' as table_name, count(*) from public.developer_commit_log;"` - passed; app request rows present, developer commit rows pending webhook event.
- `git commit --only 'frontend/src/app/(admin)/layout.tsx' frontend/src/lib/auth/require-app-admin.ts -m "Allow app admins to view operational logs"` - passed; commit `136e72889`.
- `git push origin main && git fetch origin main && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"` - passed.
- `vercel list project-management-agent --scope team_KXDgilmKdWqFZsRC5NRAI0Ux --format json` - passed; production deployment for `136e72889` is `READY`.
- `gh api repos/The-Alleato-Group/project-management/hooks` - passed; active push webhook points to `https://projects.alleatogroup.com/api/webhooks/github` with last response `200 OK`.
- `psql "$DATABASE_URL" -c "select ... from public.developer_commit_log where commit_sha like '136e728892%'"` - passed; pusher `MeganHarrison` recorded.
- `psql "$DATABASE_URL" -c "select ... from public.app_request_log where path='/observability'"` - passed; status `200` rows recorded for `test1@mail.com`.
- Production Playwright smoke for `https://projects.alleatogroup.com/observability` - passed; screenshot artifacts captured.

## Resolved Failure Record: Migration verifier

- Cause: the repo had an unrelated duplicate local migration version `20260709120000`.
- Detection gap: the exact migration verifier checks duplicate local versions before checking the requested migration.
- Prevention: S134 retained the earlier pay-app version, renamed the later tasks migration to `20260709171205`, repaired both verified-live ledger rows, and reran this verifier successfully.
- Owner: resolved by S134.
- Related to current task: no; the operational migration remains applied and verified.

## Resolved Failure Record: Authenticated browser proof

- Cause: `/observability` lived inside the `(admin)` route group, so the legacy two-person Admin Dashboard allowlist blocked app-admin users before the page could render.
- Detection gap: initial browser proof checked login/auth state but did not separate the route-group guard from the page's intended app-admin audience.
- Prevention: `frontend/src/app/(admin)/layout.tsx` now routes `/observability` through `requireAppAdminPageAccess()` while preserving the legacy allowlist for the rest of the Admin Dashboard group.
- Owner: resolved in commit `136e72889`.
- Related to current task: yes; production proof now shows the page renders for an app-admin user.
