# Scheduling release independent review

Decision: **APPROVED**

Reviewed: 2026-07-29 (America/Indianapolis)

## Diff basis

- Fixed point: `origin/main` at `8f5f7b8cde57aa3a94c830b70b05bf35f92307dd`.
- Reviewed HEAD: `ec569c0dbd16b9fe4670977aaa8f5a4d0f01b016`.
- Review covered the current dirty/untracked release candidate, not the earlier
  pre-fix snapshots, including migrations `20260729190000`, `20260729191000`,
  and `20260729192000`.
- Spec sources:
  - `SCHEDULING-PROJECT-HANDOFF-2026-07-29.md`
  - `docs/ops/tasks/2026-07-29-schedule-transactional-completion.md`
  - `docs/ops/scheduling/2026-07-29-schedule-task-ordering-task.md`
  - `docs/ops/scheduling/2026-07-29-schedule-resource-cost-earned-value-task.md`
- Standards sources: repository `AGENTS.md`, `DESIGN.md`, and surrounding
  scheduling route/service/database patterns.

## Checks performed

- Read the surrounding scheduling routes, services, planners, migrations, SQL
  tests, hooks, and components rather than reviewing isolated changed lines.
- Traced authenticated actor identity and service-role mutation-client use from
  the task/dependency routes through the authoritative RPC.
- Traced project scope, manager authorization, advisory locks, exact task,
  dependency, ordering, assignment, and cost-version snapshots.
- Rechecked the cost RPC grants, company-recipient alert fan-out, deterministic
  event deduplication, EVM calculations, completeness diagnostics, and visible
  failure states.
- Ran focused Jest verification over bulk and assignment routes, scheduling and
  resource services, cost and assignment components, allocation/leveling
  planners, availability, and alerts.

  Result: **11 suites and 81 tests passed**.
- Ran focused ESLint over the corrected route, service, hook, page, view, editor,
  cost panel, and tests.

  Result: **0 errors**. Ten existing design-system warnings occur outside the
  corrected lines.
- Ran a PostgreSQL 17 rollback compilation probe for migration `20260729192000`.

  Result: **passed**.
- Ran a PostgreSQL rollback behavior probe for people-assignment replacement.

  Result: equipment and material assignments and their cost facts survived;
  the person resource received `resource_kind = 'person'` and its current
  display name; the person allocation updated; replaying the stale exact
  assignment snapshot failed with SQLSTATE `40001`.
- Ran a PostgreSQL rollback behavior probe for dependency insert, endpoint
  reassignment, and delete.

  Result: both old and new dependency endpoint task versions advanced for every
  graph edit.
- Ran `git diff --check`.

  Result: no whitespace errors; Git emitted only working-tree line-ending
  notices.

## Prior findings rechecked

### People assignment replacement preserves cost resources and uses exact CAS

Resolved.

- `supabase/migrations/20260729192000_preserve_cost_assignments_on_people_replace.sql`
  takes an exact expected snapshot of `{id, person_id, cost_version}` and rejects
  any mismatch with `40001` before writing.
- New person resources explicitly persist `resource_kind = 'person'` and a
  current nonempty display name.
- Replacement deletion and return rows are restricted to person resources, so
  equipment and material assignments remain owned by the cost workflow.
- The roster read model now returns assignment `cost_version`; the editor,
  hook, route, and service carry the exact persisted snapshot into the RPC.
- The route maps stale assignment snapshots to HTTP 409.

### Bulk route uses the authenticated actor and service-role mutation client

Resolved.

- Both POST and DELETE in
  `frontend/src/app/api/projects/[projectId]/scheduling/tasks/bulk/route.ts`
  construct `SchedulingService` with the authenticated `actorUserId` and
  `createServiceClient()` as the mutation client.
- Focused route regressions assert this boundary for both update and delete.

### Dependency graph edits invalidate task snapshots

Resolved.

- Migration `20260729192000` installs
  `schedule_dependencies_bump_task_versions`.
- Insert and delete bump both endpoints; reassignment updates bump old and new
  task/predecessor endpoints.
- The authoritative task update continues to submit the exact task-version and
  dependency snapshots, so a graph edit after read is rejected instead of
  committing against stale graph state.

### Direct bulk task writer removed

Resolved.

- `SchedulingService.bulkUpdateTasks` no longer exists.
- The canonical scheduling service contains no direct insert, update, upsert,
  or delete against `schedule_tasks`; writes flow through
  `apply_authoritative_schedule_cascade_mutation`.

### Permanent cost deletes require confirmation

Resolved.

- Resource and assignment trash actions now open the shared destructive
  `ConfirmationDialog`.
- The dialog states that deletion is permanent and cannot be undone; the DELETE
  request is sent only after confirmation.
- The component regression proves the assignment DELETE is not called before
  confirmation and retains the expected cost-version CAS.

### Enter quick-add supplies an insertion anchor

Resolved.

- All root quick-add surfaces delegate name/status to the page-level
  `handleQuickAddTask`; presentation-specific filtering and sorting no longer
  choose the insertion anchor.
- `lastScheduleSiblingTaskId` selects the final root sibling from the complete,
  unfiltered task model using persisted `sort_order` with an `id` tie-breaker.
- Explicit child/add-below anchors remain intact.
- The regression fixture ends with a high-sort child and presents root siblings
  out of persisted order, so it rejects both a naive flattened `.at(-1)` anchor
  and an order-insensitive last-root anchor.

### Final production-repair re-review

The reviewed quick-add/report repair is application source
`8223abfb9a1a65bdb9a0138ef47f96efcec5a94d`. The final scheduling conflict
transport repair is published source
`38c10d81dacb389871f4936085e189195b06e952`.

- Production Table quick-add no longer sends a root parent with a child
  insertion anchor.
- Trade activity reporting uses the explicit
  `companies!people_company_id_fkey` relationship, eliminating the ambiguous
  PostgREST embed.
- The final focused repair set passed 3 suites and 18 tests; the ordering helper
  suite passed 7/7 tests.
- Migrations `20260729213000` and `20260729214000` rewrite all 14 exact
  transactional, cost, capacity, segment, and leveling conflict functions from
  PostgreSQL rollback SQLSTATE `40001` to PostgREST-native `PT409`.
- The live verifier requires all 14 exact signatures, proves `PT409` in each
  current definition, checks both ledger versions, and rejects any remaining
  public/private scheduling or leveling `40001`.
- The complete scheduling release passed 77 suites and 444 tests.
- The independent re-review found no CRITICAL, HIGH, MEDIUM, or LOW findings.

## Findings

No CRITICAL, HIGH, MEDIUM, or LOW findings remain above the confidence
threshold.

## Release evidence boundary

This approval covers the final release-candidate code, all five live migration
readbacks, the 14-function conflict verifier, and rollback database probes.
Deployment readiness, alias readback, authenticated production actions, and
screenshots are recorded separately in the scheduling release verification
summary.

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 0     | pass   |
| MEDIUM   | 0     | pass   |
| LOW      | 0     | pass   |

Verdict: **APPROVE** - no CRITICAL or HIGH issues remain in the reviewed
release candidate.
