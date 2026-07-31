# Scheduling release verification

Task: `SCHED-TRANSACTIONAL-COMPLETE`

Restored authoritative scheduling release:
`3ec31df5d3d1c58740f3001565184d163a7cb80f`

HTTP conflict correction:
`58cded957a198eb4b2232691badabe90a5cf67eb`

Alert-response hardening:
`73f8edfce96ab70bb19a6ebaa0035351106d79fc`

Verified deployed application revision:
`73f8edfce96ab70bb19a6ebaa0035351106d79fc` (contains the authoritative
scheduling repairs, HTTP conflict correction, replay deduplication, and
malformed-alert response guard)

## QA inventory

| Claim or control | Functional check | Visual state | Evidence |
| --- | --- | --- | --- |
| Task, dependency, cascade, and order changes are one authoritative mutation | Scheduling release suite plus live create/reload/delete | Table workspace after Enter insertion | `desktop-table-task-created.jpg` |
| People replacement preserves cost-owned assignments and rejects stale snapshots | PostgreSQL behavior probe plus assignment route regression | Visible stale conflict | `desktop-stale-conflict.jpg` |
| Equipment and material rates and explicit actuals persist | Create a temporary resource and task assignment, reload, then remove both | Populated cost editor and assignment table | `desktop-cost-earned-value.jpg` |
| BAC/PV/EV/AC/CV/SV/CPI/SPI and completeness diagnostics are visible | Inspect metrics after the temporary assignment is saved | Cost and earned value summary | `desktop-cost-earned-value.jpg` |
| Destructive cost actions disclose consequences | Open the assignment delete confirmation before confirming | Confirmation dialog | `desktop-delete-confirmation.jpg` |
| Core schedule remains usable on a small viewport | Open the deployed schedule and planning view at 390 by 844 | Mobile viewport | `mobile-schedule.jpg` |
| Invalid or stale writes fail loudly | Advance a resource cost version, submit the stale UI draft, and observe HTTP 409 messaging | Destructive error alert | `desktop-stale-conflict.jpg` |
| Reload preserves committed state | Reload after task/resource/assignment saves and find the same records | Reloaded cost panel | `desktop-cost-earned-value.jpg` |
| Normal schedule workspace is exposed on final production | Open project 67 from the production alias after deployment promotion | Current desktop and mobile schedule workspaces | `final-production-schedule-desktop.png`, `final-production-schedule-mobile.png` |
| Planning features are exposed on final production | Open Resources, costs, leveling, revisions & reports after deployment promotion | Current desktop and mobile planning workspaces | `final-production-planning-desktop.png`, `final-production-planning-mobile.png` |

Exploratory checks:

- Attempt a stale resource update after the same resource is advanced by a second authenticated request.
- Exercise a destructive assignment action through its confirmation boundary and cancel once before confirming.
- Inspect dense desktop and mobile layouts for clipping, overflow, illegible labels, weak contrast, or obscured controls.

## Automated verification

- Scheduling release suite: **PASS**, 78 suites and 467 tests.
- Production transactional journey: **PASS**, 1/1.
- Production alert fan-out and replay journey: **PASS**, 1/1.
- Alert replay and malformed-composite regression: **PASS**, 5/5 route tests.
- Reviewer regression suite: **PASS**, 11 suites and 81 tests.
- Final production-repair regression: **PASS**, 3 suites and 18 tests.
- Canonical ordering helper regression: **PASS**, 7/7 tests.
- Scoped production TypeScript surface: **PASS**, no diagnostics.
- Unsafe-pattern guard: **PASS**, 32 changed frontend source files.
- Focused ESLint: **PASS**, zero errors.
- Independent review: **APPROVED**, zero findings.

The full repository TypeScript check was also attempted with an 8 GB heap. It
completed with pre-existing diagnostics in unrelated modules, so the passing
TypeScript claim above is deliberately limited to the owned scheduling release
surface.

## Database verification

The linked PM Supabase project is `lgveqfnpkxvzbnnwuled`.

- Migrations `20260729190000`, `20260729191000`, `20260729192000`,
  `20260729213000`, and `20260729214000` are recorded in the live migration
  ledger.
