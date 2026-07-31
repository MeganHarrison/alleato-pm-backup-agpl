# Scheduling Functional Audit and Issue Log

Audit date: 2026-07-30  
Production URL: `https://projects.alleatogroup.com`  
Audited runtime source: `origin/main` at d293e851dbff20e7bdfb4f20d9470e5d708c1940
Production deployment: `dpl_5G21k8gq5Pef9Ygtx8Uo2g416E3x`
Audit status: Complete. All 38 previously unexecuted functions now pass against
the canonical production alias. All eight findings are fixed and verified.
The 35-test production run and independent cleanup readback pass.

## Purpose

This document is the executable acceptance matrix and issue log for the Alleato
PM scheduling application. The audit covers user-exposed scheduling functions,
their API/database boundaries, permission and failure states, and the production
desktop/mobile experience. Production mutations use disposable projects and
must end with a zero-residual cleanup readback. Existing project schedules,
including Nexcom, are read-only during the audit.

## Status and severity

- `PASS`: Current evidence proves the function on the audited revision.
- `FAIL`: The function is broken or materially misleading.
- `BLOCKED`: The function could not be tested because a prerequisite failed.
- `NOT RUN`: No current audit result yet.
- `UNIT/API`: Automated evidence exists, but production UI proof is still pending.

Issue severity:

- `P0`: Security, tenant isolation, or unrecoverable data-loss risk.
- `P1`: Core scheduling workflow is unusable or can commit incorrect data.
- `P2`: Important feature is broken, incomplete, or materially confusing.
- `P3`: Minor usability, accessibility, visual, or test-maintenance defect.

## Release baseline

| Check | Result | Evidence |
| --- | --- | --- |
| `origin/main` runtime source | PASS | d293e851dbff20e7bdfb4f20d9470e5d708c1940 |
| Production deployment | PASS | `dpl_5G21k8gq5Pef9Ygtx8Uo2g416E3x`, Ready |
| Production alias | PASS | `projects.alleatogroup.com` resolves to the audited deployment |
| Production source gate | PASS | Vercel deployed `The-Alleato-Group/project-management@main` source d293e851d, which contains CRM source ff173b702 and the scheduling recovery; exact alias inspection returned the audited deployment |
| Scheduling release suite | PASS | 80 suites, 489 tests; executable zero-warning guard |
| Authoritative production journey | PASS | 2 Playwright tests: transactional scheduling/cost/auth and alert fan-out |
| Duration and logic regression | PASS | Authenticated production test passed both entry orders and project-calendar exception |
| Remaining-function production matrix | PASS | 35 Playwright tests; all 38 previously `NOT RUN` rows exercised |
| Disposable audit cleanup | PASS | Database readback: disposable projects and all four synthetic-person classes each equal `0` |

## Functional acceptance matrix

### A. Schedule workspace and task lifecycle

