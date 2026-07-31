# Task: Plane Cycles Domain Foundation

Status: Ready for Review
Owner: S20260731-PLANE-CYCLES-DOMAIN
Created: 2026-07-31
Task ID: AAI-PLANE-CYCLES-DOMAIN
Linear Issue: Parent Plane-to-Alleato program owns external tracking.
Related Handoff: Parent integration checkpoint; no separate handoff requested.

## Objective

Create a dedicated project-cycle lifecycle and task-membership boundary that
can replace the temporary `schedule_tasks` Cycles relabeling without changing
the current Cycles UI.

## Scope

- One migration creating `project_cycles` and
  `cycle_task_memberships`.
- Static, route-budget-safe APIs at `/api/plane-cycles` and
  `/api/plane-cycles/memberships`.
- Canonical project access for reads and `schedule:write` permission for
  mutations.
- Bulk, atomic task transfer between cycles.
- A typed client adapter, React Query hooks, domain model, and focused tests.
- Excludes the existing Plane Cycles UI.
- Excludes backfilling from `schedule_tasks`.

## Source of Truth

- Canonical runtime/data owner:
  - `public.tasks` owns work items.
  - `public.schedule_tasks` owns construction schedule activities.
  - `public.project_cycles` owns time-boxed iterations.
  - `public.cycle_task_memberships` is the only cycle/task relationship.
- Existing shared primitives/services:
  - `frontend/src/lib/supabase/auth-guard.ts`
  - `frontend/src/lib/supabase/service-db.ts`
  - `frontend/src/lib/api-client.ts`
- Plane semantic references:
  - `apps/api/plane/db/models/cycle.py`
  - `apps/api/plane/api/serializers/cycle.py`
  - `apps/api/plane/api/views/cycle.py`
- Deprecated or parallel path: the temporary read-only Cycles view backed by
  `schedule_tasks` remains unchanged until the new domain is applied, wired,
  and visually verified.

Delivery lane: High-risk

Verification contract: Required

## Workflow and Data Contract

```text
User action: create/update/delete a cycle; add/move/remove cycle tasks
Frontend owner component: deferred; current Cycles UI is unchanged
Shared primitive/component owner: React Query + apiFetch adapter
Client state changed: project cycle and cycle membership query keys
API routes: /api/plane-cycles, /api/plane-cycles/memberships
Validation: contracts.ts Zod schemas
Service/helper: auth-guard + pending-table typed server adapter
Supabase tables: project_cycles, cycle_task_memberships, tasks
Live DB assumptions: projects.id/tasks.project_id/document_metadata.project_id bigint; tasks.id uuid; tasks.project_ids integer[]
Bulk behavior: 1-500 task IDs transferred in one atomic database function
Expected success: scoped cycle/membership JSON and invalidated project query
Expected failure: explicit 400/401/403/404/409 or classified database error
```

## Acceptance Criteria

- [x] Cycles have a dedicated table and are not stored in `schedule_tasks`.
- [x] Tasks remain canonical; memberships reference `tasks.id`.
- [x] A task belongs to at most one active cycle.
- [x] Direct task `project_id` takes precedence, with single legacy array and
      document metadata fallbacks.
- [x] Ambiguous, unscoped, and cross-project memberships fail loudly.
- [x] Bulk cycle transfer is atomic and capped at 500 tasks.
- [x] RLS scopes both tables to active project members or app admins.
- [x] Static APIs add no dynamic route segments.
- [x] Read and write authorization use existing canonical guards.
- [x] No Cycles UI files are modified.
- [x] No migration or production state is changed.

## Implementation Checklist

- [x] Files/modules were listed and isolated before edits.
- [x] Shared adapters own API payloads, query keys, and lifecycle status.
- [x] Date pairs and ordering are validated in API and database constraints.
- [x] Database triggers prevent cross-project associations.
- [x] Security-definer functions are revoked from public/anon/authenticated;
      the atomic transfer function is granted only to `service_role`.
- [x] Authenticated table privileges are explicit and protected by RLS.
- [x] Errors are specific and actionable.

## Integration and Verification

- [x] Connected Supabase schema verification succeeded for production project
      `lgveqfnpkxvzbnnwuled`.
- [x] Live schema readback confirmed exact task/project column types.
- [x] Correct remote migration ledger confirms version `20260731231200` is
      applied.
- [x] Five focused Jest suites pass: 30 tests.
- [x] Focused TypeScript compilation passes.
- [x] Focused ESLint passes.
- [x] Route conflict check passes.
- [x] Non-production route budget validation passes.
- [x] `git diff --check` passes.
- [x] Independent review completed; all high/medium findings are remediated.
- [x] Migration application is complete; production application release remains
      owned by the parent cutover.

