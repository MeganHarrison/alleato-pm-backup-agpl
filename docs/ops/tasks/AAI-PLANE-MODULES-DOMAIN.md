# Task: Plane Modules domain foundation

Status: Ready for Release Validation
Owner: S20260731-PLANE-MODULES-DOMAIN
Created: 2026-07-31
Task ID: AAI-PLANE-MODULES-DOMAIN
Linear Issue: Parent Plane-to-Alleato program task; no new sub-issue requested.
Related Handoff: Parent task conversation.

## Objective

Create a dedicated Plane-compatible project Modules domain backed by Alleato's
canonical `tasks` lifecycle, replacing the temporary practice of relabeling
`schedule_tasks` as modules without changing the current Modules UI.

## Scope

- One new migration:
  `supabase/migrations/20260731093000_create_plane_project_modules.sql`.
- Static, route-budget-safe API namespace under
  `frontend/src/app/api/plane-modules/**`.
- Typed model, adapter, and React Query hooks under
  `frontend/src/features/plane-modules-domain/**`.
- Focused model, route, migration-contract, and RLS-policy tests.
- No current Modules UI edits, no migration application, no publication, and
  no direct mutation of `schedule_tasks`.

## Source of Truth

- Plane upstream revision:
  `39856932cd6b9bd17eab0920506d628190b47af2`.
- Plane entity model:
  `apps/api/plane/db/models/module.py`.
- Plane validation and membership semantics:
  `apps/api/plane/api/serializers/module.py`.
- Plane service contract:
  `packages/services/src/module/module.service.ts`.
- Plane frontend type:
  `packages/types/src/module/modules.ts`.
- Alleato project access:
  `frontend/src/lib/supabase/auth-guard.ts`.
- Alleato write permissions:
  `frontend/src/lib/permissions-guard.ts`, using the existing `schedule`
  permission module until a separately approved permission-taxonomy change.
- Alleato work-item owner:
  `public.tasks`; `public.schedule_tasks` remains the scheduling/Gantt owner
  linked only through nullable `tasks.schedule_task_id`.

Delivery lane: High-risk

Verification contract: Required

## Workflow and Contract Map

```text
User action: list/create/update/archive a module; assign project members; attach/detach project tasks
Frontend owner component: deferred; current Modules UI is out of scope
Shared primitive/component owner: React Query plus apiFetch
Client state changed: planeModules query cache scoped by projectId
API routes: /api/plane-modules and /api/plane-modules/tasks
Validation schemas: route-local Zod schemas shared from plane-modules-domain contract
Service/helper: canonical verifyProjectAccess and requirePermission
Supabase tables: project_modules, project_module_members, module_task_memberships, tasks, people, project_directory_memberships
Live DB assumptions: projects.id integer; tasks.id uuid; people.id uuid; task project ownership is exclusively tasks.project_id or tasks.project_ids
Side effects on render: GET only
Bulk behavior: member and task membership replacement is validated once and written in bulk
Expected success evidence: focused route/model/policy tests plus later migration ledger and live DB readback
Expected failure behavior: 400 invalid input, 401 unauthenticated, 403 project/permission denial, 404 cross-project entities, 409 duplicate module, explicit 500 guardrail envelope for database errors
```

## Plane Semantics Matrix

| Plane concept             | Alleato contract                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Project-scoped Module     | `project_modules.project_id INTEGER NOT NULL`                                      |
| Name up to 255 characters | Non-empty trimmed name with length check and case-insensitive project uniqueness   |
| Description               | Non-null text defaulting to empty                                                  |
| Status                    | `backlog`, `planned`, `in-progress`, `paused`, `completed`, `cancelled`            |
| Date range                | Nullable `start_date` and `target_date`; start cannot exceed target                |
| Singular lead             | Nullable `lead_person_id UUID -> people.id`; lead must be an active project member |
| Members                   | `project_module_members`; members must be active project directory people          |
| Work items                | `module_task_memberships -> tasks.id`; many-to-many with one module/task pair      |
| Archive                   | Nullable `archived_at`; no lifecycle overloading of task or schedule status        |
| Sort order                | Numeric `sort_order` with deterministic default                                    |

## Proposed Schema

### `project_modules`