| ID | Function | Unit/API | Production UI/API | Artifact or note |
| --- | --- | --- | --- | --- |
| A01 | Open Schedule workspace in authenticated app shell | UNIT/API | PASS | Current desktop and mobile production evidence |
| A02 | Gantt view renders dated and unscheduled tasks honestly | UNIT/API | PASS | Authoritative disposable-project journey and current project screenshot |
| A03 | Table view renders and supports task interaction | UNIT/API | PASS | Current production view switch and screenshot |
| A04 | Board view renders and supports task interaction | UNIT/API | PASS | Current production desktop/mobile view switch and screenshot |
| A05 | Timeline view renders and supports task interaction | PASS | PASS | Production proof suppressed the expired bar and clipped the overlapping bar to the visible boundary |
| A06 | Calendar view renders and supports task interaction | UNIT/API | PASS | Current production view switch and screenshot |
| A07 | Search, status, task-type, Today, and This Week filters | UNIT/API | PASS | Production UI filter journey; shared filter triggers have accessible labels |
| A08 | Quick-add task with Enter and deterministic insertion | UNIT/API | PASS | Production UI insertion plus durable API readback |
| A09 | Create a full task with dates, duration, WBS, status, and assignee | PASS | PASS | Production UI submit plus database/API readback of every field |
| A10 | Create a duration-only undated root task | PASS | PASS | Current production regression |
| A11 | Add logic after duration and auto-schedule | PASS | PASS | Current production regression |
| A12 | Add duration after logic and auto-schedule | PASS | PASS | Current production regression |
| A13 | Edit dates and cascade successors | UNIT/API | PASS | Authoritative production journey |
| A14 | Convert a dated task to a milestone and cascade | UNIT/API | PASS | Production mutation and successor readback |
| A15 | Constraints preview, reject conflicts, and preserve data | PASS | PASS | Production returned structured 409; task and graph remained unchanged |
| A16 | Parent/child hierarchy create and edit | UNIT/API | PASS | Authoritative production journey |
| A17 | Same-parent and cross-parent reorder | UNIT/API | PASS | Authoritative production journey |
| A18 | Bulk update and bulk delete | UNIT/API | PASS | Production exact-count and persistence assertions |
| A19 | Delete task with ordering repair and no orphaned facts | UNIT/API | PASS | Production task, ordering, dependency, assignment, deadline, segment, and update readbacks |
| A20 | Reload preserves committed task state | UNIT/API | PASS | Cost facts and diagnostics survived production reload |

### B. Dependencies, CPM, and dates

| ID | Function | Unit/API | Production UI/API | Artifact or note |
| --- | --- | --- | --- | --- |
| B01 | Create Finish-to-Start dependency | UNIT/API | PASS | Authoritative production journey |
| B02 | Create Start-to-Start dependency | UNIT/API | PASS | Authoritative production journey |
| B03 | Create Finish-to-Finish dependency | UNIT/API | PASS | Production relationship and calculated-date readback |
| B04 | Create Start-to-Finish dependency | UNIT/API | PASS | Production relationship and calculated-date readback |
| B05 | Apply positive lag and negative lead | UNIT/API | PASS | Positive lag in production; all four lead calculations in release suite |
| B06 | Edit predecessor using both old and new anchors | UNIT/API | PASS | Authoritative production journey |
| B07 | Delete dependency and move successor earlier | UNIT/API | PASS | Authoritative production journey |
| B08 | Multiple predecessors use the controlling relationship | UNIT/API | PASS | Authoritative production journey |
| B09 | Transitive cascade through multiple successors | UNIT/API | PASS | Production three-task cascade readback |
| B10 | Manual, actual-dated, and segmented tasks remain protected | UNIT/API | PASS | Production protected-date readback for all three task modes |
| B11 | Circular relationship fails with no partial write | UNIT/API | PASS | Production returned 400; task graph readback was unchanged |
| B12 | Cross-project relationship fails with no data exposure | UNIT/API | PASS | Production returned 403/404; source task was unchanged |
| B13 | Critical-path overlay and task markers | UNIT/API | PASS | Production Gantt critical-path UI markers |
| B14 | Gantt arrows suppress unknown endpoints | UNIT/API | PASS | Release suite plus production unscheduled-task journey |

### C. Calendars, deadlines, progress, and field updates

| ID | Function | Unit/API | Production UI/API | Artifact or note |
| --- | --- | --- | --- | --- |
| C01 | Edit project working weekdays | UNIT/API | PASS | Production project-calendar persistence readback |
| C02 | Add, edit, and remove non-working exceptions | UNIT/API | PASS | Production exception lifecycle readback |
| C03 | Add working-date overrides | UNIT/API | PASS | Production working-date override readback |
| C04 | Task calculations use the saved project calendar | PASS | PASS | Current production regression |
| C05 | Add, edit, and remove task deadline | UNIT/API | PASS | Production deadline lifecycle readback |
| C06 | Progress and status updates persist | UNIT/API | PASS | Production percent/status joint update readback |
| C07 | Audited field update records reason, note, and attachments | UNIT/API | PASS | Production reason, note, attachment, and forecast readback |
| C08 | Linked submittal risk displays, links, and removes correctly | PASS | PASS | Production link, risk report, and unlink lifecycle |