- The four-argument `replace_schedule_task_assignments(integer, uuid, jsonb, jsonb)` function exists.
- The former three-argument assignment function is absent.
- `authenticated` has execute permission; `anon` and `service_role` do not.
- The dependency endpoint-version trigger is enabled.
- The deployed function contains both the expected-assignment snapshot and person-resource filter.
- Exact live readback of all 14 public/private scheduling conflict functions
  reports `uses_http_409=true`; no scheduling or leveling function retains a
  legacy `40001` conflict signal.
- Local PostgreSQL 17 rollback probes proved exact stale CAS rejection, equipment/material preservation, person display-name/resource-kind hydration, and dependency version invalidation.
- PostgreSQL 17 definition-rewrite probes passed for 6/6 transactional/cost
  functions and 8/8 Phase 4C capacity/leveling functions.

The Supabase CLI linked pgTAP wrapper could not start because Docker Desktop was unavailable. Migration compilation, rollback behavior probes, live ledger/schema/grant readback, and application regressions provide the release evidence instead.

## Production deployment

Vercel deployment `dpl_78RhkjfHjaCvhGFas6aKY17GvfT3`
(`project-management-agent-h8yb5qo0t-the-alleato-group.vercel.app`) is **Ready**
from exact application SHA `73f8edfce96ab70bb19a6ebaa0035351106d79fc`
and is aliased to `projects.alleatogroup.com`. Vercel's production-source guard
confirmed the repository, branch, and SHA during the build.

## Authenticated production action log

- Table quick-add created `SCHED QA Task 20260729-1710` with HTTP 201 as a root
  task, then a full reload and task API readback found the same id, root parent,
  ordering, and schedule version.
- Trade activities returned HTTP 200 without an ambiguous-company relationship
  error.
- Equipment resource creation returned HTTP 201 with `$500/day` and `$100/use`.
  The assignment returned HTTP 201 with four planned units, two actual units,
  `$550` actual rate, and `$1,200` explicit actual cost.
- Reload readback preserved resource cost version 1 and assignment cost version
  1. The UI showed BAC `$2,100`, EV `$0`, AC `$1,200`, CV `-$1,200`, CPI
  `0.000`, and explicit PV/SV/SPI diagnostics because the temporary task had no
  dates.
- A second authenticated writer advanced the resource twice. Submitting the
  stale UI draft returned HTTP 409 with `PRECONDITION_FAILED` and visibly
  reported “Cost resource changed since it was loaded.”
- Assignment deletion was canceled once, reopened, visually inspected, and
  confirmed; the assignment and resource DELETE requests both returned HTTP
  200.
- An unauthenticated task POST returned HTTP 401. A cross-project task DELETE
  returned HTTP 404 and left the original project-67 task intact.
- Cleanup deleted the temporary task with HTTP 200. Final API readback found no
  temporary task, unauthorized task, resource, or assignment.
- The final isolated production transaction journey passed task creation,
  dependency creation/reassignment/deletion, cascade dates, ordering,
  hierarchy, stale task conflict, cost resources and assignments, EVM,
  incomplete-cost diagnostics, anonymous 401, invalid-session 401, and cleanup.
- The final isolated alert journey passed published-revision company fan-out,
  inactive/unrelated-user exclusion, deterministic replay deduplication, delivery
  count stability, anonymous mutation rejection, and cleanup.
- The final live rerun against deployment `dpl_78RhkjfHjaCvhGFas6aKY17GvfT3`
  passed both journeys in 39.8 seconds. Database cleanup readback returned zero
  residual `E2E authoritative schedule` projects.

## Visual review

- Final desktop schedule and planning views were inspected at 1536 by 791.
  Gantt, alternate views, filtering controls, project resource load, leveling
  preview, cost/EVM, revisions, and reports were visibly exposed.
- Final mobile schedule and planning views were inspected at 430 by 932. The
  responsive board and the resource/cost planning workspace remained readable
  with bottom navigation available.
- Current evidence images: `final-production-schedule-desktop.png`,
  `final-production-planning-desktop.png`,
  `final-production-schedule-mobile.png`, and
  `final-production-planning-mobile.png`.
- Earlier detailed flow evidence remains in `desktop-table-task-created.jpg`,
  `desktop-cost-earned-value.jpg`, `desktop-stale-conflict.jpg`,
  `desktop-delete-confirmation.jpg`, and `mobile-schedule.jpg`.
