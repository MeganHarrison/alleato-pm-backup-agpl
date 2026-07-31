# Task: Add Schedule Network Intelligence

Status: Complete - Pushed
Owner: Codex
Created: 2026-07-21
Task ID: LOCAL-2026-07-21-SCHEDULE-NETWORK
Linear Issue: Unavailable — no Linear write tool is installed in this Codex session; tool inventory was checked on 2026-07-21.
Related Handoff: N/A — single-session implementation with evidence under `docs/ops/evidence/2026-07-21-schedule-project-parity/`.

## Objective

Give an authorized project manager a trustworthy critical-path and schedule-health view on the canonical schedule page without silently changing saved task dates.

## Scope

- Own the pure schedule network-analysis engine, server-side Gantt enrichment, critical-path Gantt control, focused tests, production verification, and the Microsoft Project parity roadmap.
- Reuse `SchedulingService`, `GanttChart`, the canonical schedule page, and existing scheduling types and persisted relationships.
- Exclude calendar-aware automatic rescheduling, baselines, resource assignments/leveling, cost and earned value, multi-project scheduling, and full MPP/XML interoperability; these are phased in the parity roadmap.

## Source of Truth

- Canonical runtime/data owner: persisted schedule tasks, dependencies, and deadlines loaded by `SchedulingService.getGanttData()`.
- Existing shared primitives/services: `SchedulingService`, `GanttChart`, schedule page view controls, `Button`, and `Badge`.
- Deprecated or parallel paths: N/A; the analysis is centralized rather than duplicated in the page or Gantt component.

Verification contract: Required

## Acceptance Criteria

- [x] Critical-path status and total float are calculated across saved dependencies.
- [x] All four dependency types and stored lag values participate in the network calculation.
- [x] Dependency, deadline, constraint, missing-date, and circular-dependency problems fail loudly through task warning state.
- [x] A project manager can toggle the critical-path overlay on the canonical Gantt view.
- [x] Analysis does not silently overwrite persisted dates.
- [x] The authenticated production route displays the control and resulting critical/warning state with screenshot evidence from the published revision.

## Implementation Checklist

- [x] Owned files are limited to the schedule analysis, schedule/Gantt integration, types, focused tests, task record, roadmap, and evidence.
- [x] The shared scheduling engine owns network calculations and warning logic.
- [x] Warning codes are specific and available to all Gantt consumers.
- [x] No database, provider, authentication, or permission contract changes are required.
- [x] A dependency endpoint regression prevents duration-derived false warnings from replacing actual linked-date validation.

## Integration and Verification

- [x] Focused static and unit checks pass.
- [x] Authenticated production readback proves the requested outcome.
- [x] A canonical-route screenshot is recorded in the active Codex task.
- [x] Known limits and the remaining Microsoft Project parity work are recorded.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: typed task warning codes for dependency violations, missed deadlines, constraint violations, missing dates, and circular dependencies.
- Detection path: schedule engine regression tests plus warning indicators in the canonical Gantt task rows.
- Recovery path: correct the linked dates/dependency, deadline, or constraint; add missing dates; or remove the circular link, then refresh the schedule.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: existing persisted dependencies and deadlines were visible but did not drive a shared critical-path or schedule-health analysis.
- Detection gap: previous lifecycle tests proved CRUD and connectors but did not calculate network float or validate whether saved dates honored dependency endpoints.
- Prevention: centralized pure analysis plus relationship-offset, endpoint-validation, cycle, constraint, deadline, service-enrichment, and accessible-overlay regression tests.
- Guardrail evidence: `docs/ops/evidence/2026-07-21-schedule-project-parity/verification.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| TDD | RED/GREEN commits listed in verification evidence | Pass | Two red/green cycles cover the feature and endpoint-accuracy correction. |
| Focused feature tests | Network engine, Gantt overlay, scheduling service | Pass | 3 suites, 19 tests. |
| Scheduling regression | 12 scheduling suites | Pass | 51 tests, including existing dependency and deadline lifecycle coverage. |
| Network coverage | Jest coverage | Pass | 94.95% statements, 82.23% branches, 100% functions, 98.13% lines. |
| Changed-file typecheck | `npm run typecheck:changed` | Pass | No new `any` usage. |
| Unsafe-pattern guard | `npm run guardrails:unsafe-patterns` | Pass | No unsafe pattern introduced. |
| Changed-file lint debt | `npm run lint:changed:debt` | Pass | No new lint debt. |
| Direct touched-file lint | ESLint on implementation and tests | Pass | Zero errors; existing warnings remain outside this behavior. |
| Browser: production schedule | Authenticated `https://projects.alleatogroup.com/767/schedule` plus active-task screenshot | Pass | Critical Path was pressed; one task rendered critical and eight tasks exposed warning indicators. |
| Production deployment | Vercel status for `f72fc26c57e6f4a5a585d6e62f580dd22a78dd14` | Pass | GitHub commit status reported Vercel success. |
| Global predeploy gate | GitHub Actions run `29857458369` | Unrelated failure | 13 pre-existing API route guardrail violations; no scheduling-owned path appeared in the failure log. |

## Remaining Risk

- Calendar-day math is intentionally limited until project and resource calendars are implemented in Phase 2; owner: schedule engine; next action: add calendar data contracts and reschedule preview.
- Summary task rollups are not yet part of the CPM contract; owner: schedule engine; next action: define leaf-versus-summary calculation rules in Phase 2.
- The global predeploy scanner remains red on unrelated API-route debt; owners of FMDS, accounting, reconciliation, admin, search, document picker, and estimates routes must remediate their existing guardrail failures.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in for completed checks.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred work has an owner and next action in the parity roadmap.