### D. Assignments, capacity, splits, and leveling

| ID | Function | Unit/API | Production UI/API | Artifact or note |
| --- | --- | --- | --- | --- |
| D01 | Assign active project person | UNIT/API | PASS | Authoritative production journey |
| D02 | Replace multiple assignments without changing dates | UNIT/API | PASS | Production clear/restore/readback |
| D03 | Allocation percentage validation and save | UNIT/API | PASS | Production saved 50 percent allocation |
| D04 | Resource availability uses project calendar and capacity | UNIT/API | PASS | Production disposable-project resource suite |
| D05 | Edit person/project capacity profile and dated exceptions | UNIT/API | PASS | Production capacity-profile suite |
| D06 | Overallocation and missing-capacity diagnostics | UNIT/API | PASS | Production diagnostic assertions |
| D07 | Add, edit, remove, and persist 15-minute task splits | UNIT/API | PASS | Production segment lifecycle and reload readback |
| D08 | Leveling preview is explicitly no-write | UNIT/API | PASS | Production before/after schedule-version comparison |
| D09 | Create, apply, list, and undo immutable leveling run | UNIT/API | PASS | Production preview, persisted run, apply, history, and undo assertions |
| D10 | Enterprise capacity remains project/tenant scoped and redacted | UNIT/API | PASS | Production project/tenant isolation and response-redaction assertions |

### E. Resource costs and earned value

| ID | Function | Unit/API | Production UI/API | Artifact or note |
| --- | --- | --- | --- | --- |
| E01 | Create person cost resource and hourly rate | UNIT/API | PASS | Authoritative production journey |
| E02 | Create equipment resource with day rate and cost per use | UNIT/API | PASS | Authoritative production journey |
| E03 | Create material resource with unit rate | UNIT/API | PASS | Authoritative production journey |
| E04 | Add/edit assignment planned and actual units | UNIT/API | PASS | Authoritative production journey |
| E05 | Persist explicit actual cost without inference | UNIT/API | PASS | Production readback preserved explicit/null actual cost |
| E06 | BAC, PV, EV, AC, CV, SV, CPI, and SPI are correct | UNIT/API | PASS | Production UI asserted every named metric |
| E07 | Missing data produces named completeness diagnostics | UNIT/API | PASS | Production UI exposed missing planned-hour diagnostic |
| E08 | Stale resource/assignment CAS returns visible conflict | UNIT/API | PASS | Production returned 409 and retained winner |
| E09 | Destructive resource/assignment deletion requires confirmation | UNIT/API | PASS | Production UI cancellation and explicit-confirmation journey |
| E10 | Reload preserves cost resources, assignments, and metrics | UNIT/API | PASS | Production reload readback |

### F. Revisions, baselines, reports, alerts, and import/export

| ID | Function | Unit/API | Production UI/API | Artifact or note |
| --- | --- | --- | --- | --- |
| F01 | Create immutable schedule revision | UNIT/API | PASS | Two production revisions created |
| F02 | Review and publish only through valid transitions | UNIT/API | PASS | Production review-to-published transitions |
| F03 | Capture named baseline and compare variance | UNIT/API | PASS | Production named-baseline and variance readback |
| F04 | Tracking Gantt baseline overlay | UNIT/API | PASS | Production tracking-overlay UI assertion |
| F05 | Published-revision lookahead report | UNIT/API | PASS | Production published-revision report |
| F06 | Published-revision risk summary | UNIT/API | PASS | Production risk report |
| F07 | Company-scoped trade activities | UNIT/API | PASS | Production company-scope assertion |
| F08 | Alert fan-out, recipient scoping, replay deduplication | UNIT/API | PASS | Two eligible recipients; inactive/cross-company excluded; replay deduplicated |
| F09 | Flat CSV and JSON exports disclose lossy behavior | UNIT/API | PASS | Production CSV/JSON content and loss-disclosure assertions |
| F10 | Microsoft Project XML preserves hierarchy and logic | UNIT/API | PASS | Production XML hierarchy/logic assertions |
| F11 | Lookahead XLSX and PDF exports match selected revision | UNIT/API | PASS | Production XLSX/PDF response and selected-revision assertions |
| F12 | Atomic schedule import rejects malformed graphs | UNIT/API | PASS | Production returned 400 and task count remained unchanged |