## Failure-Loudly Contract

- Cause surfaced as: 400 invalid shape/date/range, 401 unauthenticated, 403
  missing project or schedule-write permission, 404 missing cycle/task, 409
  ambiguous or cross-project task ownership, and classified database errors.
- Detection path: route tests assert authorization-before-data-access; model
  tests assert legacy resolution; policy tests assert RLS, grants, cardinality,
  schedule-write enforcement, one-cycle uniqueness, and cross-project triggers.
- Recovery path: correct project ownership, assign schedule write permission,
  repair ambiguous legacy task associations, or retry after resolving the
  classified database constraint.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The prior Cycles presentation used schedule rows because no
  iteration domain existed.
- Detection gap: Presentation parity did not expose a canonical cycle or
  cycle-membership data contract.
- Prevention: Dedicated tables, explicit lifecycle ownership, atomic transfer,
  cross-project database enforcement, and route/policy tests.
- Guardrail evidence: 30 focused tests, focused typecheck/lint, route check,
  and correct-project Supabase readback.

## Evidence

| Check                | Command / artifact                                                                                          | Result | Notes                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Current schema       | Supabase Management API readback                                                                            | Pass   | Production project `lgveqfnpkxvzbnnwuled`; cycle tables, functions, RLS, and grants are present.                        |
| Live schema          | Supabase connector read-only `information_schema.columns` query                                             | Pass   | `projects.id`, `tasks.project_id`, and metadata project are bigint; task ID is UUID; legacy project array is integer[]. |
| Remote ledger        | Supabase Management API query of `supabase_migrations.schema_migrations`                                    | Pass   | Version `20260731231200` is present on production.                                                                      |
| Focused tests        | Jest run of five Cycles domain/API suites                                                                   | Pass   | 30/30 tests, including missing-cycle 404s, safe bigint IDs, and schedule-write RLS.                                     |
| Focused types        | Temporary narrow `tsconfig` including only Cycles domain/API files                                          | Pass   | Temporary config removed after verification.                                                                            |
| Focused lint         | ESLint on Cycles domain/API files                                                                           | Pass   | No findings.                                                                                                            |
| Routes               | `npm run check:routes` from repository root                                                                 | Pass   | No dynamic route conflicts.                                                                                             |
| Route budget         | `npm run verify:nonprod-routes`                                                                             | Pass   | 654/654 production dynamic files; estimated 2042/2042 generated routes.                                                 |
| Patch hygiene        | `git diff --check`                                                                                          | Pass   | No whitespace errors.                                                                                                   |
| Local ledger command | `npm run db:migrations:verify-applied -- supabase/migrations/20260731231200_create_plane_cycles_domain.sql` | Pass   | The repository verifier confirms the exact production ledger version.                                                   |
| Commit guard         | Parent cutover focused checks                                                                               | Pass   | The applied schema and exact migration ledger are verified before the corrective application release.                   |

## Migration Application and Ledger Procedure

The migration was applied as part of the approved parent cutover:

1. Confirm the target remains Supabase project `lgveqfnpkxvzbnnwuled`.
2. Review only
   `supabase/migrations/20260731231200_create_plane_cycles_domain.sql`.
3. Apply that exact migration through the Supabase Management API in the
   approved atomic migration batch. Do not use a broad `db push` if unrelated
   pending migrations are present.
4. Verify the production schema and keep the typed server adapter aligned with
   the generated database contract.
5. Run:

   ```bash
   npm run db:migrations:verify-applied -- \
     supabase/migrations/20260731231200_create_plane_cycles_domain.sql
   ```

6. Read back both tables, constraints, RLS policies, grants, and the remote
   migration ledger before wiring the UI.

## Rollback

Rollback is destructive and is allowed only before dependent UI/data releases:

```sql
drop function if exists public.set_cycle_task_memberships(bigint, uuid, uuid[], uuid);
drop table if exists public.cycle_task_memberships;
drop table if exists public.project_cycles;
drop function if exists public.enforce_cycle_task_project_scope();
drop function if exists public.resolve_cycle_task_project_id(uuid);
drop function if exists public.touch_project_cycle_updated_at();
```

After any approved rollback, repair the Supabase migration ledger deliberately,
regenerate types, and verify that the two tables and four functions are absent.

## Remaining Risk

- The migration is applied to production and independently read back. The
  remaining risk is application cutover and authenticated UI regression, owned
  by the parent release task.
- Existing Cycles UI still reads schedule data. UI cutover must wait until the
  migration, live API readback, and parity verification are complete.

## Final Status

- [x] All required domain and migration checklist items are complete; application
      release remains owned by the parent cutover.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly recorded.
- [x] Deferred work includes cause, detection, prevention, owner, and next action.
