# Task: Schedule Phase 4B Resource Calendars and Leveling Preview

Status: Completed
Owner: Codex (S218)
Created: 2026-07-22
Task ID: ALL-5
Linear Issue: ALL-5 - https://linear.app/alleato-group/issue/ALL-5/build-phase-4a-schedule-resources-assignments-and-allocation
Related Handoff: `docs/ops/handoffs/2026-07-22-S218-schedule-resource-calendars-leveling.md`

## Objective

On the canonical `/<projectId>/schedule` route, a schedule manager can configure project-scoped weekday capacity and dated capacity exceptions for an existing person resource, inspect allocation against that effective capacity, and run a deterministic delay-only resource-leveling preview that never persists task dates.

## Scope

- Add one project-scoped capacity profile for each existing `schedule_resources` person resource.
- Add recurring weekday percentage-capacity overrides and dated percentage-capacity exceptions.
- Preserve the effective resource-capacity context in immutable schedule revision snapshots with explicit provenance for older revisions.
- Apply one deterministic capacity-precedence contract to allocation, assignment availability, and leveling preview.
- Add a pure, finite-horizon, delay-only preview that respects effective forecast-or-planned dates, assignments, dependencies, constraints, project working days, and all assigned resources.
- Integrate manager-only calendar editing and preview-only results through progressive disclosure on the canonical schedule page.
- Label all results as project capacity, because the resource boundary is project-scoped rather than enterprise-wide.
- Explicitly exclude preview application, automatic task-date writes, undo/audit for leveling, hourly shifts, split tasks, cross-project capacity, equipment/material resources, rates/cost/earned value, work-equation task types, and Microsoft Project file interchange.

## Source of Truth

- Canonical task/assignment owners: `schedule_tasks`, `schedule_dependencies`, `schedule_resources`, and `schedule_task_assignments`.
- Calendar owners: existing project schedule calendars plus the new resource-capacity profile tables.
- Identity and eligibility owners: `people` and `project_directory_memberships`.
- Revision owner: the existing atomic `create_schedule_revision_snapshot` transaction.
- UI owner: the existing canonical schedule page and resource availability panel; no parallel resource route or dashboard is introduced.

Verification contract: Required

## Acceptance Criteria

- [x] A schedule manager can atomically replace an active existing resource's weekday capacities and dated exceptions.
- [x] Read-only members cannot replace resource calendars, and direct authenticated table DML remains denied.
- [x] Cross-project resources, inactive people or memberships, malformed JSON, duplicate weekday/date entries, and capacity outside 0-100 fail specifically and atomically.
- [x] Missing resource configuration inherits 100 percent on project working days.
- [x] Project non-working days resolve to zero; a dated exception overrides a recurring weekday override; all consumers use the same resolver.
- [x] Inactive, missing, unscheduled, invalid, and infeasible facts remain visible diagnostics.
- [x] A deterministic preview proposes delay-only task dates, preserves project-working-day duration, respects dependencies/constraints/all assigned resource capacity, and never mutates its inputs.
- [x] Cycles, hard constraints, missing facts, and no feasible slot inside the finite horizon return actionable unresolved diagnostics.
- [x] No preview persistence table, task-update RPC, apply endpoint, or Apply button exists.
- [x] Authenticated E2E proves planned, forecast, constraint, duration, and progress fields are unchanged before versus after preview.
- [x] New revisions capture immutable resource-capacity context with count equality; existing revisions report the context as unavailable.
- [x] The feature remains on the canonical schedule page and works on desktop and mobile.

## Implementation Checklist

- [x] Files/modules to change are listed before product edits.
- [x] Complete an implementation-ready architecture review before database or UI changes.
- [x] Complete browser authentication preflight before user-facing implementation.
- [x] Generate the additive migration through the Supabase CLI and implement tables, tenant-safe constraints, indexes, grants/RLS, a manager-only replacement RPC, snapshots, provenance, and immutability.
- [x] Regenerate `frontend/src/types/database.types.ts` exactly from the linked schema.
- [x] Add shared effective-capacity and pure leveling-preview engines with focused tests.
- [x] Add range-bounded resource-calendar reads, lazy selected-profile editing, guarded route handlers, and focused tests.
- [x] Extend the canonical resource panel with a compact calendar editor and preview-only results.
- [x] Apply and read back the migration, run rollback-only negative probes, and verify the linked migration ledger.
- [x] Run focused tests, schema guardrails, targeted lint, authenticated E2E, and independent code/database/React reviews.

## Owned Files