### G. Permissions, failure states, responsiveness, and recovery

| ID | Function | Unit/API | Production UI/API | Artifact or note |
| --- | --- | --- | --- | --- |
| G01 | Anonymous reads/writes fail with 401 | UNIT/API | PASS | Current production read and mutation checks |
| G02 | Expired authenticated mutation fails with 401 and no write | UNIT/API | PASS | Current production invalid-session mutation and readback |
| G03 | Viewer cannot perform schedule-admin transitions | UNIT/API | PASS | Synthetic viewer read succeeded; transition returned 403; revision stayed draft |
| G04 | Stale task, dependency, ordering, and cost writes return 409 | UNIT/API | PASS | Production task/cost conflicts retained task, dependency, and ordering facts |
| G05 | Loading, empty, unavailable, and retry states explain the problem | PASS | PASS | Production UI asserted status, empty, error, and successful retry states |
| G06 | Desktop layout exposes every scheduling workspace | UNIT/API | PASS | Current desktop screenshots for all five views and planning |
| G07 | Mobile layout remains usable without clipped controls | UNIT/API | PASS | 390x844 evidence; both navigation rows are horizontally scrollable |
| G08 | API/database failures do not leave partial mutations | UNIT/API | PASS | Cycle, stale-write, cross-project, and expired-session readbacks |
| G09 | Cleanup removes all disposable audit data | PASS | PASS | `residual_e2e_projects=0` |

## Issues

### SCHED-AUDIT-001

- Severity: P2
- Status: Fixed and verified against production
- Function IDs: A05
- Summary: Timeline draws activities outside the visible date window at false
  positions, so the chart does not match the authoritative task dates.
- Reproduction:
  1. Open project 67 and switch to Timeline.
  2. Leave the Timeline on its current `Jun 28` through `Oct 11, 2026` window.
  3. Compare `Design Phase`, `Receive Survey/TOPO`, and `Structural Design`
     with Table or the scheduling API.
- Expected: Activities ending before June 28, 2026 are not drawn in that
  window. A partially overlapping activity is clipped to its actual overlap.
- Actual: `Design Phase` (`2025-12-02` through `2026-03-23`) is drawn across
  the full current window. The two other already-finished activities are also
  anchored falsely at June 28.
- Evidence:
  `tests/agent-browser-runs/2026-07-30-scheduling-functional-audit/view-timeline.png`;
  production API readback for the four named activities.
- First failing boundary:
  `frontend/src/components/scheduling/schedule-views.tsx:1567`.
- Cause: `getTaskBarStyle` clamps every negative start offset to zero, keeps
  the task's entire original duration, and never suppresses tasks whose finish
  is before `timelineStart`.
- Detection gap: The 78-suite scheduling release gate has Gantt coverage but
  no date-window regression for `ScheduleTimelineView`.
- Prevention: Add interval-intersection logic plus tests for before-window,
  after-window, left-clipped, right-clipped, milestone, and exact-boundary
  cases. Include one screenshot assertion with authoritative dates.
- Recommended owner files:
  `frontend/src/components/scheduling/schedule-views.tsx` and a focused
  scheduling view test.
- Verification after fix: The three expired activities are absent in the
  current Timeline, `Vermillion Rise` is clipped to the visible interval, and
  the new Timeline tests pass in `test:schedule:release`.
