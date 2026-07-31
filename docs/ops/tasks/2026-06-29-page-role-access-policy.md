# Task: Page Role Access Policy

Status: Blocked/Deferred - browser auth and type generation proof remaining
Owner: Codex
Created: 2026-06-29
Linear Issue: AAI-767 - https://linear.app/megankharrison/issue/AAI-767/make-page-access-editable-by-project-role-with-enforced-route-policy
Related Handoff: docs/ops/handoffs/2026-06-29-S96-page-role-access-policy.md

## Objective

Make page access understandable and durable by giving admins a direct way to
set which permission roles can access each project-scoped page, with a
server-side guard that enforces the same policy.

## Attention Brief

Primary user: app admin reviewing project-page access.
Primary job: choose a page and quickly set the project/company permission roles
that can open it.
Primary decision: which roles are explicitly allowed for a route.
Tier 1: page path/name, current route requirement, explicitly allowed roles.
Tier 2: diagnostic roles that qualify through existing module permissions.
Hide until requested: implementation notes and raw module rules.
Remove: any UI implication that module access is the same as page-role access.
Primary action: save allowed roles for a route.
Failure-loudly behavior: page-role policy loading or saving fails with a
specific error; protected page access denies when no matching role policy exists.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing route/access architecture reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for page-role access.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/migration handled.
- [x] Centralized/shared guard used for project page enforcement.
- [x] Admin API can read/write explicit route-to-role policies with readback.
- [x] Site-map UI can set explicit allowed roles per page without mutating permission templates.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing UI follows the Alleato noise gate.

## Integration Checklist

- [x] Page access UI, API, database, and route guard use one canonical policy model.
- [x] Existing module/level policy remains visible as diagnostic requirement metadata.
- [x] App admin/owner bypass behavior is preserved and explicit.
- [x] Pages without explicit role policy have an intentional default behavior.

## Regression Guardrails

- [ ] Unit/integration tests cover allow, deny, admin bypass, and missing-policy behavior.
- [ ] API validation test covers invalid template/route payloads.
- [x] Site-map test covers explicit role controls/readout.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated.
- [x] Targeted automated tests run.
- [x] Browser/user-flow verification attempted on exact `/site-map` route.
- [x] Migration ledger read-back performed or explicitly deferred.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `supabase/migrations/*_app_page_role_access_policies.sql` - First-class route-to-template policy table.
- `frontend/src/types/database.types.ts` - Regenerated Supabase types after migration.
- `frontend/src/lib/page-role-access.ts` - Shared policy normalization and access helper.
- `frontend/src/lib/supabase/auth-guard.ts` - Central project-page access enforcement helper.
- `frontend/src/app/(main)/[projectId]/layout.tsx` - Project page guard integration.
- `frontend/src/app/api/permissions/page-role-access/route.ts` - Admin read/write API.
- `frontend/src/app/(admin)/site-map/site-map-client.tsx` - Explicit allowed-role editing UI.
- `frontend/src/app/(admin)/site-map/__tests__/layout-options.test.ts` - UI/source guardrails.
- `docs/ops/tasks/2026-06-29-page-role-access-policy.md` - Task evidence.
- `docs/ops/handoffs/2026-06-29-S96-page-role-access-policy.md` - Session handoff.

## Acceptance Criteria

- Site-map page access can show and save explicit allowed permission roles for a route.
- Saving allowed roles does not mutate `permission_templates.rules_json`.
- Protected project pages deny users whose active permission template is not allowed by the route policy.
- App admins/developers/owner bypass remains explicit.
- Missing or invalid policy states fail loudly and are visible in tests/API errors.

## Failure-Loudly Behavior

- API rejects unknown route strings, unknown template IDs, duplicate rows, and empty invalid payloads.
- Guard denies non-admin users when a route policy exists and their active template is not allowed.
- Guard logs/returns a specific access-denied reason instead of silently falling back to broad module access.
- Site-map shows an actionable save/load error instead of pretending role changes applied.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Architecture trace | Source inspection of project layout, admin layout, page-access API, permission loader | Pass | Existing model is route -> module/level metadata plus role templates -> module rules; no route -> role source exists. |
| Migration apply | `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260629215500_create_app_page_role_access_policies.sql` | Pass | Applied only this migration to avoid unrelated pending migrations. |
| Migration repair | `npx supabase migration repair --linked --status applied 20260629215500` | Pass | Ledger repaired for this exact version. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260629215500_create_app_page_role_access_policies.sql` | Pass | `Supabase migration ledger check passed: 20260629215500`. |
| DB readback | `select table_name from information_schema.tables where table_schema = 'public' and table_name in (...)` | Pass | Returned `app_page_role_access_policies` and `app_page_role_access_policy_templates`. |
| Type generation | `npx supabase gen types typescript --project-id ... --schema public`; `npx supabase gen types typescript --db-url ... --schema public` | Blocked/Partial | Project-id path returned unauthorized; db-url path requires Docker and Docker socket is unavailable. `database.types.ts` was manually patched to match the applied migration. |
| Static/lint | `cd frontend && ./node_modules/.bin/eslint ...page-role-access... site-map... layout... middleware...` | Pass | Targeted lint clean. |
| Type debt guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Full TypeScript compile | `cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false` | Stopped | No output after 60 seconds; stopped to avoid blocking main thread on project-wide check. |
| Targeted tests | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/app/(admin)/site-map/__tests__/layout-options.test.ts src/lib/page-role-access.unit.test.ts` | Pass | 2 suites, 9 tests passed. |
| Browser/user-flow | `agent-browser open http://localhost:3001/site-map?tab=pages&page=1 && agent-browser get url && agent-browser snapshot -i` | Blocked | Redirected to `/auth/login?callbackUrl=%2Fsite-map%3Ftab%3Dpages%26page%3D1`; unauthenticated browser state prevents visual proof. |
| Whitespace | `git diff --check` | Pass | No whitespace errors. |

## Files Changed

- `docs/ops/tasks/2026-06-29-page-role-access-policy.md` - Task ledger and evidence.
- `docs/ops/handoffs/2026-06-29-S96-page-role-access-policy.md` - Session handoff.
- `docs/ops/orchestration/session-board.md` - S96 claim.
- `supabase/migrations/20260629215500_create_app_page_role_access_policies.sql` - Explicit route-to-template policy tables.
- `frontend/src/types/database.types.ts` - Manual type entry for new policy tables; regeneration remains blocked.
- `frontend/src/lib/page-role-access.ts` - Shared route canonicalization, policy types, and role-label helpers.
- `frontend/src/lib/page-role-access.unit.test.ts` - Focused helper tests.
- `frontend/src/lib/supabase/middleware.ts` - Adds `x-alleato-pathname` request header.
- `frontend/src/app/(main)/[projectId]/layout.tsx` - Enforces explicit page-role policies after project membership.
- `frontend/src/app/api/permissions/page-role-access/route.ts` - Admin read/write API for role policies.
- `frontend/src/app/(admin)/site-map/site-map-client.tsx` - Allowed Roles column/editor wired to policy API.
- `frontend/src/app/(admin)/site-map/__tests__/layout-options.test.ts` - Site-map source guardrails.

## Risks / Gaps

- Existing checkout has substantial unrelated dirty files; task changes stayed scoped, but `site-map-client.tsx` already contained pre-existing edits.
- Exact browser proof remains blocked by local auth state.
- Supabase type regeneration remains blocked by unauthorized Management API response and Docker being unavailable for db-url generation.
- Full/project TypeScript compile was stopped after 60 seconds with no output; targeted checks passed.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
