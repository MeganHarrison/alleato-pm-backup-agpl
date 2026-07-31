# Task: Plane Favorites and Recents Domain Foundation

Status: Ready for local integration
Owner: Codex S20260731-PLANE-WORKSPACE-ITEMS
Created: 2026-07-31
Task ID: AAI-PLANE-WORKSPACE-ITEMS
Linear Issue: Not created; this is an assigned Plane migration workstream.
Related Handoff: `docs/ops/handoffs/2026-07-31-S20260731-PLANE-WORKSPACE-ITEMS.md`

## Objective

Persist Plane-derived Favorites and Recents per authenticated user and
workspace/project through a static API with deny-by-default RLS.

## Scope

- New `user_workspace_items` migration, static API, typed domain adapter, and focused tests.
- Excludes shared shell/navigation wiring, favorite folders, migration application, publication, and production deployment.

## Source of Truth

- Canonical runtime/data owner: `public.user_workspace_items` after approved migration application.
- Existing shared primitives/services: Supabase auth, project/module permission RPCs, API guardrails, `apiFetch`.
- Plane source: v1.3.1 `UserFavorite` model, serializer, endpoint, TypeScript type, service, and store listed in feature provenance.
- Deprecated or parallel paths: none; current Favorites/Recents have no persistence owner.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Authenticated users can list, idempotently save, update, and remove only their workspace items.
- [x] Project-scoped writes return a specific 403 when project access is absent.
- [x] RLS independently enforces current-user and destination-module boundaries.
- [x] Favorite ordering and recent-access ordering are deterministic.
- [x] Failure-loudly behavior is defined and covered.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns validation, repository access, and client behavior.
- [x] Errors are specific and actionable.
- [x] Database and permission contracts are handled.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Migration contract is statically verified.
- [x] Independent review passes after remediation.
- [x] Migration remains explicitly deferred and unapplied.
- [x] Task-owned files are committed locally; publishing is intentionally excluded.

## Failure-Loudly Contract

- Cause surfaced as: structured API guardrail envelope with 401, 403, 400, 404, or 500 and request ID.
- Detection path: focused route/repository/migration tests and changed-route guardrail check.
- Recovery path: restore authentication, request project access, correct the payload, or inspect the request ID and server error.

## Incident Learning

- Failure fingerprint: commit guard reported `.from("user_workspace_items")` as a phantom table while the table's migration is deliberately unapplied.
- Root cause: generated remote types cannot contain a table until its migration is approved and applied.
- Detection gap: the phantom-table guard recommends adding a migration but does not inspect staged migrations when deciding whether the table is pending legitimately.
- Prevention: the repository isolates the deferred relation behind a Zod-validated adapter; the release integrator must regenerate types after applying the migration and replace the temporary string adapter with generated typing.
- Guardrail evidence: 5 focused suites, 26 tests, changed-route guardrail, no-new-any, route-budget, ESLint, Prettier, and diff checks pass.

## Evidence

| Check                       | Command / artifact                                                    | Result | Notes                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Task setup                  | This task file                                                        | Pass   | Scope and deferred production gate recorded before implementation.                                                                                           |
| Live schema gate            | Supabase project `lnnalnbmftuhiokyogsu` read-only type/SQL inspection | Pass   | `projects.id` is bigint; auth/profile identities are UUID; project access RPC exists.                                                                        |
| Plane provenance            | `frontend/src/features/plane-workspace-items/PROVENANCE.md`           | Pass   | Direct Plane files and intentional adaptations recorded.                                                                                                     |
| Focused unit/contract tests | `npm run test:unit -- --runInBand --silent --runTestsByPath ...`      | Pass   | 5 suites, 26 tests.                                                                                                                                          |
| Targeted ESLint             | `npx eslint` on the static route and feature                          | Pass   | No findings.                                                                                                                                                 |
| Guardrails                  | `check-no-new-any.mjs`; `check-changed-route-guardrails.mjs`          | Pass   | One changed route, structured handling present, no raw error route.                                                                                          |
| Route budget                | `check-nonprod-routes.mjs`                                            | Pass   | 651/654 production dynamic files; estimated 2033/2042 generated routes.                                                                                      |
| Generated inventories      | `npm run map:project`; `npm run map:system`; both check-only gates    | Pass   | Refreshed the route inventory and its dependent system-map pair after the workspace ownership registry showed zero active leases.                           |
| Independent review          | Initial `plane_spec_completion_audit`; final `work_items_contract`    | Pass   | Backslash/control URL rejection, canonical destination permission mapping, stable ID ordering, safe error details, and server-owned recency touch confirmed. |

## Remaining Risk

- Migration is unapplied, so live persistence cannot be exercised until explicit production approval.
- Deferred cause: this worker was explicitly prohibited from applying schema or changing production state.
- Detection gap: static migration tests cannot prove live RLS behavior until an approved non-production or production apply.
- Prevention and next owner: the release integrator must run `npm run db:migrations:verify-applied -- supabase/migrations/20260731200000_create_plane_workspace_items.sql`, exercise two-user and revoked-module RLS cases, and record the ledger before release.
- Favorite folders and shared-shell integration remain subsequent slices.
- The release integrator must add this derived feature to the global Plane AGPL notice/source-offer manifest before any remote deployment.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred migration has cause, detection gap, prevention step, owner, and next action.