- UUID primary key.
- `project_id INTEGER` foreign key to `projects(id)` with cascade delete.
- Name, description, status, lead, start/target dates, sort order, archive
  timestamp, creator/updater UUIDs, created/updated timestamps.
- Status/date/name constraints and case-insensitive project/name unique index.
- Project-scoped indexes for active list, status, target date, and sort order.

### `project_module_members`

- UUID primary key.
- `module_id UUID`, `project_id INTEGER`, and `person_id UUID`.
- Unique module/person pair.
- A trigger rejects a module/project mismatch and people without an active
  `project_directory_memberships` row for the same project.

### `module_task_memberships`

- UUID primary key.
- `module_id UUID`, `project_id INTEGER`, and `task_id UUID`.
- Unique module/task pair.
- A trigger rejects a module/project mismatch and a task that is not owned by
  the project through `tasks.project_id` or `tasks.project_ids`.
- No foreign key, trigger, write, or status mapping targets `schedule_tasks`.

## API Contract

### `/api/plane-modules`

- `GET ?projectId=`: membership-scoped module list with lead/member/task IDs and
  deterministic task counts.
- `POST`: create a module after project write permission, lead/member project
  validation, date/status validation, and duplicate-name handling.
- `PATCH`: update/archive a module identified by `moduleId` in the body after
  verifying it belongs to the supplied project.

### `/api/plane-modules/tasks`

- `PUT`: replace a module's task membership in one validated bulk operation.
- The route rejects tasks from other projects before writing and returns the
  complete deterministic membership list.

All routes are static filesystem paths. No `[moduleId]` or additional dynamic
route cardinality is introduced.

## RLS Contract

- Enable and force row-level security on all three new tables.
- Authenticated reads require:
  `current_is_app_admin() OR current_has_project_access(project_id)`.
- Authenticated mutations require:
  `current_is_app_admin() OR current_has_project_module_permission(project_id, 'schedule', 'write')`,
  so a project membership alone cannot bypass the canonical write level.
- Child policies scope directly through their redundant, trigger-validated
  `project_id`.
- Service role remains available to authenticated API handlers only after the
  canonical access and permission guards pass.
- Focused SQL-contract tests must prove RLS is enabled, policies exist for each
  operation, project predicates are present, and no `schedule_tasks` mutation
  appears.

## Rollback and Ledger

The migration must contain a commented rollback section that drops, in reverse
dependency order:

1. RLS policies.
2. Validation/update triggers.
3. Service RPCs and module validation functions.
4. `module_task_memberships`.
5. `project_module_members`.
6. `project_modules`.

This task intentionally does not apply the migration. The release owner must
apply it deliberately and then run:

```bash
npm run db:migrations:verify-applied -- supabase/migrations/20260731093000_create_plane_project_modules.sql
```

Release is blocked until the linked ledger reports the migration version in the
Remote column and live schema/RLS readback matches the contract.

## Acceptance Criteria

- [x] Supabase types are regenerated from the linked project before database
      code is written.
- [x] The three-table schema, constraints, indexes, triggers, and RLS policies
      match this contract.
- [x] APIs use canonical project access and `schedule` write permission checks.
- [x] Lead, members, modules, and tasks cannot cross project boundaries.
- [x] Member and task replacements are bulk operations, not N client requests.
- [x] The adapter/hook exposes typed list/create/update/task-replacement
      operations without importing current Modules UI.
- [x] Focused model, route, migration, and policy tests pass.
- [x] The migration is explicitly unapplied and ledger verification is deferred
      to release.
- [x] The migration and implementation never mutate `schedule_tasks`.

## Failure-Loudly Contract

- Cause surfaced as: typed guardrail envelopes naming validation, access,
  permission, conflict, cross-project, and database failures.
- Detection path: route tests, SQL source/policy tests, Supabase type
  regeneration, migration ledger verification, and live schema readback.
- Recovery path: correct payload or membership; retry safe reads; obtain valid
  Supabase platform authentication for types; apply/rollback migration through
  the controlled release gate.

## Resolved Type-Generation Blocker

The mandatory type-generation gate failed before product code was written.

```text
npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public
LegacyInvalidAccessTokenError: Invalid access token format
```

