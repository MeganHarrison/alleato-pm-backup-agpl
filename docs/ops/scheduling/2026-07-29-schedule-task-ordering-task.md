# Task: Atomic Schedule Task Ordering

Status: In Progress
Owner: Codex (S019FACE)
Created: 2026-07-29
Task ID: SCHED-ORDERING
Linear Issue: Not created; tracked by the user-owned scheduling completion goal.
Related Handoff: N/A while this single isolated session remains active.

## Objective

An authorized scheduler can insert or move a task at an exact sibling position
while every affected sibling receives a contiguous deterministic sort order in
the same project-locked transaction.

## Scope

- Build and verify the pure normalization, insertion, and move planner.
- Preserve hierarchy, compare-and-swap versions, and deterministic tie breaks.
- Defer the database RPC and Enter-key UI binding until the active CRM-002
  isolated workspace releases the migration and generated-type paths.

## Source of Truth

- Canonical data owner: `schedule_tasks.parent_task_id`, `sort_order`, and
  `schedule_version`.
- New pure planner:
  `frontend/src/lib/scheduling/schedule-task-ordering.ts`.
- Transaction owner after the lease clears:
  `apply_authoritative_schedule_cascade_mutation`.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Every sibling group normalizes to contiguous one-based ordering.
- [x] Equal incoming sort orders resolve deterministically by task ID.
- [x] Enter insertion after an anchor renumbers following siblings.
- [x] Unanchored insertion appends within the requested parent.
- [x] Same-parent and cross-parent moves renumber every affected sibling.
- [x] Duplicate IDs, missing parents, hierarchy cycles, descendant moves,
  conflicting insertion facts, and invalid indexes fail specifically.
- [x] Plans require valid task versions, carry the complete affected sibling
  snapshot for CAS, and never mutate inputs.
- [ ] One project-keyed transaction applies insert/move and all renumbering.
- [ ] Guarded UI, authenticated E2E, deployment, and production readback pass.

## Implementation Checklist

- [x] Pure planner and focused tests are isolated and session-owned.
- [ ] RPC performs temporary collision-free renumbering and final contiguous
  ordering under one advisory lock.
- [ ] Service/API/UI pass exact expected versions and surface stale-write errors.

## Integration and Verification

- [x] Focused planner tests, lint, changed type-debt, and unsafe-pattern gates.
- [ ] Database concurrency/CAS/rollback probes.
- [ ] Authenticated Enter insertion and drag/move E2E.
- [x] Pure planner publication and exact origin blob readback.
- [ ] Transactional integration deployment and production readback.

## Failure-Loudly Contract

- Cause surfaced as: named planner error, guarded HTTP conflict, or stable
  database exception.
- Detection path: focused test, concurrent rollback-only probe, or browser
  network/DOM evidence.
- Recovery path: refresh stale task versions, correct the hierarchy target, and
  retry the atomic mutation.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A; feature delivery.
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: focused planner tests and independent review.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope, ownership, and done gates recorded. |
| Database ownership | `isolated-session-workspace.mjs status` | Blocked | CRM-002 owns migration/test/generated-type paths through 2026-08-04. |
| Focused tests | `pnpm.cmd --dir frontend exec jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-task-ordering.test.ts` | Passed | 1 suite, 6 tests. |
| Targeted lint | `pnpm.cmd --dir frontend exec eslint ...` | Passed | Planner and focused tests are clean. |
| Changed guardrails | `typecheck:changed`; `guardrails:unsafe-patterns` | Passed | No new any or unsafe-pattern debt. |
| Focused TypeScript | Compiler API using frontend `tsconfig.json` and planner root | Passed | Zero diagnostics after the versioned-placeholder fix. |
| Independent review | Code-review skill, standards and spec axes | Approved | Final review found no unresolved P1/P2 findings after full sibling CAS, version validation, null-key grouping, and placeholder containment. |
| Pure-planner publication | `remote-main-publish.mjs`; origin blob readback | Passed | Three exact files published at `cb9589cccf494935d2f169545a19727f99deab8a`; all local/remote blob IDs match. |

## Remaining Risk

- The pure plan is not authoritative until the project-locked RPC applies all
  rows atomically. Owner: scheduling database phase. Next action: implement the
  RPC immediately after CRM-002 retires.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred work names cause, owner, and next action.
