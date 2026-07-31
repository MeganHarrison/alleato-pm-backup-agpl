# Task: Make CPM Impact Preview Calendar-Aware

Status: In Progress
Owner: Codex SROOT1188
Created: 2026-07-21
Task ID: AAI-1188
Linear Issue: [AAI-1188](https://linear.app/megankharrison/issue/AAI-1188/calculate-cpm-float-and-calendar-aware-schedule-impacts)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT1188-cpm-calendar-impact.md`

## Objective

Before saving a schedule edit, a project manager can see the calculated weekday-based successor movement and any constraint conflict without mutating persisted dates.

## Scope

- Own the shared schedule-impact calculation, its focused tests, and the canonical task-edit modal presentation.
- Reuse persisted task dates, dependencies, constraints, and the existing schedule-network critical-path engine.
- Treat Saturday and Sunday as non-working days in this slice. Project holiday/resource calendar persistence is deferred because no schedule-calendar data contract exists yet.
- Exclude automatic date writes, baseline revisions, and resource leveling.

## Source of Truth

- Canonical runtime/data owner: `ScheduleTask`, `ScheduleDependency`, and `TaskEditModal`.
- Existing shared primitives/services: `schedule-network-analysis.ts`, `TaskEditModal`, existing scheduling types.
- Deprecated or parallel paths: the unreachable `5b3abb834` prototype; its behavior must be replaced by current-main, tested code rather than revived wholesale.

Verification contract: Required

## Acceptance Criteria

- [x] Weekends are skipped when previewing impacted successor dates.
- [x] FS, SS, FF, and SF relationships with lag identify affected successors.
- [x] Constraint conflicts are explicit before save.
- [x] The canonical edit modal exposes the impact without altering saved task data.
- [x] Focused tests began red and remain green for each behavior.

## Implementation Checklist

- [x] Ownership, data contract, canonical UI, and existing implementation were inspected.
- [x] Pure calendar-aware preview owns the dependency calculation.
- [x] Modal reuses the preview instead of duplicating dependency math.
- [x] Missing dates/cycles fail loudly rather than produce misleading impact.

## Integration and Verification

- [x] Focused unit and modal tests pass.
- [ ] Final canonical-route interaction proof and data readback are recorded.
- [x] Authenticated canonical-route preflight is recorded.
- [ ] Linear comment includes source links and evidence.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an explicit unavailable preview for missing dates/cycles, or a named constraint conflict.
- Detection path: focused preview/modal tests and the pre-save impact section.
- Recovery path: complete the required task dates, remove the circular dependency, or correct the constraint before saving.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the existing network engine exposes current criticality but does not calculate date movement caused by an unsaved edit.
- Detection gap: Gantt rendering and persisted-date warnings did not prove the editor could warn before a write.
- Prevention: a shared pure preview with test coverage for calendar arithmetic, relationships, and constraints.
- Guardrail evidence: RED `schedule-impact-preview.test.ts` missing-module failure, followed by GREEN focused Jest 2 suites / 7 tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Existing-main audit | `git log`, `schedule-network-analysis.ts`, task modal | Pass | Current `main` already has critical-path/float analysis but lacks calendar-aware pre-save impact. |
| TDD | `npm --prefix frontend run test:unit -- --runInBand src/lib/scheduling/__tests__/schedule-impact-preview.test.ts src/components/scheduling/__tests__/task-edit-modal.cpm.test.tsx` | Pass | 2 suites / 7 tests; tests were first run red before the preview module and modal behavior were added. |
| Targeted lint | `cd frontend && npx eslint …` | Pass with existing warnings | 0 errors; six warnings predate this slice in the existing modal. |
| Auth preflight | `npm run verify:browser -- --url "https://projects.alleatogroup.com/43/schedule" --name "aai-1188-auth-preflight"` | Pass | Fresh saved Playwright/agent-browser authentication and canonical route proof at `tests/agent-browser-runs/2026-07-21T18-55-42-520Z-aai-1188-auth-preflight/`. |
| Incremental publication | `e4c47b15d` | Pass | Focused preview implementation published to `origin/main`; browser deployment/readback remains pending. |

## Remaining Risk

- Project-specific holidays and resource calendars require a persisted calendar contract; owner: follow-on Schedule calendar slice; next action: define schema/API/UI before claiming custom non-working-date support.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [ ] Deferred work has cause, detection gap, prevention step, owner, and next action.