With `SUPABASE_ACCESS_TOKEN` removed, the CLI reports
`LegacyPlatformAuthRequiredError`. Supabase connector type/table calls return
`INVALID_ARGUMENT` for the project. The failed shell redirection was restored
exactly from `HEAD`; `frontend/src/types/database.types.ts` is clean.

Cause: the available `SUPABASE_ACCESS_TOKEN` is not a valid Supabase personal
access token and no authenticated CLI profile or connector project access is
available.

Detection gap: the workspace had a token-shaped environment variable but no
preflight validated that it was a platform PAT before the required generation
command.

Prevention: add a non-secret Supabase CLI authentication preflight before
redirecting generated output, and generate to a temporary file before replacing
the canonical type file.

Resolution: the repository instruction referenced a stale Supabase project.
The connected production project is `lnnalnbmftuhiokyogsu` (`Alleato PM APP`).
The Supabase connector successfully regenerated its current TypeScript
contract. Focused readback verified `projects.id` is `number`, `tasks.id` is
`string`, `tasks.project_id` is `number | null`, `tasks.project_ids` is
`number[] | null`, `people.id` is `string`, and
`project_directory_memberships.project_id/person_id` are `number`/`string`.
The full generated output was not written to logs or chat.

## Evidence

| Check                                    | Command / artifact                                                                         | Result         | Notes                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Isolated ownership                       | `isolated-session-workspace.mjs create`                                                    | Pass           | Exact migration, API, domain feature, and task paths claimed.                                                                    |
| Required base                            | `git rev-parse HEAD`                                                                       | Pass           | Reset and verified at `personal-production/main` revision `0cfcb14af75bce6b63370b07de476287d7b9838e`.                            |
| Initial stale-reference type attempt     | Repository-documented CLI command                                                          | Failed safely  | Invalid platform access token for the stale project reference; canonical generated types restored cleanly before implementation. |
| Live type regeneration                   | Supabase connector on `lnnalnbmftuhiokyogsu`                                               | Pass           | Relevant FK types read back without exposing the full generated output.                                                          |
| Plane contract inspection                | Upstream model/serializer/types/services                                                   | Pass           | Entity, member, lead, task-link, status, date, archive, and uniqueness semantics mapped.                                         |
| Focused unit/route/policy contract tests | `npm run test:unit -- --runInBand --silent --runTestsByPath ...`                           | Pass           | 4 suites, 20 tests.                                                                                                              |
| Focused lint                             | `eslint src/features/plane-modules-domain/**/*.{ts,tsx} src/app/api/plane-modules/**/*.ts` | Pass           | No warnings or errors.                                                                                                           |
| Static route gate                        | `npm run check:routes` from repository root                                                | Pass           | No dynamic route conflicts.                                                                                                      |
| Diff integrity                           | `git diff --check`                                                                         | Pass           | No whitespace errors.                                                                                                            |
| Independent high-risk review             | Read-only reviewer                                                                         | Pass after fix | Removed a document-metadata ownership fallback and completed the rollback procedure plus regression assertions.                  |
| Local commit hook                        | `git commit -m "Add Plane modules domain foundation"`                                      | Blocked        | Product gates passed through phantom-table checks; shared project-map generation is required outside this session's exact lease. |
| Migration application                    | Not run by instruction                                                                     | Deferred       | No remote schema, ledger, data, or production state changed.                                                                     |

## Remaining Risk

- SQL behavior has static contract coverage but has not yet been executed
  against a disposable PostgreSQL database.
- The later release must apply and verify the migration before any Modules UI
  consumes the new domain, regenerate the canonical database types after the
  migration, then run authenticated API and RLS readback.
- Broader typecheck, authenticated end-to-end testing, and visual parity remain
  part of the parent program's batched release checkpoint.
- Local commit publication is waiting on the integration owner to regenerate
  `docs/architecture/PROJECT-MAP.md` and
  `frontend/src/lib/app-surface/app-surface.generated.json`. The ownership gate
  cannot expand an existing isolated session, and this session did not bypass
  exact-path ownership or the commit hook.

## Final Status

- [x] Implementation acceptance criteria complete for the intentionally
      unapplied foundation.
- [x] The resolved type-gate failure records cause, detection gap, prevention,
      exact failing command, owner, and smallest next action.
- [x] Migration remains unapplied and production remains unchanged.