- Remediation evidence: Eight interval-boundary tests, including spring and
  fall DST transitions, pass in the 80-suite/489-test scheduling release gate.
  An authenticated production Timeline journey on deployment
  `dpl_2WSJU5sKc1MwZ8xQHqWi1Jrf4HQ7` proved the expired task had no bar and the
  left-overlapping task was clipped to `left: 0%`.

### SCHED-AUDIT-002

- Severity: P0
- Status: Fixed and verified against production
- Function IDs: D01-D10, G09
- Summary: Three legacy scheduling E2E suites use fixed real project IDs; one
  repeatedly deletes every schedule test task for project 43.
- Reproduction: Point the Playwright configuration at production and inspect
  or execute `schedule.regression.spec.ts`, `schedule-resources.spec.ts`, and
  `schedule-resource-capacity.spec.ts`.
- Expected: Every mutating production test creates a uniquely named disposable
  project, scopes all rows to it, and proves zero residual rows in `finally`.
- Actual: Resource suites hard-code project 67. The regression suite hard-codes
  project 43 and calls `deleteScheduleTestTasks(PROJECT_ID)` throughout.
- Evidence:
  `frontend/tests/e2e/schedule/schedule-resources.spec.ts:9`,
  `frontend/tests/e2e/schedule/schedule-resource-capacity.spec.ts:6`, and
  `frontend/tests/e2e/schedule/schedule.regression.spec.ts:19`.
- First failing boundary: Test fixture ownership and project isolation.
- Cause: Legacy suites predate the disposable-project production harness.
- Detection gap: The tests have no fail-closed guard that rejects non-disposable
  project names or production base URLs.
- Prevention: Move all mutations to a shared disposable-project fixture; add a
  runtime assertion on the project-name prefix and a cleanup readback.
- Recommended owner files: The three E2E suites above and
  `frontend/tests/helpers/db.ts`.
- Verification after fix: All three suites run against production without
  touching project 43, project 67, or any pre-existing project, then report
  zero residual projects.
- Remediation evidence: Ten authenticated Playwright tests passed against
  uniquely named disposable projects. Every destructive operation validates
  exact name, ID, creation provenance, and an opaque per-run token. Database
  readback returned zero disposable projects and zero synthetic people.

### SCHED-AUDIT-003

- Severity: P3
- Status: Fixed and verified in the release gate
- Function IDs: C05-C08, D07
- Summary: Passing React component tests emit repeated unwrapped asynchronous
  state-update warnings.
- Reproduction: Run `npm.cmd run test:schedule:release`.
- Expected: The release gate passes without React `act(...)` warnings.
- Actual: `TaskSegmentEditor` updates at lines 84 and 91 and
  `TaskEditModal` updates at line 342 repeatedly warn while tests pass.
- Evidence: Current 78-suite/474-test console output.
- First failing boundary: Test setup does not await component data-loader
  settlement.
- Cause: Modal tests finish assertions before all child asynchronous effects
  settle.
- Detection gap: Console warnings do not fail the Jest run.
- Prevention: Await loader settlement in the affected tests and add a
  fail-on-unexpected-console policy for scheduling component suites.
- Recommended owner files:
  `frontend/src/components/scheduling/__tests__/task-edit-modal.*.test.tsx`,
  `task-segment-editor.test.tsx`, and their shared test setup.
- Verification after fix: All 489 tests pass with no unexpected React warning.
- Remediation evidence: The four affected modal suites explicitly await the
  nested segment loader; the full 80-suite gate captures Jest output and fails
  if a React `act` warning returns.

### SCHED-AUDIT-004

- Severity: P1
- Status: Fixed and verified against production
- Function IDs: A09
- Summary: Full task creation accepted an assignee in the normal UI but silently
  discarded `assignee_person_id` before the database write.
- First failing boundary:
  `frontend/src/app/api/projects/[projectId]/scheduling/tasks/route.ts`.
- Cause: The create route did not forward `assignee_person_id` or normalize the
  requested schedule mode into its service payload.
- Detection gap: Existing tests asserted the visible success path without a
  database readback for every submitted full-task field.
