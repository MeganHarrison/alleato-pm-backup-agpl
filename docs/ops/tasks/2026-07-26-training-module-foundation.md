# Task: Training Module Foundation

Status: Pending Publication — ALL-17 Seed Deferred
Owner: Codex S220
Created: 2026-07-26
Task ID: ALL-15 through ALL-18
Linear Issue: [ALL-16](https://linear.app/alleato-group/issue/ALL-16/t2-supabase-schema-migration-for-training-tables)
Related Handoff: `docs/ops/handoffs/2026-07-26-S220-training-module-foundation.md`

## Objective

Establish the applied, permission-safe data contract for the learner-facing
Training module so the concurrent UI and later Resource Finder lanes consume
one typed source of truth.

## Scope

- Lock the six integration decisions from ALL-15 in
  `specs/training-module-spec.md`.
- Create and apply the canonical `training_role`, `training_topic`,
  `training_resource`, and `training_resource_role` schema with constraints,
  indexes, timestamps, and RLS.
- Regenerate `frontend/src/types/database.types.ts`.
- Add server-only typed training read helpers under
  `frontend/src/lib/training/`.
- Add a deterministic seed migration after Claude S221 supplies the normalized
  source resource file and count evidence.
- Exclude learner-facing routes, components, MDX guide content, navigation,
  Resource Finder backend work, and Render cron configuration.

## Source of Truth

- Canonical runtime/data owner: Supabase public training tables.
- Existing shared primitives/services:
  `public.current_is_app_admin()`,
  `frontend/src/lib/supabase/server.ts`,
  `frontend/src/lib/supabase/service.ts`,
  `frontend/src/app/api/users/me/profile/route.ts`.
- Deprecated or parallel paths: existing `training_docs` tables remain the
  workflow-manual authoring system and are not replaced by this resource
  library.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The six ALL-15 decisions are explicit and implementation-ready.
- [x] The four training resource tables apply cleanly with FK, uniqueness,
      free-only, status, type, level, track, and timestamp constraints.
- [x] Authenticated users can read published resources and taxonomy rows.
- [x] App admins can read review/archive rows and create, publish, or archive
      resources; non-admin writes fail closed.
- [x] Service-role jobs can create review rows only through the atomic
      review-candidate RPC without bypassing free-only, deduplication, or role
      targeting constraints.
- [x] Viewer role suggestion reuses the current profile `title` sourced from
      `people.job_title`; ambiguous or absent matches leave the manual selector
      unset.
- [x] Typed server helpers implement role, track, type, level, status, and
      search filters without exposing privileged credentials.
- [x] Migration and live ledger evidence prove the remote schema matches the
      generated types.
- [x] Missing Claude source assets block only the seed migration and are
      reported explicitly; no source data is invented.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned files:

- `specs/training-module-spec.md`
- `supabase/migrations/20260726143515_create_training_resource_library.sql`
- `supabase/migrations/20260726143516_seed_training_resource_library.sql`
- `supabase/tests/training_resource_library.sql`
- `frontend/src/types/database.types.ts`
- `frontend/src/lib/training/**`
- This task and its S220 handoff
- S220 orchestration rows

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: migration constraint/RLS failure, typed helper query error,
  missing seed source, or remote-ledger mismatch with a named table/filter/file.
- Detection path: focused SQL/RLS tests, typed helper tests, live Supabase
  information-schema readback, and
  `npm run db:migrations:verify-applied -- <migration>`.
- Recovery path: correct the owning migration/helper, reapply only the scoped
  migration, regenerate types, and rerun the failed readback. Never weaken RLS
  or invent missing source records.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | High-risk scope and done gate captured before migration work. |
| Linear source | ALL-15 through ALL-18 descriptions and ALL-15 decision comment | Pass | Product decisions and dependency order read back through Linear GraphQL. |
| Source asset discovery | Repository and accessible GitHub organization scan | Blocked input | Standalone spec, `resources.js`, and guide source are not present in this checkout; Claude S221 owns recovery. |
| Live baseline type generation | `vercel env run -e production -- npx supabase gen types ...` | Pass | Confirmed no pre-existing resource-library tables; `people.job_title`, `user_profiles.is_admin`, and the current admin RLS helper exist. |
| Pre-apply schema/RLS contract | Management API transaction containing migration + `supabase/tests/training_resource_library.sql` + rollback | Pass | DDL, constraints, learner visibility, active-admin publish/archive, RPC-only service candidate creation, and negative writes all passed without persisting objects. |
| Independent pre-apply review | `/root/training_schema_review` | Pass | First two reviews caught generic service writes and published retagging; both were replaced by the atomic RPC. Final review approved with no blocking findings. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260726143515_create_training_resource_library.sql` | Pass | Exact version `20260726143515` is applied remotely; no broad migration push was used. |
| Live schema/RLS readback | Supabase Management API catalog + privilege query | Pass | Four tables, four RLS-enabled relations, eight policies, exact enum members, zero rows, service RPC execute=true, service direct insert=false, authenticated RPC execute=false. |
| Generated types | Secure post-migration `supabase gen types`; `npm run db:types:check` | Pass | Four tables, the review-candidate RPC, and enum unions are present; checked file matches the live schema. |
| Focused helper tests | Jest role-resolution + data-access suites | Pass | 2 suites, 14 tests. |
| Focused lint | ESLint on `frontend/src/lib/training/**` TypeScript | Pass | Zero errors. |
| Bounded full typecheck | `cd frontend && npm run typecheck` with training-path log filter | Unrelated repo debt | Exit 1 from pre-existing errors across admin, AI, reports, and API owners; zero diagnostics under `src/lib/training/**`. |
| Verification contract | Contract verifier + strict review-queue verifier | Pass | Required high-risk evidence and independent approval are bound to this task. |

## Remaining Risk

- The seed source and exact source counts depend on Claude S221 recovering the
  separate Alleato-Training-Platform assets. Claude exhaustively confirmed the
  export and three handbooks are not reachable from the repo, GitHub org, local
  filesystem, Linear, or Microsoft 365. Owner: Brandon/source holder. Next
  action: provide `data/resources.js` (or the standalone export) and the three
  guide sources; then run the checked-in normalizer and author the idempotent
  seed keyed by URL.

## Final Status

- [x] All required non-deferred checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred work has cause, detection gap, prevention step, owner, and next action.