- `supabase/migrations/*_schedule_resource_calendars.sql`
- `frontend/src/types/database.types.ts`
- `frontend/src/types/scheduling.ts`
- `frontend/src/lib/scheduling/schedule-resource-allocation.ts`
- `frontend/src/lib/scheduling/schedule-resource-leveling-preview.ts`
- focused scheduling engine tests under `frontend/src/lib/scheduling/__tests__/`
- `frontend/src/lib/services/schedule-resource-service.ts`
- focused resource service tests under `frontend/src/lib/services/__tests__/`
- `frontend/src/hooks/use-schedule-resources.ts`
- `frontend/src/app/api/projects/[projectId]/scheduling/resource-calendars/**`
- `frontend/src/app/api/projects/[projectId]/scheduling/resource-leveling-preview/**`
- `frontend/src/components/scheduling/resource-availability-panel.tsx`
- `frontend/src/components/scheduling/resource-calendar-dialog.tsx`
- focused scheduling component and route tests
- `frontend/src/app/(main)/[projectId]/schedule/page.tsx`
- `frontend/tests/e2e/schedule/schedule-resource-capacity.spec.ts`
- `docs/architecture/SCHEDULE-RESOURCES.md`
- This task, handoff, evidence directory, and S218 session-board row.

## Product Noise Gate

- Primary user/job/decision: project manager / model each person's project capacity / decide whether a resource-driven date change is worth considering.
- Tier 1: current project capacity, load, and unresolved overload.
- Tier 2: selected resource calendar configuration and proposed before/after dates.
- Tier 3: detailed blockers, capacity dates, and diagnostic provenance.
- Hidden by default: resource panel, calendar editor, and leveling-preview details.
- Removed: new schedule dashboard/page, automatic leveling, and task-date Apply action.
- Primary actions: save a selected resource's capacity profile; run a non-persisting preview.

## Failure-Loudly Contract

- Cause surfaced as: typed API error plus visible resource-panel/dialog error; engine diagnostics identify the exact task, resource, date, constraint, cycle, missing fact, or exhausted horizon.
- Detection path: focused test output, migration/readback SQL, route response, browser console/network capture, or visible inline alert.
- Recovery path: correct project membership/capacity/date input and retry, extend or revise the schedule manually after reviewing diagnostics, restore authentication, or stop publication until schema and generated types agree.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task, S218 handoff, ALL-5, and session-board row | Passed | Scope, ownership, exclusions, and completion gates were recorded before product edits. |
| Repository base | Governed isolated workspace from `477079a4d` | Passed | Phase 4A `be68ef649` is the immediate scheduling ancestor. |
| Linear update | Active browser policy | Blocked | Policy rejected `linear.app`; no alternate browser, API, or indirect workaround will be used. |
| Live schema and ledger | `npm run db:types:check`; `npm run db:migrations:verify-applied`; `schema-readback.sql` | Passed | Generated types match; migrations `20260722161757`, `20260722172738`, and `20260722183059` are applied; function, bounded-read, index, grant, RLS, snapshot, and provenance contracts read back correctly. |
| Negative mutation probes | `mutation-probes.sql` in a rollback-only transaction | Passed | Direct DML, malformed/duplicate/cross-project/inactive/unauthorized writes, immutability violations, and stale compare-and-swap versions were rejected atomically. |
| Focused regression tests | 13 Jest suites | Passed | 85 tests passed, including capacity precedence, allocation, leveling, coherent service reads, route validation, stale-editor conflict, cross-chunk drift rejection, hook, dialog, panel, and task editor behavior. |
| Engine coverage | Focused scheduling engine Jest coverage | Passed | 90.68% statements, 85.49% branches, 95.94% functions, and 93.69% lines. |
| Lint and guardrails | Targeted ESLint; `guardrails:db-type-overrides`; changed-route guardrail | Passed | Phase 4B files lint clean and database/route policy checks pass. |
| Authenticated E2E | `schedule-resource-capacity.spec.ts`, Chromium | Passed | One authenticated end-to-end flow passed; capacity edit and preview produced desktop/mobile evidence and left planned, forecast, constraint, duration, progress, status, and milestone facts unchanged. |
| Cleanup | `cleanup-readback.sql` | Passed | Temporary task, capacity exception, and schedule revision residue all read back as zero. |
| Independent reviews | Code, React/E2E, and database reviewers | Passed | Initial findings were resolved; final decisions are recorded in `independent-review.md`. |
| Repository-wide TypeScript/build | `tsc --noEmit`; production build attempt | Bounded gap | The full sweep reports pre-existing errors outside Phase 4B; no Phase 4B-owned path error was reported. A production build exhausted the workstation heap without a source diagnostic. Focused gates, live browser proof, and independent reviews are clean. |

## Remaining Risk

- Existing revision capture uses global `SHARE` locks across schedule tables. Phase 4B preserves atomic correctness and documents the increased contention; a project-scoped consistency redesign remains separate operational work.
- Project-scoped resources cannot represent one person's combined load across projects. The UI and diagnostics state this limitation; enterprise capacity is deferred.
- Repository-wide TypeScript/build debt remains outside this task. Phase 4B itself is covered by focused tests, live schema checks, authenticated E2E, and independent reviews.
- Linear issue `ALL-5` still needs a manual status/comment update because active browser policy rejected `linear.app`.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Deferred work has an owner and next action.
- [x] Task-owned revision is published to `origin/main`; the isolated-workspace receipt is verified without rebasing the local task branch.