- Prevention: The route test now asserts the complete creation payload, and the
  production matrix compares dates, duration, WBS, status, assignee, and mode
  with the committed task.
- Remediation evidence: A09 passed against deployment
  `dpl_yUBjAnA871zfRhVyJ8mHgi61ozQH`.

### SCHED-AUDIT-005

- Severity: P2
- Status: Fixed and verified against production
- Function IDs: A15
- Summary: A valid constraint conflict preserved data atomically but was
  surfaced as an internal 500 instead of an actionable precondition response.
- First failing boundary:
  `frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/dependencies/route.ts`.
- Cause: The route allowed the scheduling service's constraint-conflict error
  to fall through the generic internal-error handler.
- Detection gap: The regression contract checked atomicity but not the
  structured HTTP error classification.
- Prevention: Constraint conflicts are mapped to `PRECONDITION_FAILED` with
  HTTP 409, and both the route test and production matrix assert that contract.
- Remediation evidence: A15 passed with a structured 409 and unchanged task and
  dependency readbacks.

### SCHED-AUDIT-006

- Severity: P2
- Status: Fixed and verified against production
- Function IDs: C08
- Summary: Linking a submittal succeeded, but reading linked submittal risk
  failed because PostgREST found two possible schedule-task relationships.
- First failing boundary:
  `frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/submittals/route.ts`.
- Cause: The embedded `schedule_tasks` relationship did not name the successor
  foreign key.
- Detection gap: The route test mocked a single relationship and did not assert
  the generated select expression.
- Prevention: The query now names
  `schedule_dependencies_task_id_fkey`, and the focused test freezes that
  relationship contract.
- Remediation evidence: C08 passed the production link, risk-read, and unlink
  lifecycle.

### SCHED-AUDIT-007

- Severity: P3
- Status: Fixed and verified against production
- Function IDs: A07, G05
- Summary: Filter controls and the schedule-loading state worked visually but
  did not expose complete accessible names/status to assistive technology.
- First failing boundaries:
  `frontend/src/components/tables/unified/table-toolbar.tsx` and
  `frontend/src/app/(main)/[projectId]/schedule/page.tsx`.
- Cause: Filter select triggers had no accessible label, and the loading
  skeleton had no status text.
- Detection gap: Earlier visual assertions did not query controls and state by
  accessible role/name.
- Prevention: Shared filters now expose `<label> filter`, the schedule skeleton
  exposes a screen-reader status, and the production matrix locates both by
  accessible semantics.
- Remediation evidence: A07 and G05 passed against the canonical production
  alias; all eight focused shared-toolbar tests also pass.

### SCHED-AUDIT-008

- Severity: P3
- Status: Fixed and verified against production
- Function IDs: A07
- Summary: The production filter matrix encoded July 30 and August 1, 2026 as
  Today and This Week, so its Today assertion expired when the date advanced.
- First failing boundary:
  `frontend/tests/e2e/schedule/schedule-production-matrix.spec.ts`.
- Cause: Calendar-sensitive fixtures used audit-day literals instead of dates
  derived from the runtime week.
- Detection gap: The original acceptance run and publication both occurred on
  the date encoded by the fixture, so no date-boundary rerun had occurred.
- Prevention: Capture one runtime timestamp, derive a Monday-based week, place
  Today and This Week fixtures inside it, and place Future two weeks outside it.
- Remediation evidence: The focused A07 rerun and the full 35-test matrix both
  passed against deployment `dpl_5G21k8gq5Pef9Ygtx8Uo2g416E3x` on 2026-07-31.

## Evidence ledger

