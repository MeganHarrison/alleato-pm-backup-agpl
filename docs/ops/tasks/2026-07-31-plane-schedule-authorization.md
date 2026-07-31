# Task: Plane Schedule Mutation Authorization

Status: Ready for Integration
Owner: S20260731-PLANE-SCHEDULE-AUTH
Created: 2026-07-31
Task ID: AAI-PLANE-SCHEDULE-AUTH
Linear Issue: Parent Plane integration program owns external tracking.
Related Handoff: Parent Plane integration thread

## Objective

Project members retain schedule read access, while schedule task POST, PUT, and
DELETE operations require the canonical project `schedule:write` permission
before any task mutation can run.

## Scope

- `frontend/src/app/api/projects/[projectId]/scheduling/tasks/route.ts`
- `frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/route.ts`
- Focused tests beside those routes
- GET remains read-only and behavior-compatible.
- PATCH intents are outside this slice because Cycles and Modules use the
  collection POST and detail PUT/DELETE contracts.

## Source of Truth

- Canonical runtime/data owner: `public.schedule_tasks`
- Existing shared permission primitive: `requirePermission`
- Permission contract: project module `schedule`, level `write`
- Generated type evidence: `schedule_tasks.project_id` is a PostgreSQL integer
  represented as TypeScript `number`.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] A project member with read but not write access can still GET schedule
  tasks and receives 403 for POST, PUT, and DELETE.
- [x] A caller with `schedule:write` can create, update, and delete schedule tasks.
- [x] Cross-project and unauthenticated callers fail before mutation services run.
- [x] Invalid project IDs fail before permission or mutation access.
- [x] Malformed schedule task UUIDs fail before permission or mutation access.
- [x] Existing GET behavior remains unchanged.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Authentication and permission contracts are enforced server-side.

## Integration and Verification

- [x] Focused route tests pass.
- [x] Actual handler boundary is proved.
- [x] Focused lint passes.
- [x] Patch integrity passes.
- [x] Task-owned files are committed locally with the parent-authorized
  `--no-verify` exception for shared project-map outputs.
- [ ] Parent integration regenerates shared project-map outputs and runs the full
  release gate before publication.

## Failure-Loudly Contract

- Cause surfaced as: 401 for no authenticated permission context, 403 for
  missing membership or schedule write access, and 400 for invalid project IDs.
- Detection path: focused handler tests prove denied requests cannot construct
  the mutation service or call create/update/delete methods.
- Recovery path: assign the caller a project permission template or override
  granting `schedule:write`, then retry the same operation.

## Incident Learning

- Failure fingerprint: N/A. The learning-registry lookup returned no direct
  scheduling authorization match; this is the first localized occurrence.
- Root cause: Schedule task mutations checked only for an authenticated cookie;
  they never evaluated the caller's project schedule permission.
- Detection gap: Existing focused tests covered collection GET and detail PATCH,
  but not POST/PUT/DELETE authorization boundaries.
- Prevention: Route all schedule task mutations through `requirePermission`
  before request parsing or persistence and lock the ordering with denial tests.
- Guardrail evidence: Thirty-seven focused handler tests cover retained reads,
  write denial and success for all three mutation methods, cross-project and
  unauthenticated denials, strict project IDs and task UUIDs, and persistence
  ordering.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Types gate | `frontend/src/types/database.types.ts` | Pass | Verified `schedule_tasks`, `project_directory_memberships`, and `permission_templates`; `schedule_tasks.project_id` is `number`. |
| Runtime localization | Existing focused handlers and tests | Pass | GET uses canonical project access, while POST/PUT/DELETE reach `SchedulingService` after authentication alone and have no project permission decision. The first divergence is request to mutation-handler authorization. |
| Red test | Focused Jest run before product edits | Expected failure | 22 authorization/ID assertions failed while existing behavior returned success or cookie-only responses, proving the permission helper was not consulted. |
| Focused route tests | `npm run test:unit -- --runInBand --silent --runTestsByPath "src/app/api/projects/[projectId]/scheduling/tasks/__tests__/route.test.ts" "src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/__tests__/route.test.ts"` | Pass | 2 suites, 37 tests passed after independent review. |
| Focused lint | `npx eslint` on both route files and focused tests | Pass | No lint findings. The isolated workspace used the canonical installed dependency tree through a temporary junction, removed after checks. |
| Patch integrity | `git diff --check` | Pass | No whitespace errors. |
| Existing test drift | Detail PATCH error assertions | Repaired | Three pre-existing assertions expected a retired `{ error }` shape; they now assert the current guardrail `error_code` and `error_message` contract. |
| Local commit gate | `git commit -m "Enforce schedule task write permissions"` | Deferred to integration | The mandatory hook requires regenerating `docs/architecture/PROJECT-MAP.md` and `frontend/src/lib/app-surface/app-surface.generated.json`. The parent integrator explicitly authorized `git commit --no-verify` for this isolated slice and owns regenerating both artifacts plus running the full gate after the API commits are combined. |
| Independent review correction | Malformed task identifier | Pass | PUT and DELETE now require a canonical UUID before permission lookup, client construction, or service calls; four regressions cover malformed IDs across both methods. |

## Remaining Risk

- PATCH deadline and field-update intents are not used by the Plane Cycles or
  Modules mutation rollout and remain separate follow-up authorization work.
- Shared project-map generated artifacts are owned by the parent integration
  checkpoint to prevent concurrent ownership conflicts. Before publication the
  parent must run `npm run map:project`, stage both generated outputs, and rerun
  the complete commit/release gate.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred work names its owner and next action.
