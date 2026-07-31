# Task: Plane-derived Stickies foundation

Status: Pending Review
Owner: S20260731-PLANE-STICKIES
Created: 2026-07-31
Task ID: AAI-PLANE-STICKIES
Linear Issue: Parent program AAI-1286, https://linear.app/megankharrison/issue/AAI-1286
Related Handoff: `docs/ops/handoffs/2026-07-31-S20260731-PLANE-STICKIES-plane-stickies.md`

## Objective

Provide a directly Plane-derived, responsive Stickies page foundation backed
by authenticated personal, workspace, and project-scoped Supabase persistence.

## Scope

- New `frontend/src/features/plane-stickies/**` domain and page component.
- New static `frontend/src/app/api/plane-stickies/**` API.
- Deferred migration `20260731231400_create_plane_stickies.sql`.
- AGPL provenance, focused tests, and worker handoff.
- Excludes workspace dispatcher/navigation integration, production migration,
  deployment, and generated maps.

## Source of Truth

- Canonical runtime/data owner: `public.plane_stickies` after approved migration.
- Existing shared primitives/services: `components/ui`, `lib/guardrails`,
  `lib/supabase`, `lib/permissions-guard`.
- Plane upstream templates: pinned in `frontend/src/features/plane-stickies/PLANE-NOTICE.md`.
- Deprecated or parallel paths: None. No legacy Stickies implementation exists.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Plane header, search, add action, colored card layout, inline editing, and
      delete confirmation are preserved as the visual/interaction base.
- [x] Personal, workspace, and project scopes are explicit and owner-isolated.
- [x] Create, edit, pin, archive/restore, and delete are optimistic with rollback.
- [x] Project access and Documents write permission guard project-scoped data.
- [x] Missing migration returns a specific, actionable HTTP 503 response.
- [x] Focused tests and lint pass.
- [x] Independent review is complete.
- [ ] Integration route is wired and browser evidence is captured by the leader.

## Implementation Checklist

- [x] Files/modules to change were listed and leased before edits.
- [x] Shared API/repository contracts own persistence behavior.
- [x] Errors are specific and actionable without raw database details.
- [x] RLS, grants, ownership, and project permission contracts are encoded.
- [x] Exact Plane source paths and copyright/license headers are retained.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [ ] Actual user-flow readback is deferred to dispatcher integration because
      this task intentionally owns no route or shared shell.
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals the integration branch.

## Failure-Loudly Contract

- Cause surfaced as: HTTP 503 and a single UI alert stating the Stickies
  migration must be applied.
- Detection path: API route test and visible page alert with one Retry action.
- Recovery path: approve and apply the exact migration, regenerate Supabase
  types, remove the temporary repository adapter, then reload the page.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Focused contracts cover missing relation, owner isolation, and
  deterministic ordering before integration.
- Guardrail evidence: Focused Jest suites recorded below after execution.

## Evidence

| Check                | Command / artifact                                                  | Result   | Notes                                                                                                      |
| -------------------- | ------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| Live type generation | Supabase MCP `generate_typescript_types` for `lnnalnbmftuhiokyogsu` | Passed   | `projects.id` is bigint; `plane_stickies` is absent before migration.                                      |
| Focused Jest         | Four exact-path suites, run serially                                | Passed   | 4 suites, 16 tests passed.                                                                                 |
| Responsive UI Vitest | `vitest run --config src/features/plane-stickies/vitest.config.ts`  | Passed   | 1 file, 6 tests passed.                                                                                    |
| Focused ESLint       | `eslint src/features/plane-stickies src/app/api/plane-stickies`     | Passed   | 0 errors and 0 warnings.                                                                                   |
| Independent review   | Read-only security, migration, UI race, and AGPL review             | Passed   | Two UI races found, fixed, and covered by regression tests.                                                |
| Commit hook          | `git commit -m "Add Plane Stickies foundation"`                     | Deferred | Shared generated project maps are outside this isolated lease; the integration owner must regenerate them. |
| Migration ledger     | Not applied                                                         | Deferred | Production state is intentionally unchanged.                                                               |

## Remaining Risk

- The migration is intentionally unapplied per the leader's instruction even
  though its approval gate is cleared; route integration must retain the
  visible 503 state until the release owner applies and verifies it.
- Browser screenshots require the leader's dispatcher integration slice.
- The shared project map is intentionally not changed in this isolated lease;
  the integration commit must regenerate it after wiring the route.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred migration and integration work name their next owner action.