| Timestamp | Command or action | Result | Artifact |
| --- | --- | --- | --- |
| 2026-07-30 | Verify `origin/main`, Vercel deployment, and production alias | PASS | Deployment `dpl_BDpw3BttmCWuMGSmnRQdgZm1FRsG` |
| 2026-07-30 | `npm.cmd run test:schedule:release` | PASS: 78 suites, 474 tests | Console result |
| 2026-07-30 | `schedule-authoritative-transactions.spec.ts` against production | PASS: 2 of 2 | Transaction, cost, auth, revision, and alert journey |
| 2026-07-30 | Switch through Gantt, Table, Board, Timeline, Calendar, and planning | FAIL: Timeline date placement | `tests/agent-browser-runs/2026-07-30-scheduling-functional-audit/` |
| 2026-07-30 | Compare Timeline bars with production scheduling API dates | FAIL: off-window tasks drawn | `SCHED-AUDIT-001` |
| 2026-07-30 | Inspect mutating E2E project isolation before execution | BLOCKED unsafe suites | `SCHED-AUDIT-002` |
| 2026-07-30 | Authenticated duration/logic production regression | PASS | Both entry orders; saved calendar exception honored |
| 2026-07-30 | Disposable production cleanup readback | PASS | `residual_e2e_projects=0` |
| 2026-07-30 | Remediated scheduling release gate | PASS: 80 suites, 489 tests | Includes Timeline, ownership-token, and warning-failure guardrails |
| 2026-07-30 | Three remediated scheduling E2E suites against production | PASS: 10 of 10 | Disposable projects only; validation and reload persistence; zero-residual readback |
| 2026-07-30 | Final authenticated Timeline clipping proof against production | PASS: 1 of 1 | Deployment `dpl_2WSJU5sKc1MwZ8xQHqWi1Jrf4HQ7`; expired bar absent; overlapping bar clipped; `schedule-timeline-production-final.png` |
| 2026-07-30 | Post-proof disposable cleanup readback | PASS | `residual_disposable_schedule_projects=0`; `residual_synthetic_people=0` |
| 2026-07-30 | Focused repaired-route regression | PASS: 17 of 17 | Task create, dependency guardrail, and linked-submittal route suites |
| 2026-07-30 | Shared toolbar regression | PASS: 8 of 8 | Filter/view/column toolbar suites |
| 2026-07-30 | Vercel source and alias readback | PASS | aa94ed8d9; deployment `dpl_yUBjAnA871zfRhVyJ8mHgi61ozQH`; canonical alias attached |
| 2026-07-30 | Remaining scheduling production matrix plus safe resource suites | PASS: 35 of 35 in 2.0 minutes | `schedule-production-matrix.spec.ts` plus regression, resources, and resource-capacity suites |
| 2026-07-30 | Independent post-matrix cleanup readback | PASS | Disposable projects, matrix people, P4A people, P4B people, and viewer people all `0` |
| 2026-07-31 | CRM/types integration ancestry and scheduling-surface comparison | PASS | ff173b702 and the scheduling recovery are ancestors of d293e851d; no scheduling path or database types changed after ff173b702 |
| 2026-07-31 | Integrated scheduling route and toolbar tests | PASS: 17 route and 8 toolbar tests | Regenerated database types retained authoritative scheduling declarations |
| 2026-07-31 | Current production alias readback | PASS | Deployment `dpl_5G21k8gq5Pef9Ygtx8Uo2g416E3x`, source d293e851d, Ready |
| 2026-07-31 | Date-resilient production scheduling matrix | PASS: 35 of 35 in 1.5 minutes | All 38 matrix rows plus regression, resources, and capacity suites |
| 2026-07-31 | Post-integration cleanup readback | PASS | Disposable projects, matrix people, P4A people, P4B people, and viewer people all `0` |

## Open verification notes

- No scheduling row remains `NOT RUN`, `FAIL`, or `BLOCKED` in this audit.
- The earlier fixed-project suite block is resolved by exact per-run ownership
  tokens and guarded cleanup.
- The remaining-function run used only uniquely named disposable projects and
  synthetic identities. It did not mutate Nexcom, project 43, project 67, or
  any other pre-existing project.
- The separate legacy Vercel project named `frontend` rejected the Git author.
  It is not the canonical production project. The linked
  `project-management-agent` deployment built the exact audited commit and owns
  `projects.alleatogroup.com`.
