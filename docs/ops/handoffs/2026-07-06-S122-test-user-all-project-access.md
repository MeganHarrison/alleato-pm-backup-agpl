# Handoff: 2026-07-06 — Test user all-project access

## Intake Block

1) Session ID: S122
2) Task ID: AAI-982
3) Linear issue: AAI-982
4) Linear URL: https://linear.app/megankharrison/issue/AAI-982/grant-env-test-account-project-access-across-the-full-portfolio
5) Current status: In Review
6) Files changed (absolute paths):
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-06-test-user-all-project-access.md
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-06-S122-test-user-all-project-access.md
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md
   - /Users/meganharrison/Documents/alleato-pm/frontend/scripts/setup-test-user-for-all-projects.ts
7) Commands run and outcome (pass/fail counts):
   - `rg -n "TEST|test account|TEST_ACCOUNT|EMAIL" .env .env.* frontend/.env* backend/.env*`: pass
   - `rg -n "resolveVisibleProjectIdsForUser|project_directory_memberships|project_members" frontend backend`: pass
   - Supabase runtime probe for auth link and pre-change counts: pass
   - `npx tsx scripts/setup-test-user-for-all-projects.ts`: pass
   - Independent Supabase read-back for post-change counts: pass
   - `./node_modules/.bin/eslint scripts/setup-test-user-for-all-projects.ts`: warning only, file ignored by repo pattern
8) Evidence artifacts (screenshot/video/report/log paths):
   - Command evidence only
9) Top 3 findings (frontend-visible issues first):
   - Project portfolio visibility is membership-scoped, so app admin alone is not sufficient.
   - The env test account only had 6 active memberships against 117 projects before the fix.
   - The existing helper script targeted a legacy table and could not satisfy the real contract.
10) Recommended next action (one line):
    - Accept the handoff or publish the helper-script improvement if this operational path should be kept in the repo.
11) Handoff file path:
    - /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-06-S122-test-user-all-project-access.md
12) Migration ledger evidence:
    - No migration

## Linear Updates

- Kickoff comment: `048b5d69-2edc-4fec-893f-5bb0daed91d5`
- Milestone comments: not needed for this short task
- Completion/blocker comment: `11b19929-5c78-4b4d-9683-cd1c465fef08`

## Current Status

The helper script was repaired to use `project_directory_memberships`, resolve the env test email dynamically, and reuse the live project-level `Project Admin` permission template. The live run inserted 111 missing memberships, and an independent read-back confirmed 117 active memberships across 117 projects.

## Exact Next Step

If this should land in the repo, validate the handoff and finish only the task-owned files because the checkout has unrelated dirt.

## Known Pitfalls

- App admin does not widen the project portfolio list for non-owner users.
- Using the stale `project_members` path would report success without changing the real visibility contract.
- Membership inserts should reuse the current project-level permission template instead of creating bare rows with ambiguous access.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm/frontend
node --input-type=module <<'EOF'
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local', quiet: true });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const email = process.env.TEST_USER_1;
const { data: authUsers } = await sb.auth.admin.listUsers();
const authUser = authUsers.users.find((u) => u.email === email);
const { data: authLink } = await sb.from('users_auth').select('person_id').eq('auth_user_id', authUser.id).maybeSingle();
const { count: projectCount } = await sb.from('projects').select('id', { count: 'exact', head: true });
const { count: membershipCount } = await sb.from('project_directory_memberships').select('project_id', { count: 'exact', head: true }).eq('person_id', authLink.person_id).eq('status', 'active');
console.log({ email, personId: authLink.person_id, projectCount, membershipCount });
EOF
```

## Evidence

- Pre-change probe:
  - `test1@mail.com`
  - auth user `6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6`
  - person `34b16b53-b28c-4ff7-ae31-1bd331eba1f0`
  - `117` total projects
  - `6` active memberships before the fix
- Grant run:
  - `Inserted memberships: 111`
  - `Reactivated memberships: 0`
  - `Active memberships after run: 117`
- Independent read-back:
  - `117` total projects
  - `117` active memberships after the fix
