# Task: Plane Tasks Detail Authorization Consistency

Status: Ready for Integration
Owner: S20260731-TASKS-DETAIL-AUTH
Created: 2026-07-31
Task ID: AAI-PLANE-TASKS-DETAIL-AUTH
Linear Issue: Parent Plane-to-Alleato program coordination owns external tracking.
Related Handoff: Parent integration checkpoint; no separate worker handoff requested.

## Objective

Require every Tasks detail PATCH and DELETE mutation to resolve one canonical
project, verify the authenticated user's access to that project, and only then
use the authorized service client to mutate the task.

## Scope

- `frontend/src/app/api/tasks/[taskId]/route.ts`
- `frontend/src/app/api/tasks/[taskId]/__tests__/route.test.ts`
- `frontend/src/app/api/tasks/task-project-resolution.ts`
- This task document
- Excludes changes to the membership-wide Tasks write policy.
- Excludes publication, production mutation, and shared app-surface map updates.

## Source of Truth

- Canonical runtime/data owner: Supabase `tasks` rows and the Tasks API.
- Existing shared primitives/services:
  - `frontend/src/lib/supabase/auth-guard.ts`
  - `frontend/src/lib/supabase/service-db.ts`
  - `frontend/src/app/api/tasks/route.ts`
- Deprecated or parallel paths: legacy `tasks.project_ids` and
  `document_metadata.project_id` are supported only as ordered ownership
  fallbacks when `tasks.project_id` is absent.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] PATCH and DELETE reject malformed task UUIDs before authentication or data access.
- [x] Direct `project_id` takes precedence over legacy associations.
- [x] A single legacy `project_ids` value is accepted when direct ownership is absent.
- [x] Document metadata is accepted only when task-level ownership is absent.
- [x] Conflicting, multi-project, invalid, and unscoped associations fail before mutation.
- [x] Unauthenticated, cross-project, and policy-denied requests fail before mutation.
- [x] Missing tasks retain 404 semantics before authorization and after mutation races.
- [x] Moving a task to another project requires access to the target project.
- [x] Clearing project ownership is rejected before service-role mutation.
- [x] The current membership-wide Tasks write policy is explicit and unchanged.
- [x] Failure-loudly behavior is defined.
- [x] Legacy paths remain only as documented compatibility fallbacks.

## Implementation Checklist

- [x] Files/modules to change are listed.
- [x] Shared project resolution owns direct and legacy association handling.
- [x] Errors are specific and actionable.
- [x] Authentication and project authorization occur before service-role mutation.
- [x] Checked-in generated types confirm `tasks.id` is a string UUID,
  `project_id` is `number | null`, and `project_ids` is `number[] | null`.

## Integration and Verification

- [x] Focused Jest coverage passes: 19 tests.
- [x] Focused ESLint passes.
- [x] `git diff --check` passes.
- [x] Independent review found the null-project orphaning path; the finding is
  fixed and covered by a regression test.
- [ ] Production release evidence is pending parent integration.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.
  Publication is intentionally excluded from this local-commit slice.

## Failure-Loudly Contract

- Cause surfaced as: 400 for invalid task IDs, 401 for missing authentication,
  403 for project denial, 404 for missing tasks, 409 for ambiguous or unscoped
  project ownership, and guarded internal errors for failed association reads.
- Detection path: focused route tests assert that authorization precedes all
  PATCH and DELETE mutations.
- Recovery path: repair the task's canonical `project_id` or legacy association,
  or grant the user active membership in the resolved project.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The detail route authenticated users but previously mutated
  through an unscoped client without first resolving and authorizing the task's
  project.
- Detection gap: Existing focused coverage validated request values but did not
  assert the authorization-before-mutation sequence.
- Prevention: Centralized project resolution plus route tests for direct,
  legacy, ambiguous, unauthenticated, denied, invalid-ID, and not-found paths.
- Guardrail evidence: 19 focused Jest tests and focused ESLint.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | `node .../jest.js --config jest.config.js --no-cache --runInBand --silent --runTestsByPath src/app/api/tasks/[taskId]/__tests__/route.test.ts` | Pass | 19 tests; direct, legacy-array, metadata, conflict, authentication, denial, UUID, reassignment, null-project rejection, and not-found paths. |
| Independent review | Review of local commit `f84ad7436` | Finding fixed | Review identified that `{ project_id: null }` could orphan a task; the PATCH schema now rejects it with 400 before mutation. |
| Focused lint | `eslint ...route.ts ...route.test.ts ...task-project-resolution.ts --quiet` | Pass | No lint findings. |
| Patch hygiene | `git diff --check` | Pass | No whitespace errors. |
| Supabase types gate | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Blocked | Local token rejected as `LegacyInvalidAccessTokenError: Invalid access token format. Must be like sbp...`; redirected error output was detected and the generated types file was restored unchanged. Checked-in types were inspected instead. |

## Remaining Risk

- The current product policy permits any active project member to mutate Tasks.
  Role-based or granular write restrictions require a separate product-policy
  decision; this slice does not invent a nonexistent `tasks` permission module.
- Live type regeneration remains blocked by the malformed local Supabase CLI
  token. Detection: the generation command fails before schema access.
  Prevention: repair the secure CLI credential before the next database-code
  change. Owner: environment/platform setup.
- The shared app-surface map files are intentionally deferred to the parent's
  combined API integration checkpoint:
  `docs/architecture/PROJECT-MAP.md` and
  `frontend/src/lib/app-surface/app-surface.generated.json`.
- Production release evidence remains a parent-owned gate before deployment.

## Final Status

- [ ] All required checklist items are complete; integration and release remain.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly recorded.
- [x] Deferred work includes cause, detection, prevention, owner, and next action.
