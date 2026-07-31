# Task: Schedule Phase 4A Resource Assignments and Allocation Diagnostics

Status: Complete - Pushed
Owner: Codex (S217)
Created: 2026-07-22
Task ID: ALL-5
Linear Issue: ALL-5 - https://linear.app/alleato-group/issue/ALL-5/build-phase-4a-schedule-resources-assignments-and-allocation
Related Handoff: `docs/ops/handoffs/2026-07-22-S217-schedule-resources-assignments.md`

## Objective

On the canonical `/<projectId>/schedule` route, a schedule manager can assign multiple active project-directory people to a persisted task with explicit allocation percentages and can inspect deterministic daily availability and overallocation diagnostics without changing any task date.

## Scope

- Add project-scoped person resources and many-to-many task assignments as the sole new assignment owner.
- Add immutable resource and assignment snapshots to the existing schedule revision transaction.
- Add manager-guarded atomic assignment replacement and member-readable roster endpoints.
- Add a pure allocation engine based on forecast-or-planned task dates and the existing project working calendar.
- Extend the existing task editor and canonical schedule page with assignment and collapsed resource-load controls.
- Explicitly inventory and warn on legacy `schedule_tasks.assignee` / `assignee_person_id`; do not infer allocation or dual-write them.
- Explicitly exclude task-date leveling writes, resource-specific calendars and shifts, work-equation task types, rates/cost/earned value, non-person resources, and Microsoft Project resource interoperability. Those remain later Phase 4/5/7 increments in the parity roadmap.

## Source of Truth

- Canonical runtime/data owner: `schedule_tasks`, new `schedule_resources`, new `schedule_task_assignments`, and the existing `create_schedule_revision_snapshot` transaction.
- Identity and eligibility owners: `people` and `project_directory_memberships`.
- Existing shared primitives/services: `frontend/src/lib/scheduling/schedule-calendar.ts`, project schedule authorization helpers, `withApiGuardrails`, Supabase route clients, and the canonical schedule page/task modal.
- Deprecated or parallel paths: legacy single-assignee task columns are read-only warning inputs; deprecated `zz_deprecated_project_resources` and manpower planning tables are not reused.

Verification contract: Required

## Acceptance Criteria

- [x] An authorized schedule manager can atomically add, change, remove, and clear multiple active project people on a persisted task.
- [x] Duplicate people, invalid percentages, inactive/non-member people, cross-project task/resource relationships, and unauthorized writes fail with specific actionable errors.
- [x] Assignment writes never change task start, finish, forecast, or legacy assignee columns.
- [x] A project member can load the resource roster and availability diagnostics while direct authenticated table writes remain denied.
- [x] Daily allocation honors the existing project working calendar, forecast-date precedence, milestones, unscheduled tasks, and invalid ranges deterministically.
- [x] Exact-capacity and over-capacity results are visible; diagnostics are surfaced rather than silently omitted.
- [x] Resource and assignment facts are copied atomically into immutable revision snapshots with count-equality checks.
- [x] Existing revisions explicitly report resource context as unavailable; no historical allocations are reconstructed.
- [x] Requested behavior is observable end to end on authenticated desktop and mobile canonical routes.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before product edits.
- [x] Generate the migration with `supabase migration new`; add tables, composite constraints, indexes, grants, RLS, guarded RPC, immutable snapshots, and snapshot-function integration.
- [x] Regenerate `frontend/src/types/database.types.ts` exactly from the linked schema and remove stale runtime compatibility accesses to tables/columns proven absent by live readback.
- [x] Add scheduling resource contracts and a pure allocation engine with focused tests.
- [x] Add the resource service, hook, guarded resource route, guarded assignment route, and focused tests.
- [x] Add the assignment editor and collapsed resource availability panel to the existing schedule surface with focused tests.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are handled.

## Owned Files

- `supabase/migrations/*_schedule_resources_and_assignments.sql`
- `frontend/src/types/database.types.ts`
- `frontend/src/lib/submittals/ai-review/review-run-service.ts`
- `frontend/src/lib/ai/tools/document-intelligence.ts`
- `frontend/src/types/scheduling.ts`
- `frontend/src/lib/scheduling/schedule-resource-allocation.ts`
- `frontend/src/lib/scheduling/__tests__/schedule-resource-allocation.test.ts`
- `frontend/src/lib/services/schedule-resource-service.ts`
- `frontend/src/lib/services/__tests__/schedule-resource-service.scope.test.ts`
- `frontend/src/hooks/use-schedule-resources.ts`
- `frontend/src/app/api/projects/[projectId]/scheduling/resources/**`
- `frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/assignments/**`
- `frontend/src/components/scheduling/task-assignments-editor.tsx`
- `frontend/src/components/scheduling/resource-availability-panel.tsx`
- `frontend/src/components/scheduling/__tests__/task-assignments-editor.test.tsx`
- `frontend/src/components/scheduling/__tests__/resource-availability-panel.test.tsx`
- `frontend/src/components/scheduling/task-edit-modal.tsx`
- `frontend/src/app/(main)/[projectId]/schedule/page.tsx`
- `frontend/tests/e2e/schedule/schedule-resources.spec.ts`
- `docs/architecture/SCHEDULE-RESOURCES.md`
- This task, handoff, evidence directory, and S217 session-board row.

## Integration and Verification

