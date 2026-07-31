# Schedule Resources, Capacity, Assignments, and Leveling Preview

## Ownership

`people` owns person identity and `project_directory_memberships` owns project eligibility. `schedule_resources` materializes an eligible project person for scheduling, while `schedule_task_assignments` is the canonical many-to-many task assignment owner.

Legacy `schedule_tasks.assignee` and `schedule_tasks.assignee_person_id` are warning-only inputs. They are not backfilled, inferred, or dual-written because they do not carry a reliable allocation percentage or eligibility history.

## Phase 4A Assignment Contract

- Resources are people with active person and project-membership records.
- Each assignment has a whole-number daily allocation from 1 through 100 percent.
- A person may appear once per task, but overlapping tasks may intentionally exceed 100 percent.
- A missing resource-capacity profile inherits 100 percent on each project working day and zero on non-working days.
- Forecast dates take precedence independently over planned start and finish dates.
- Milestones create zero load. Missing or invalid dates remain explicit diagnostics.
- Assignment changes never modify task dates, forecast dates, constraints, duration, progress, or legacy assignee fields.

Equipment and material resources, work equations, rates, costs, earned value, automatic date writes, and Microsoft Project interchange remain deferred.

## Phase 4B Capacity Contract

- Capacity is project-scoped. It does not claim to include the person's work in other projects.
- Only existing person rows in `schedule_resources` can receive a capacity profile in this phase.
- Recurring shifts are sparse weekday percentage overrides from 0 through 100. Hourly shift times, overtime, and split shifts remain deferred until task work is time-based.
- Dated exceptions are sparse percentage overrides from 0 through 100 with an optional reason.
- Effective capacity has one precedence order everywhere:
  1. A project non-working date has zero capacity.
  2. A dated resource exception overrides recurring resource capacity.
  3. A recurring weekday override replaces the inherited daily default.
  4. An absent override inherits 100 percent.
- An explicit empty profile is versioned but behaves like inherited 100-percent project capacity.
- Allocation, pre-assignment availability, and leveling preview consume the same pure capacity resolver.
- Resource-profile replacement never reads or writes `schedule_tasks`.

The live capacity model is normalized into `schedule_resource_capacity_profiles`, `schedule_resource_weekday_capacity_overrides`, and `schedule_resource_capacity_exceptions`. The profile is unique by project/resource and each child carries tenant-safe project/resource references. Authenticated project members receive RLS-scoped reads only. A schedule manager replaces the complete profile through `replace_schedule_resource_capacity_profile(project, resource, weekdays, exceptions, expected_version)`, which validates active person/membership state, strict bounded JSON, unique weekdays/dates, percentages, reasons, and the caller's compare-and-swap version before committing atomically and returning the canonical saved profile.

## Preview-Only Leveling Contract

`previewScheduleResourceLeveling` is a pure, deterministic, delay-only serial schedule-generation heuristic. Its input is an authoritative read-only snapshot of tasks, dependencies, assignments, the project calendar, and bounded resource-capacity facts. It has no database mutation path.

- Effective dates use `forecast_start_date ?? start_date` and `forecast_finish_date ?? finish_date` independently.
- Progressed, completed, or actual-dated tasks remain fixed reservations.
- The preview never accelerates, splits, or stretches a task. It preserves project-working-day duration.
- All assigned resources must have sufficient capacity across every project working day in a candidate span.
- FS, SS, FF, and SF dependencies, lag, and supported task constraints define the earliest/legal placement.
- Deterministic ready-task order is fixed/hard-constrained first, then effective start, `sort_order`, and task ID.
- Search advances one project working day at a time and stops at a caller-bounded horizon: 365 days by default and 730 maximum.
- Cycles, missing or invalid facts, hard-constraint conflicts, unresolved predecessors, and horizon exhaustion are returned as named diagnostics. Independent branches can still produce a partial preview.
- Equivalent shuffled inputs produce the same output, and input objects are never mutated.
- The application exposes no preview table, task-date mutation RPC, Apply endpoint, or Apply button. Every result states that no schedule dates were changed.

## Live Data and Write Boundary

`schedule_resources` is unique by `(project_id, person_id)` and has a composite project/person foreign key to the directory membership. `schedule_task_assignments` is unique by `(task_id, resource_id)` and uses composite foreign keys so the task and resource must belong to the same project.

Capacity profiles are unique by `(project_id, resource_id)`. Sparse weekday and exception rows use composite references back to the same project/resource profile. Range reads use indexed project/resource/date predicates; complete exception history loads only for the selected calendar editor.

Authenticated project members receive read-only access through RLS. Direct authenticated inserts, updates, deletes, and truncates are not granted. The service role retains operational access to live tables but only read access to immutable snapshot tables.

All assignment replacement goes through `replace_schedule_task_assignments(project, task, assignments)`. All resource-capacity replacement goes through `replace_schedule_resource_capacity_profile(project, resource, weekdays, exceptions, expected_version)`. Both guarded functions require schedule-manager authority, use `SECURITY DEFINER` with an empty search path and schema-qualified identifiers, lock and validate their scope, and commit only a complete valid replacement. A stale capacity version fails with SQLSTATE `40001` and is surfaced as an HTTP 409 conflict instead of overwriting another editor's work.

## Revision Snapshots

Every new schedule revision captures resource, assignment, and capacity facts in the same transaction as task, dependency, deadline, project-calendar, and submittal facts:

