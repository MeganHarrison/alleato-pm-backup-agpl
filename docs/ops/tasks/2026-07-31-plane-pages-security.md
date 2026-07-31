# Task: Secure Plane Pages Data Access

Status: Review Ready
Owner: S20260731-PLANE-PAGES-RLS
Created: 2026-07-31
Task ID: AAI-PLANE-PAGES-RLS
Linear Issue: Coordinator-owned Plane migration program; no separate issue requested for this security slice.
Related Handoff: Coordinator thread handoff only.

## Objective

Plane Pages reads and mutations use an authenticated, project-scoped server API, while a review-ready migration removes anonymous `public.notes` access and defines project-scoped RLS without changing production.

## Scope

- `public.notes` grants, module-aware RLS policies, indexes, and immutable identity guard.
- Project-scoped Pages list/create/update/delete API routes.
- Plane Pages data adapter and focused API, client, and SQL-contract tests.
- Production migration apply, deployment, and ledger mutation are explicitly excluded until approval.

## Source of Truth

- Canonical runtime/data owner: `public.notes` and static `/api/notes` with mandatory validated `project_id` scope.
- Existing shared primitives/services: `requirePermission`, request-authenticated Supabase server client, generated `Database` types.
- Deprecated or parallel paths: browser-direct `public.notes` CRUD in `plane-pages-data.ts`.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Browser code no longer performs direct `public.notes` reads or writes.
- [x] Reads require authenticated `documents:read`; writes require authenticated `documents:write`.
- [x] Every query and mutation is scoped by validated positive integer project and note IDs.
- [x] Migration enables RLS, removes all `anon` table privileges, and defines authenticated module-aware SELECT/INSERT/UPDATE/DELETE policies.
- [x] Direct PostgREST reads require effective `documents:read`; inserts, updates, and deletes require effective `documents:write` (with the shared helper's app-admin override).
- [x] Inserts require `created_by = auth.uid()`.
- [x] `project_id` and `created_by` cannot be changed after insertion.
- [x] Migration includes rollback/recovery guidance and the exact ledger verification command.
- [ ] Production migration is explicitly approved, applied, and verified in the remote ledger.

## Implementation Checklist

- [x] Files/modules to change were listed before edits.
- [x] Existing permission and API guard owners are reused.
- [x] RLS reuses the canonical effective project-module permission helper and hardens its `SECURITY DEFINER` search path.
- [x] Errors identify the failed Pages operation and retain the server request ID where available.
- [x] Database, authentication, permission, and immutable identity contracts are represented in focused tests.

## Integration and Verification

- [x] Targeted route, client, and migration-contract tests pass.
- [ ] Live RLS behavior is verified after approved migration apply.
- [x] Production remains unchanged in this candidate.
- [ ] Task-owned files are published and local `HEAD` equals the approved target remote.

## Failure-Loudly Contract

- Cause surfaced as: structured API error with operation-specific client message; invalid IDs and payloads return 4xx; database failures return a request-correlated guardrail response.
- Detection path: focused Jest tests plus post-approval `db:migrations:verify-applied` and live RLS readback.
- Recovery path: revoke authenticated mutation privileges while keeping SELECT and RLS enabled, then correct policies in a forward migration.

## Incident Learning

- Failure fingerprint: `N/A` (the learning lookup returned only the general duplicate-migration-version guard).
- Root cause: `public.notes` was exposed through the Data API with RLS disabled and blanket `anon` privileges; the first RLS candidate then treated project membership as equivalent to the API's `documents` permission.
- Detection gap: the Pages pilot verified UI behavior but had no table-policy release gate, and the first SQL contract asserted project scope without asserting permission parity between API and direct PostgREST access.
- Prevention: require RLS/grant contract tests, module-level permission parity, and a server authorization boundary before any new exposed-table pilot can be released.
- Guardrail evidence: migration contract test plus `npm run db:migrations:verify-clean`.

## Evidence

| Check                      | Command / artifact                                                                                                                                                                                                                 | Result                            | Notes                                                                                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types gate                 | Attempted `npx supabase gen types typescript --project-id "lnnalnbmftuhiokyogsu" --schema public`, then checked `frontend/src/types/database.types.ts` plus live column catalog                                                    | Pass with environment limitation  | The Supabase CLI token in this workspace is invalid (`LegacyInvalidAccessTokenError`), so fresh generation could not complete. The restored checked-in types and live catalog both confirm bigint `notes.id`/`project_id`, UUID `created_by`, and the required permission-owner tables. |
| Permission helper catalog  | Read-only `pg_catalog.pg_proc` query on linked project `lnnalnbmftuhiokyogsu`                                                                                                                                                      | Pass with hardening pending       | Live helper is `STABLE` and `SECURITY DEFINER`; current `search_path=public, pg_temp` and inherited anonymous execute access are both removed by the unapplied candidate migration.                                                                                                     |
| Focused tests              | `npm run test:unit -- --runInBand --silent --runTestsByPath "src/features/plane-pages/plane-pages-data.unit.test.ts" "src/app/api/notes/__tests__/route.test.ts" "src/app/api/notes/__tests__/secure-notes-rls-migration.test.ts"` | Pass                              | 3 suites, 18 tests, including direct PostgREST module-permission parity and helper hardening contracts.                                                                                                                                                                                 |
| Focused formatting         | `npx prettier --check` on task-owned TypeScript, tests, and task documentation                                                                                                                                                     | Pass                              | All matched files use repository formatting.                                                                                                                                                                                                                                            |
| Route naming               | `npm run check:routes`                                                                                                                                                                                                             | Pass                              | No dynamic route conflicts.                                                                                                                                                                                                                                                             |
| Production route budget    | `npm run verify:nonprod-routes`                                                                                                                                                                                                    | Pass                              | Static `/api/notes` keeps production at the locked 654 dynamic files / 2042 generated routes. The first project-dynamic API candidate was rejected by this guard before commit.                                                                                                         |
| Diff integrity             | `git diff --check`                                                                                                                                                                                                                 | Pass                              | No whitespace errors.                                                                                                                                                                                                                                                                   |
| Local migration versions   | PowerShell 14-digit prefix duplicate check                                                                                                                                                                                         | Pass                              | No duplicate local migration version.                                                                                                                                                                                                                                                   |
| Remote migration integrity | `npm run db:migrations:verify-clean`                                                                                                                                                                                               | Blocked by unrelated branch drift | `personal-production/main` is missing a large set of already-remote migration files; the task migration version itself is unique. Canonical owner: personal-production migration inventory and remote ledger reconciliation.                                                            |
| Focused lint               | `npx eslint "src/app/api/notes/route.ts" "src/app/api/notes/_shared.ts" "src/app/api/notes/__tests__/*.ts" "src/features/plane-pages/plane-pages-data.ts" "src/features/plane-pages/plane-pages-data.unit.test.ts" --no-cache`     | Blocked by environment            | Workspace dependency install lacks `eslint-plugin-storybook`; no task file was evaluated.                                                                                                                                                                                               |
| Full TypeScript check      | `npx tsc --noEmit --pretty false --incremental false`                                                                                                                                                                              | Timed out                         | No diagnostics were emitted before the 180-second verification limit; focused Jest/ts-jest compilation passed.                                                                                                                                                                          |
| Production apply           | Not run                                                                                                                                                                                                                            | Deferred by explicit instruction  | No `db push`, migration MCP, or direct DDL executed.                                                                                                                                                                                                                                    |
| Ledger command             | `npm run db:migrations:verify-applied -- supabase/migrations/20260731051836_secure_notes_rls.sql`                                                                                                                                  | Deferred                          | Run only after approved production apply.                                                                                                                                                                                                                                               |

## Remaining Risk

- Until the migration is approved and applied, production `public.notes` remains anonymously exposed.
- The API maps Plane Pages to the existing `documents` permission module because no dedicated Pages permission module exists.
- Applying the candidate hardens the shared effective-permission helper's search path globally; its body already uses schema-qualified references, but post-apply catalog and live policy readback remain required.
- Live authenticated RLS behavior cannot be proven until the migration is applied to an approved database target.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in for the local candidate.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred production work has cause, detection gap, prevention step, owner, and next action.
