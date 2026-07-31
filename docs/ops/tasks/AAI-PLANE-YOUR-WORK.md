# Task: Plane-Derived Your Work Replacement Surface

Status: Ready for Integration
Owner: S20260731-PLANE-YOUR-WORK
Created: 2026-07-31
Task ID: AAI-PLANE-YOUR-WORK
Linear Issue: Parent Plane migration program owns external tracking.
Related Handoff: Parent Plane integration task

## Objective

Deliver a Plane-derived cross-project Your Work surface that shows the real
tasks the signed-in user is authorized to see, grouped and filterable across
projects, with the canonical create, update, detail, and delete behavior.

## Scope

- New `frontend/src/features/plane-your-work/**` feature.
- Focused model, source-attribution, and template tests.
- Shared route, dispatcher, and sidebar wiring are deferred to integration.
- No edits to existing Tasks compositions, APIs, schemas, permissions,
  navigation, or production configuration.

## Source of Truth

- Canonical company Tasks route:
  `frontend/src/app/(tables)/tasks/page.tsx`
- Canonical Tasks composition and mutation behavior:
  `frontend/src/features/tasks/tasks-inbox.tsx`
- Canonical create owner:
  `frontend/src/features/tasks/new-task-dialog.tsx`
- Canonical task adapters:
  `frontend/src/features/tasks/task-utils.ts`
- Canonical APIs:
  `frontend/src/app/api/tasks/route.ts` and
  `frontend/src/app/api/tasks/[taskId]/route.ts`
- Canonical records: `public.tasks`
- Plane source revision:
  `39856932cd6b9bd17eab0920506d628190b47af2`

Delivery lane: Standard

Verification contract: Optional

## Workflow Map

```text
User action: Review assigned/company work across projects, filter, open, edit, complete, create, or delete a task
Frontend owner component: PlaneYourWorkSurface
Shared primitive/component owner: NewTaskDialog, Button, ExpandableSearch, Select, Sheet, AlertDialog
Client state changed: scope, status, project filter, search, grouped tasks, selected detail
API route(s): GET/POST /api/tasks; GET/PATCH/DELETE /api/tasks/[taskId]; GET /api/projects; GET /api/users
Validation schema(s): canonical task POST and PATCH zod schemas in API routes
Service/helper(s): apiFetch, useCurrentUserProfile, task-utils, task-values
Supabase table(s): public.tasks, projects, people/user_profiles through API owners
Live DB assumptions: tasks.id UUID; project_id INTEGER; assignee_person_id UUID; status/priority canonical strings
Side effects on render: authorized read-only list/options fetches; detail is lazy-loaded on selection
Bulk/import/template behavior: N/A
Expected success evidence: authorized tasks render by project; canonical writes update the list
Expected failure behavior: visible list/detail retry; mutations retain state and name the failed action
```

## Attention Brief

```text
Primary user: Individual contributor or company task administrator
Primary job: Decide what needs attention across active projects and update it without losing context
Primary decision: What should I act on next, for which project, and by when
Tier 1: Task title, status, project, due date
Tier 2: Assignee and priority
Tier 3: Description, source, created date
Hide until requested: Full source context, editing controls, destructive delete
Remove: KPI cards, summary strips, analytics, helper panels, duplicate create actions
Primary action: Add Task
Failure-loudly behavior: Inline list/detail errors with retry; specific mutation failure messages
```

## Plane Source Mapping

- `apps/web/core/components/issues/issue-layouts/list/roots/profile-issues-root.tsx`
- `apps/web/core/components/issues/issue-layouts/list/base-list-root.tsx`
- `apps/web/core/components/issues/issue-layouts/list/default.tsx`
- `apps/web/core/components/issues/issue-layouts/list/block.tsx`
- `apps/web/core/components/issues/issue-layouts/empty-states/profile-view.tsx`

## Acceptance Criteria

- [x] My Work loads through `/api/tasks?scope=mine`.
- [x] Company scope appears only for admins and uses the API's existing
      authorization gate.
- [x] Authorized tasks can be searched and filtered by open/done and project.
- [x] Tasks are grouped by real project with unscoped work separated.
- [x] Row selection lazy-loads the canonical task detail into a responsive
      Plane-style inspector.
- [x] Status, priority, due date, project, and assignee use the canonical PATCH
      contract.
- [x] New Task delegates to `NewTaskDialog`; delete delegates to the canonical
      DELETE route.
- [x] Loading, empty, list-error, and detail-error states are explicit.
- [x] Mobile layout prioritizes task/status/project and does not overflow.
- [x] No mock task, project, or assignee data exists.
- [x] AGPL attribution and exact Plane source mapping are preserved.

## Implementation Checklist

- [x] Canonical company route, task composition, APIs, permissions, and types
      inspected before edits.
- [x] Exact Plane profile-list source templates inspected at the pinned
      revision.
- [x] Files/modules to change are listed before edits.
- [x] New surface and focused tests are implemented.
- [x] Shared route/sidebar integration is documented without overlapping
      ownership.

## Integration and Verification

- [x] Focused tests pass.
- [x] Targeted lint passes.
- [x] Patch integrity passes.
- [x] Local commit is recorded.
- [ ] Route integration, authenticated browser proof, and publication are
      completed at the batched release checkpoint.

## Failure-Loudly Contract

- List failure: `Your work could not load` plus canonical error detail and
  Retry.
- Detail failure: inspector retains the selected task and offers Retry.
- Mutation failure: no optimistic local mutation is kept; the message names
  update/delete and the console context names the task and fields.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A; this is a replacement-template feature, not a bug repair.
- Detection gap: N/A
- Prevention: Authorization-aware scope tests, source mapping, and focused
  model/template tests prevent data and visual ownership drift.
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, authorization, workflow, and attention gates captured before product edits. |
| Focused unit tests | `npm --prefix frontend run test:unit -- --runInBand --runTestsByPath src/features/plane-your-work/plane-your-work-model.unit.test.ts src/features/plane-your-work/plane-your-work-source.unit.test.ts src/features/plane-your-work/plane-your-work-template.unit.test.tsx` | Pass | 3 suites, 6 tests. |
| Targeted lint | `frontend/node_modules/.bin/eslint.cmd "src/features/plane-your-work/**/*.{ts,tsx}"` | Pass | Zero warnings and zero errors. |
| Patch integrity | `git diff --check` | Pass | No whitespace errors. |
| AGPL source offer | `LICENSES/NOTICE-PLANE.md`, `/auth/source`, `/api/source-info` | Pass | Existing corresponding-source path is present; feature pins exact Plane revision and profile-list source files. |
| Local commit | `Add Plane-derived Your Work surface` | Pass | Feature slice committed locally; not published. |

## Remaining Risk

- Shared route and sidebar registration are deferred to the integration owner.
- Browser parity and live mutation proof remain part of the batched release
  checkpoint.

## Final Status

- [x] All feature-slice checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred integration next action is to register the replacement route and
      sidebar item after the shared integration workspace releases ownership.
