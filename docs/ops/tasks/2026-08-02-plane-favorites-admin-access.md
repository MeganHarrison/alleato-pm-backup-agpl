# Task: Restore Plane Favorites for App Admins

Status: Complete
Owner: Codex
Created: 2026-08-02
Task ID: PLANE-FAVORITES-ADMIN
Linear Issue: Not created, this is a single-session production bug fix requested directly by the user.
Related Handoff: N/A, single-session delivery.

## Objective

Allow an active Alleato app admin to load and mutate Plane Favorites and Recents for an accessible project without requiring a redundant project or company permission-template assignment.

## Scope

- `current_has_plane_workspace_entity_access` authorization boundary and its migration contract.
- Production database migration, focused API/browser verification, and release evidence.
- Excludes changes to general project access or non-Plane permission helpers.

## Source of Truth

- Canonical runtime/data owner: Supabase project `lgveqfnpkxvzbnnwuled`.
- Existing shared primitives/services: `current_is_app_admin`, `current_has_project_module_permission`, `current_has_project_access`, and `user_workspace_items` RLS.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] An active app admin without project/company templates receives access to project-scoped Plane workspace items.
- [x] Non-admin project access continues to use the existing module/project permission helpers.
- [x] Anonymous callers cannot execute the authorization function.
- [x] Favorites and Recents load without a permission error in authenticated production.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors remain specific and actionable.
- [x] The production migration is applied and its ledger entry is verified.

## Integration and Verification

- [x] Targeted migration contract passes.
- [x] Database readback proves the app-admin branch is installed.
- [x] Authenticated production browser proof shows Favorites and Recents without the denial state.
- [x] Task-owned files are published through the exact-file `codex:finish` closeout.

## Failure-Loudly Contract

- Cause surfaced as: the existing 403 message remains visible when the helper returns false.
- Detection path: authenticated `GET /api/plane-workspace-items?workspace_key=alleato&project_id=31&limit=50` plus production sidebar proof.
- Recovery path: verify the migration ledger and helper definition, then retry the request.

## Incident Learning

- Failure fingerprint: `plane.workspace-app-admin-access-gap`.
- Root cause: The Plane workspace helper delegated generic project entities to `current_has_project_access`, which does not grant app admins without template membership.
- Detection gap: Coverage tested allowed and denied RPC results but not the database helper's app-admin branch.
- Prevention: Migration contract asserts the app-admin grant precedes the project fallback.
- Guardrail evidence: `plane-workspace-items-admin-access-migration.test.ts`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Production sidebar plus direct API comparison | Pass | User session showed 403; refreshed test-admin session returned 200. |
| Account shape | Service-role readback | Pass | Active app admin, active employee identity, no project/company templates. |
| Supabase types gate | Required project-id generation command | Blocked | Configured management token is legacy/invalid; direct DB generation also lacks Docker. Existing generated types contain `user_workspace_items`. |
| Migration contract | `npx jest src/features/plane-workspace-items/__tests__/plane-workspace-items-admin-access-migration.test.ts --runInBand` | Pass | 2 tests passed. |
| Migration readback | Exact ledger and helper query under the user's auth identity | Pass | Version `20260802163000`; app admin, project, and contract access all true. |
| Browser mutation | Favorite Home, navigate, read back, remove | Pass | Production add/readback/delete cycle succeeded without the denial state. |
| Screenshot | `tests/agent-browser-runs/2026-08-02-plane-favorites-admin-access/desktop-favorited.png` | Pass | Favorites section shows the persisted Home item. |
| Repository-wide migration clean gate | `npm run db:migrations:verify-clean` | Unrelated failure | Existing duplicate version `20260729190000` in two unrelated migrations. |

## Remaining Risk

- The existing duplicate local migration version prevents the repository-wide ledger helper from passing, but direct exact-version ledger and live helper readback passed for this task.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred repository debt names its cause and exact conflicting files.

