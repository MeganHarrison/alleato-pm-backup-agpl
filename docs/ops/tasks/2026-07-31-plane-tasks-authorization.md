# Task: Plane Tasks Project Authorization

Status: Ready for Integration
Owner: S20260731-PLANE-TASKS-AUTH
Created: 2026-07-31
Task ID: AAI-PLANE-TASKS-AUTH
Linear Issue: Not requested; parent Plane integration program owns external tracking.
Related Handoff: Parent Plane integration thread

## Objective

Project members can read and create project work items while direct requests for
projects they cannot access fail before any service-role task query or mutation.

## Scope

- `frontend/src/app/api/tasks/route.ts`
- `frontend/src/app/api/tasks/__tests__/route.test.ts`
- Project-scoped GET and POST only; task-detail PATCH/DELETE are explicitly excluded.

## Source of Truth

- Canonical runtime/data owner: `public.tasks`
- Existing shared primitives/services: `verifyProjectAccess`,
  `createServiceClient`, generated `Database` types
- Deprecated or parallel paths: global non-project task reads remain unchanged

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Ordinary project members can request `scope=all` inside an authorized project.
- [x] Cross-project GET and POST requests stop at `verifyProjectAccess`.
- [x] Authorized admins retain project task access through the canonical guard.
- [x] Unauthenticated requests fail before authorization or task data access.
- [x] Invalid project identifiers fail loudly instead of falling through to a global query.
- [x] Project identifiers use the strict positive PostgreSQL `int4` contract on
  GET and POST; JSON strings, booleans, arrays, decimals, zero, trailing text,
  and out-of-range values are rejected.
- [x] The document-metadata fallback can only recover legacy tasks whose direct
  `project_id` is null and whose `project_ids` is null or empty.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Focused route tests pass.
- [x] Actual request boundary is proved with focused handler tests.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are committed locally; the parent integrator explicitly
  authorized skipping the project-map hook for this isolated commit because the
  generated outputs are owned by the combined API integration checkpoint.
- [ ] Parent integration review and production publication are complete.

## Failure-Loudly Contract

- Cause surfaced as: 401 for missing identity, 403 for missing project access,
  and 400 for invalid project identifiers.
- Detection path: focused Jest route tests assert no service-role task query or
  insert occurs after denial.
- Recovery path: authenticate and request a project where the caller has active
  access; administrators continue through the same canonical guard.

## Incident Learning

- Failure fingerprint: N/A. The learning-registry lookup found no direct match;
  this is the first localized occurrence.
- Root cause: The project Tasks collection route treated `scope=all` as a global
  admin capability even when a project was supplied, while its service-role
  POST trusted the caller-supplied project ID.
- Detection gap: No focused collection-route authorization tests existed.
- Prevention: Require `verifyProjectAccess` before project-scoped service-role
  reads or writes and lock the boundary with denial-before-data tests.
- Guardrail evidence: Twenty focused handler tests cover success and denial paths,
  including assertions that denied requests never reach the service-role task
  query or insert, every service-role read builder carries its project predicate,
  conflicting project associations are excluded, and non-canonical project IDs
  fail before authorization.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | High-risk scope and acceptance contract captured before product edits. |
| Types gate | `frontend/src/types/database.types.ts` | Pass | Verified `tasks`, `projects`, `project_directory_memberships`, `user_profiles`, and `users_auth`. |
| Runtime localization | Work Items request versus `/api/tasks` handler | Pass | Client sends project `scope=all`; handler rejects non-admin before project authorization and POST inserts with service role after authentication only. |
| Focused route tests | `npm run test:unit -- --runInBand --runTestsByPath "src/app/api/tasks/__tests__/route.test.ts"` | Pass | 1 suite, 20 tests passed. Covers ordinary member success, cross-project denial, admin access, unauthenticated denial, strict int4 IDs, all three project-scoping predicates, and conflicting-association isolation. |
| Focused lint | `npx eslint "src/app/api/tasks/route.ts" "src/app/api/tasks/__tests__/route.test.ts"` | Pass | The isolated workspace initially lacked `eslint-plugin-storybook`; lint passed using the canonical checkout's installed dependency tree through a temporary junction, which was removed afterward. |
| Patch integrity | `git diff --check` | Pass | No whitespace errors. |
| Local commit gate | `git commit -m "Authorize project-scoped task access"` | Deferred to integration | The mandatory project-map gate requires `npm run map:project` and staging `docs/architecture/PROJECT-MAP.md` plus `frontend/src/lib/app-surface/app-surface.generated.json`; those generated paths are outside this session's ownership. The parent integrator explicitly authorized `git commit --no-verify` for this isolated slice and owns regenerating both outputs plus running the full gate after all API commits are combined. |
| Independent review corrections | Review findings P1/P2 plus builder-contract follow-up | Pass | Added the direct-project null guard to the metadata fallback, retained/asserted all three service-role query builders, and replaced coercion/safe-number validation with strict positive int4 validation. |

## Remaining Risk

- Task-detail PATCH/DELETE authorization and scheduling write permissions remain
  separate follow-up work owned by the Plane integration program.
- Independent review, integration into `personal-production/main`, and
  production release evidence remain owned by the parent Plane integration
  program. This workspace must not publish independently.
- Integration recovery: the parent integrator will regenerate the two
  project-map artifacts after combining the API slices, stage them, and run the
  full gate before publication. The initial commit hook detected the stale
  generated inventory; batching map generation prevents concurrent ownership
  conflicts while preserving the release guardrail.

## Final Status

- [ ] All required checklist items are complete. Parent review and release remain open.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
