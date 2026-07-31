# Plane Drafts replacement depth

Delivery lane: High-risk

## Acceptance contract

- [x] Preserve the Plane Drafts page hierarchy and interaction model from the pinned upstream commit.
- [x] Resolve project scope from the canonical route and keep an explicit prop seam for focused tests.
- [x] Read and mutate only the authenticated user's drafts for an authorized project.
- [x] Fail loudly when project context or draft storage is unavailable; never render a false empty state.
- [x] Keep create, edit, copy, finalize, archive, and delete functional through one dedicated API owner.
- [x] Use 44px mobile action targets while retaining compact desktop controls.
- [x] Preserve slice-local AGPL provenance and the combined deployment source-offer path.
- [x] Focused unit/component/API tests pass.
- [x] Targeted lint passes.
- [ ] Independent review passes.
- [ ] Clean commit is handed to Batch2; no integration, migration, or production publish from this workspace.

## Data and permissions

Existing `public.workspace_artifacts` is sufficient; no migration is required. The dedicated API authorizes every request through `verifyProjectAccess`, then scopes all reads and writes by `project_id`, authenticated `user_id`, and `status='draft'`.

Live type regeneration was attempted with `npx supabase gen types typescript --project-id lnnalnbmftuhiokyogsu --schema public`. It failed because the configured CLI token was malformed; retrying without it failed because no CLI token was available. The checked-in generated types contain both `workspace_artifacts` and `current_has_project_access`, and this slice changes no schema.

## Failure guardrail

Repository errors become specific guarded API responses and the page preserves the visible error plus Retry action. Invalid project context blocks load and mutations explicitly.

## Focused evidence

- `npx vitest run --config src/features/plane-drafts/vitest.config.ts ...`: 4 files, 19 tests passed, covering the model, page mutation payloads, repository compare-and-swap, and API authorization/mutations.
- `npx eslint src/features/plane-drafts src/app/api/plane-drafts --quiet`: passed.

## Review correction: optimistic concurrency

- Localized boundary: request parsing to repository and repository to database. Failing tests proved PATCH stripped/omitted the client version and the database update predicate lacked a version equality filter.
- Root cause: the initial PATCH schema did not require `version`, and `updatePlaneDraft` calculated its version from a prior read without an atomic compare-and-swap predicate.
- Fix: every PATCH mutation now requires the rendered version, passes it as `expectedVersion`, increments from it, and applies `.eq("version", expectedVersion)` in the same update query.
- Failure behavior: a zero-row CAS result returns a specific HTTP 409 `PRECONDITION_FAILED` response instructing the user to reload.
- Regression guardrail: route tests cover create/copy/update/finalize/archive/delete auth/project/user scoping, while repository tests assert the atomic version predicate and loud conflict.