- `schedule_revision_resource_snapshots` captures directory identity/status facts.
- `schedule_revision_assignment_snapshots` captures task/resource/allocation relationships.
- `schedule_revision_resource_capacity_snapshots` stores exactly one row for every snapshotted project resource, including unconfigured resources, with sorted weekday and dated JSON facts plus source profile/version.
- Composite revision foreign keys keep every captured fact in the same revision.
- Resource-row, assignment-row, capacity-row, weekday-fact, and exception-fact source counts must equal inserted counts before commit.
- Row mutation and truncate triggers make all snapshot tables immutable while allowing parent-revision cascade cleanup.

Existing revisions are marked `resource_context_provenance = 'not_available'` and `resource_capacity_context_provenance = 'not_available'`. New captures are marked `captured`. Historical assignment or capacity facts are never reconstructed from legacy task columns or current live profiles.

The current revision function uses transaction-wide `SHARE` locks because existing schedule writers do not yet participate in a common project lock. Phase 4B includes its three live capacity tables in the same consistency boundary. A later platform change must add one project-keyed transaction lock to every schedule writer before those global locks can safely be removed.

## Application Boundary

`ScheduleResourceService` is the shared server-side owner for roster/assignment reads, bounded capacity reads, lazy full-profile reads, guarded replacements, and the read-only leveling context. Capacity, selected-profile, and leveling reads use `get_schedule_resource_read_model(project, range_start, range_finish, selected_resource, horizon, include_leveling)`, so every returned aggregate is assembled by one PostgreSQL statement snapshot rather than torn application-side queries. The public RPC itself rejects project-wide non-leveling ranges above 92 calendar days. A longer task span is read in bounded chunks only when every chunk reports the identical profile set, IDs, versions, and weekday facts; drift fails visibly instead of merging a capacity state that never existed. The HTTP surface is:

- `GET /api/projects/:projectId/scheduling/resources`
- `GET /api/projects/:projectId/scheduling/tasks/:taskId/assignments`
- `PUT /api/projects/:projectId/scheduling/tasks/:taskId/assignments`
- `GET /api/projects/:projectId/scheduling/resources?view=capacity&start=YYYY-MM-DD&finish=YYYY-MM-DD`
- `GET /api/projects/:projectId/scheduling/resources?view=capacity-profile&resourceId=:resourceId`
- `PUT /api/projects/:projectId/scheduling/resources?view=capacity-profile&resourceId=:resourceId`
- `POST /api/projects/:projectId/scheduling/resources?operation=leveling-preview`

The canonical `/:projectId/schedule` page loads one project-scoped roster. `TaskAssignmentsEditor` changes a persisted task's complete assignment set. The collapsed resource panel lazy-loads capacity only for its visible range, while the calendar editor lazy-loads one selected resource's full profile. The preview endpoint accepts only bounded settings, loads authoritative read-only facts, and calls the pure leveling engine.

```text
people + project membership
            |
            v
schedule_resources <--- guarded assignment RPC ---> schedule_task_assignments
       |                                                |
       +-- guarded capacity-profile RPC                 |
       |       -> weekday overrides                     |
       |       -> dated exceptions                      |
       |                                                |
       +-------------- bounded read APIs ---------------+
                                |
             shared effective-capacity resolver
                         /              \
          daily allocation engine   leveling preview engine
                         \              /
                  canonical resource panel

revision capture transaction
  -> resource snapshots
  -> assignment snapshots joined to the same revision
  -> one capacity snapshot per revision resource
```

## Allocation and Preview Output

The allocation engine is deterministic and read-only. For each resource and date it returns effective capacity and its source, assigned load, available capacity, overallocated capacity, and contributing task allocations. It also emits visible diagnostics for missing tasks/resources, inactive resources, unscheduled tasks, invalid date ranges, duplicate capacity facts, and uncovered requested ranges.

The task editor calculates minimum availability across the task span while excluding that task's current assignments. The project panel defaults to ten working days and caps user-selected ranges at 92 calendar days. The preview output contains proposed before/after dates, delay, reasons and constraining resources plus actionable unresolved diagnostics; it deliberately contains no generated timestamp or mutation token.

## Failure and Recovery

Malformed payloads, duplicates, invalid percentages, inactive people, non-members, unauthorized writers, cross-project relationships, invalid constraints, cycles, and exhausted horizons fail or diagnose specifically. Routes return typed, actionable errors; the editor and resource panel expose those errors inline. Allocation and preview diagnostics are visible and are never silently discarded.

Application rollback is additive: deploy the prior UI/API while retaining the new tables. If writes must be frozen, ship a forward migration that revokes the capacity RPC rather than dropping resource history.

## Verification

Closeout requires focused capacity/allocation/leveling/service/route/component tests, generated-type agreement, schema/RLS/grant/function/trigger readback, rollback-only negative mutation probes, authenticated desktop and mobile browser evidence, and independent TypeScript, React, database, and final code review.

Phase 4A evidence is recorded under `docs/ops/evidence/2026-07-22-schedule-resources/`. Phase 4B evidence is recorded under `docs/ops/evidence/2026-07-22-schedule-resource-calendars-leveling/`. Both are tracked by Linear issue `ALL-5`; when Linear access is rejected by browser policy, that update remains an explicit manual handoff item.
