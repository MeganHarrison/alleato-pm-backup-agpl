# Task: Keep Unscheduled Tasks Honest in the Gantt

Status: Complete
Owner: Codex
Created: 2026-07-29
Task ID: SCHED-GANTT-UNSCHEDULED
Linear Issue: Not requested; this is a bounded production bug correction.
Related Handoff: `SCHEDULING-PROJECT-HANDOFF-2026-07-29.md`

## Objective

Keep a schedule task with no start, finish, or duration visible as unscheduled
without inventing today's date, rendering a fake task bar, or drawing a
dependency arrow to an unknown endpoint.

## Scope

- Shared scheduling service Gantt adapter, Gantt renderer, types, and focused tests.
- Windows-safe lint-staged argument and pnpm plugin resolution required to publish the task from the canonical checkout path.
- Client/server attachment boundary correction required to unblock the production Next.js build.
- Production Nexcom project 1144 readback and authenticated final-route proof.
- Excludes changing Nexcom's business schedule dates or assigning a duration on Brandon's behalf.

## Source of Truth

- Canonical runtime/data owner: `schedule_tasks` and `schedule_dependencies` in PM APP.
- Existing shared primitives/services: `SchedulingService.getGanttData` and `GanttChart`.
- Deprecated or parallel paths: N/A.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] A fully undated task remains visibly marked `Unscheduled`.
- [x] No fabricated start/finish date or Gantt bar is emitted.
- [x] Dependency arrows render only when both required date endpoints exist.
- [x] Tasks with one endpoint plus duration still derive the other endpoint.
- [x] The exact Nexcom data shape is covered by a regression test.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and `origin/main` includes the exact revisions.

## Failure-Loudly Contract

- Cause surfaced as: the task row says `Unscheduled` and carries `missing_dates`; no visual date is fabricated.
- Detection path: live PM APP readback, focused service/component regression, and final-route screenshot.
- Recovery path: enter a duration and/or valid scheduling anchor, then apply the dependency cascade.

## Incident Learning

- Failure fingerprint: `N/A`
- Registry disposition: lookup found no matching recurring scheduling-renderer failure; this is the first fully undated Gantt boundary defect.
- Root cause: The Gantt adapter converted a task with no dates or duration into a today-to-today display interval even though the network analysis correctly marked it missing dates.
- Detection gap: The earlier Nexcom regression covered a missing finish with a valid start and duration, but not the fully unscheduled shape that remained in the live project.
- Prevention: Preserve null schedule facts through the Gantt adapter, make the renderer explicitly represent unscheduled work, and test bar and arrow suppression.
- Guardrail evidence: Focused service and Gantt component regression tests plus production project 1144 readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live database localization | Read-only `schedule_tasks` and `schedule_dependencies` query for project 1144 | Pass | Dependency is correct; successor has null start, finish, and duration. |
| Focused regression | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/lib/services/__tests__/scheduling-service.gantt.test.ts src/components/scheduling/__tests__/gantt-chart-unscheduled.test.tsx` | Pass | 2 suites, 10 tests; covers forward/reverse endpoint derivation and all four dependency types. |
| Scheduling release suite | `npm.cmd run test:schedule:release` | Pass | 75 suites, 420 tests before the final test-matrix expansion; final task-owned regression rerun passed 10/10. |
| Targeted ESLint | `npx.cmd eslint` on the five task-owned TypeScript/TSX files | Pass with existing warnings | 0 errors; 7 pre-existing Gantt design-system warnings and one ignored generated-type warning. |
| Windows lint-staged gate | `$env:PATH='C:\Program Files\Git\bin;' + $env:PATH; npx.cmd lint-staged` | Pass | Quoted checkout paths and resolved pnpm ESLint peer plugins without bypassing the pre-commit hook. |
| Deployment-boundary regression | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/lib/documents/__tests__/pattern-c-entity-types.test.ts` plus targeted ESLint | Pass | Meetings client code now imports a client-safe entity registry instead of the server-only workflow pipeline; 1 suite/1 test and 0 lint errors. |
| Concurrent-main reconciliation | Vercel build log for `c0ddf8998fbc` plus latest-main import graph review | Pass | Restored the `*Record` helpers introduced by `17c7b78ea` and kept pipeline enqueueing in `pattern-c-attachments.server.ts`; independent review found no issue. |
| Repository typecheck | `node scripts/run-typecheck-bounded.mjs` | Fail unrelated | Existing repository-wide errors remain; no diagnostic named a task-owned file. |
| Production deployment | `https://project-management-agent-9ncj4rekh-the-alleato-group.vercel.app` | Ready | Vercel built `origin/main` commit `1c6c271ab8df`; the prior client-to-workflow import error and concurrent missing-export warnings are absent. |
| Authenticated production Gantt | `C:\Users\Brandon\.codex\visualizations\2026\07\29\019faf0c-4f5b-79b1-a9cf-a3af4273cb43\scheduling-gantt-unscheduled-production.png` | Pass | On project 67, a temporary undated task rendered `Unscheduled` with one label (table only) while a dated task rendered twice (table + bar). No test task remained: DELETE returned 200 and follow-up GET returned 404. |

## Remaining Risk

- Nexcom's `Pipe installation` duration is a business input and remains unset until a project user supplies it.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