- [x] Focused engine, service, route, and component tests pass.
- [x] Supabase migration ledger and generated types exactly match the linked schema; the formal drift and manual-override gates pass.
- [x] Database readback proves constraints, grants, RLS, RPC definition, snapshot count equality, and immutable triggers.
- [x] Negative probes prove direct authenticated DML, unauthorized/inactive/cross-project assignment, and snapshot mutation are rejected.
- [x] Authenticated browser preflight and exact user-flow evidence pass on desktop and mobile.
- [x] Independent TypeScript/React, final code, and final database reviews approve the changed files after evidence hardening and pagination/schema remediation.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: typed API error plus visible task-editor/resource-panel error state; allocation diagnostics name missing task/resource or invalid/unscheduled date facts.
- Detection path: focused test output, migration/readback SQL, route response, browser console/network capture, or visible inline alert.
- Recovery path: correct membership/allocation/date input and retry; restore authentication for preflight; or stop publication until the additive migration and generated type contract agree.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file, S217 handoff, ALL-5, session-board row | Passed | Scope, owners, deferred boundaries, done gate, evidence, and publication status are captured. |
| Repository base | `git fetch origin main`; isolated workspace from `11e636e71` | Passed | Phase 3 fix `4a591ef3` is an ancestor; dirty Phase 3 evidence remains outside S217. |
| Supabase current guidance | 2026 changelog plus current RLS, function, and migration docs | Passed | Migration will use explicit grants, RLS, restricted RPC execute, and a fixed search path. |
| Browser auth preflight | `npm run verify:browser -- --url "http://localhost:3217/67/schedule" --name "all-5-auth-preflight" --skip-cleanup` | Passed | Dedicated test profile and project-67 membership verified. Run: `tests/agent-browser-runs/2026-07-22T12-42-46-877Z-all-5-auth-preflight/VERIFICATION_SUMMARY.md`. |
| Linked migration | `npx.cmd --yes supabase@latest db query --linked --file supabase/migrations/20260722121917_schedule_resources_and_assignments.sql` plus ledger repair/readback | Passed | Migration `20260722121917` is applied; four tables have RLS; grants, fixed search paths, constraints, indexes, and two immutability triggers per snapshot table were read back. |
| Linked database readback | `readback.sql` plus `linked-readback-output.md` | Passed | Exit 0; exact RLS policy predicates, role privileges, function owner/ACL/search path, 22 constraints, 13 indexes, and four immutable triggers are persisted. |
| Negative database probes | `mutation-probes.sql` plus `linked-mutation-probes-output.md` | Passed | Exit 0; actual cross-project task, inactive person, inactive membership, unauthorized RPC/direct DML, and owner-level trigger update/truncate attempts were rejected; all temporary data rolled back. |
| Focused Phase 4 tests | `npm.cmd run test:unit -- --runInBand --runTestsByPath ...` | Passed | Eight suites / 33 tests, including deterministic resource pagination, bounded people-ID chunks, and task-hierarchy pagination beyond 500 rows. |
| Existing task-modal regressions | Five focused task-edit-modal suites | Passed | Five suites / 11 tests. |
| Authenticated E2E | `npx.cmd playwright test tests/e2e/schedule/schedule-resources.spec.ts --config=config/playwright/playwright.config.ts --project=chromium --no-deps --workers=1` | Passed | Final clean-server workflow passed in 3.3 minutes after cold compilation; assignment edit, 150% daily load, unchanged task dates, captured snapshot counts, rejected snapshot mutation, clear, and cleanup verified. |
| Generated schema gates | `npm.cmd run db:types:check`; `npm.cmd run guardrails:db-type-overrides` | Passed | Exact linked-schema generation and the no-manual-table-overrides rule both exit 0. |
| TypeScript / lint review | direct full-repo `tsc`; targeted ESLint | Scoped pass | Targeted ESLint exits 0 after final remediation. A fresh full-repo TypeScript attempt consumed about 4.5 GB and emitted no diagnostic before its bounded 15-minute termination; independent review found no task-owned type issue. |
| Production build | `npm.cmd run quality:build-routes`; direct Next builds at 7 GB and 12 GB | Resource-limited | Route contracts pass. The 7 GB run confirmed V8 heap exhaustion; the 12 GB run exited during compile near its heap ceiling after 15m58s with no source or TypeScript diagnostic. |
| Independent reviews | React/UI, TypeScript/JavaScript, final code, and database reviews | Passed | All task-owned critical/high/medium findings resolved; final verdicts APPROVE. Final code re-review verified canonical specification paths and hierarchy pagination; database review independently reran schema gates, service/API tests, linked readback, and rollback probes. |

## Remaining Risk

- Phase 4A capacity is 100 percent per project working day and person resources only. Resource calendars, shifts, equipment/material resources, work formulas, and leveling writes require later contracts; owner: schedule parity roadmap; next action: proceed after this authoritative assignment boundary is verified.
- Existing Phase 3 browser closeout evidence remains pending under S216 and is not modified by this phase.
- The exact linked-schema type regeneration proved that legacy `submittal_documents` and submittal AI-review cache fields no longer exist. Their stale compatibility accesses were removed; current `submittal_ai_review_runs` remains authoritative.
- Revision capture extends the existing transaction-wide `SHARE`-lock pattern across shared schedule tables. Owner: schedule platform; next action: design a project-scoped consistent snapshot strategy before high-concurrency rollout.
- Repository-scale Next build and TypeScript verification are memory/time constrained on this workstation. Detection: bounded 7 GB/12 GB builds and an 8 GB TypeScript scan. Prevention: keep task-focused tests/lint/schema checks mandatory and continue the existing build-memory remediation work before making the monolithic build a reliable local gate.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred work has cause, detection gap, prevention step, owner, and next action.
