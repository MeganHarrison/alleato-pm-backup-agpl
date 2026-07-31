# Task: Revoke Plane Domain Anonymous Grants

Status: Ready for Review
Owner: S20260731-PLANE-BATCH2-INTEGRATION
Created: 2026-07-31
Task ID: AAI-PLANE-DOMAIN-ANON-GRANTS
Linear Issue: Parent Plane-to-Alleato program owns external tracking.
Related Handoff: Parent integration checkpoint; no separate handoff requested.

## Objective

Remove inherited `PUBLIC` and `anon` table privileges from the five Plane
Modules and Cycles domain tables without changing authenticated access, while
making the three previously inherited Modules `service_role` grants explicit.

## Scope

- `project_modules`, `project_module_members`, `module_task_memberships`,
  `project_cycles`, and `cycle_task_memberships` only.
- One corrective migration and one focused SQL source regression test.
- Excludes policy changes, schema changes, data changes, migration application,
  and publication.

## Source of Truth

- Canonical runtime/data owner: the five named Supabase tables and their
  existing RLS policies.
- Existing shared primitives/services: the authenticated and service-role
  grants in the Modules and Cycles creation migrations.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `PUBLIC` and `anon` lose all table privileges on exactly five tables.
- [x] Authenticated grants remain unchanged.
- [x] The three Modules tables explicitly grant CRUD access to `service_role`.
- [x] Existing Cycles `service_role` grants remain unchanged.
- [x] No policy, function, schema, sequence, or data mutation is introduced.
- [x] A focused regression test fails on missing, extra, or broader revokes.
- [x] Migration application and publication remain with the parent release owner.

## Implementation Checklist

- [x] Task-owned files were listed before edits.
- [x] The corrective boundary is one shared migration, not page-local handling.
- [x] The migration names every affected table and role explicitly.
- [x] Service access does not depend on inherited `PUBLIC` privileges.
- [x] No anonymous access failure can be hidden behind RLS assumptions.

## Integration and Verification

- [x] Focused SQL source test passes.
- [x] `git diff --check` passes.
- [x] Supabase types gate was attempted read-only; live generation is blocked by the local CLI token format.
- [ ] Live privilege readback is deferred until the parent applies the migration.
- [ ] Task-owned files are not published by this implementation task.

## Failure-Loudly Contract

- Cause surfaced as: focused test failure when a required revoke is missing, an
  unrelated table or role is added, or broader DDL/DML appears.
- Detection path: the focused Jest SQL source test plus post-application
  `information_schema.table_privileges` readback by the parent release owner.
- Recovery path: correct the exact revoke list before application, or re-run the
  exact migration and privilege readback if application did not remove a grant.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: RLS was enabled, but the creation migrations retained inherited
  table privileges for `PUBLIC` and `anon`; the Modules migration also omitted
  explicit service-role table grants.
- Detection gap: prior migration tests asserted RLS and authenticated access but
  did not assert the complete anonymous table-privilege boundary.
- Prevention: one exact-list source regression test covering both revokes and
  service grants, plus mandatory live privilege readback after application;
  fail loudly when the types gate cannot read the remote schema.
- Guardrail evidence: focused Jest test for exact tables, roles, and statement
  classes.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Types gate | `npx supabase gen types typescript --project-id "lnnalnbmftuhiokyogsu" --schema public` | Blocked | Local CLI auth failed with `LegacyInvalidAccessTokenError: Invalid access token format`; checked-in `frontend/src/types/database.types.ts` also does not yet include these Plane domain tables. |
| Scope | `npm.cmd run test:unit -- --runInBand --silent --runTestsByPath src/features/plane-domain-security/__tests__/anon-grants-migration.test.ts` | Pass | 3/3 exact revoke and service-role grant tests passed. |
| Patch hygiene | `git diff --check -- supabase/migrations/20260731231500_revoke_plane_domain_anon_grants.sql frontend/src/features/plane-domain-security/__tests__/anon-grants-migration.test.ts docs/ops/tasks/2026-07-31-plane-domain-anon-grants.md` | Pass | No whitespace errors in task-owned files. |
| Live ledger and privileges | Parent release checkpoint | Deferred | This task must not apply or publish. |

## Remaining Risk

- Until the parent release owner applies the migration, inherited live grants
  remain. After application, read back privileges for all five tables and
  confirm `authenticated`/`service_role` access is still present before release.
- The local Supabase CLI token is malformed, so this workspace cannot perform a
  live schema/types readback until the secure token source is repaired by the
  release owner or environment owner.

## Final Status

- [ ] All required checklist items are complete; application and live readback remain.
- [x] Evidence contract is defined.
- [x] Incident learning is recorded.
- [x] Deferred work names cause, detection, prevention, owner, and next action.
