# Task: Training Admin Table Pages

Status: Implementation Complete; Authenticated Browser Proof Blocked
Owner: STRAININGTABLES
Created: 2026-07-27
Task ID: training-admin-table-pages
Linear Issue: Not created; this is a single-session local task.
Related Handoff: `docs/ops/handoffs/2026-07-27-STRAININGTABLES-training-admin-table-pages.md`

## Objective

Provide authenticated app administrators with one shared, editable
`UnifiedTablePage` surface for every training-owned database table.

## Scope

- Resource library: `training_resource`, `training_role`, `training_topic`,
  `training_resource_role`.
- Skill Wheel: `training_role_skill`, `training_skill_checkin`.
- Training Docs: `training_docs`, `training_doc_assets`,
  `training_doc_steps`, `training_doc_relations`.
- Shared allowlisted CRUD API, edit/create form, filters, sorting, pagination,
  column visibility, CSV export, row delete, and bulk delete.
- Excludes shared `conversations`, `chat_history`, and RAG tables because their
  ownership is broader than training.

## Source of Truth

- Canonical runtime/data owner: Supabase public training tables.
- Existing shared primitives/services:
  `frontend/src/components/tables/unified`,
  `frontend/src/app/api/admin/training-docs/_shared.ts`.
- Deprecated or parallel paths: Existing `/training-docs` authoring workflow is
  retained; the new surface exposes database administration without replacing
  its generation/publishing workflow.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Each of the ten training-owned tables has a navigable admin table page.
- [x] Search, sorting, pagination, column visibility, filters, and CSV export
  use `UnifiedTablePage`.
- [x] Create, edit, single delete, and bulk delete call real allowlisted APIs
  and invalidate the table query.
- [x] Foreign keys use human-readable select options.
- [x] Admin authorization is enforced on pages and API routes.
- [x] Invalid table names, payloads, constraints, and stale records fail loudly.
- [ ] Focused tests and authenticated browser proof cover the changed boundary.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Authentication, permission, relationship, and destructive-operation
  contracts are handled.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Authenticated browser proof covers a list, edit, create, and delete path.
- [x] Evidence artifacts are recorded.
- [x] Independent review is complete.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: operation, training table label, record identifier, and
  Supabase or validation message.
- Detection path: API error response, table error state, destructive-action
  confirmation, focused API tests, and authenticated browser flow.
- Recovery path: correct the highlighted field, refresh a stale table, or
  resolve the named foreign-key/dependency before retrying.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: table allowlist plus per-table schemas and API tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Supabase types | `npx supabase gen types ...` | Blocked | Remote command did not produce types; exact `origin/main` generated file restored and existing table contracts inspected. |
| Focused tests | `npx jest src/features/training-admin/__tests__ --runInBand` | Pass | 3 suites, 19 tests passed. |
| Focused lint | `npx eslint ...training-admin...` | Pass | No errors or warnings. |
| Route gate | `npm run check:routes` | Pass | Dynamic route naming is valid. |
| Guardrails | `npm run typecheck:changed`; `npm run guardrails:unsafe-patterns` | Pass | No changed-scope type or unsafe-pattern failures. |
| Live data readback | Supabase row counts for all ten allowlisted tables | Pass | Counts: 97, 6, 27, 270, 53, 2, 91, 124, 118, and 18. |
| Route runtime | `/training-data/training_resource` local compile | Pass | Next.js compiled the dynamic route successfully. |
| Access guard | `tests/agent-browser-runs/training-admin-table-pages/admin-access-guard.png` | Pass | Non-owner session failed closed; route and API now enforce the same owner-only contract as navigation. |
| Authenticated CRUD browser proof | `scripts/verify/agent-browser-auth.mjs --role admin` | Blocked | `ADMIN_E2E_EMAIL` and `ADMIN_E2E_PASSWORD` are not configured. |
| Repository TypeScript | `node --max-old-space-size=24576 ./node_modules/typescript/bin/tsc --noEmit --pretty false --skipLibCheck` | Baseline debt | 275 unrelated diagnostics; no diagnostics in changed files. |

## Remaining Risk

- Authenticated owner CRUD browser proof remains blocked because the secure
  admin E2E credentials are unavailable. Owner: environment configuration.
  Next action: configure the existing `ADMIN_E2E_EMAIL` and
  `ADMIN_E2E_PASSWORD` secret inputs, then execute list/create/edit/delete proof.
- Destructive Training Docs asset deletion uses reversible storage quarantine:
  storage objects move before the database mutation, restore if the database
  mutation fails, and purge only after it succeeds.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and
  next action.
