# Task: Exclusion-Aware Auto-Scheduling Propagation

Status: Completed
Owner: Codex
Created: 2026-07-28
Task ID: SCHED-EXCLUSION-PROPAGATION
Linear Issue: Not requested; local continuation of ALL-6

## Objective

Prevent an upstream schedule change from moving successors through a task whose
dates are protected by manual mode, actual dates, or persisted hourly segments.

## Scope

- Auto-scheduler preview graph and focused unit coverage.
- No schema, API, service, or user-interface changes.

## Source of Truth

- Canonical calculation owner: `frontend/src/lib/scheduling/schedule-auto-scheduler.ts`
- Shared date math: `frontend/src/lib/scheduling/schedule-impact-preview.ts`
- Existing service persistence owner remains unchanged.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] An upstream task-field change stops at a protected task.
- [x] A dependency-graph change stops at a protected task.
- [x] An independent path around a protected task still updates its eligible successor.
- [x] Protected tasks retain their existing skip reason.
- [x] Existing one-hop and multi-hop scheduling behavior remains covered.

## Failure-Loudly Contract

- Cause surfaced as: a focused regression test identifies the protected boundary and unexpected successor write.
- Detection path: focused Jest auto-scheduler suite.
- Recovery path: preserve protected incoming-edge filtering in the auto-scheduler preview graph.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused scheduling tests | `pnpm run test:unit -- --runInBand --runTestsByPath ...` | Passed, 35/35 | Auto-scheduler, impact preview, and service integration suites. |
| Focused ESLint | `pnpm exec eslint` on the four owned scheduling source/test files | Passed | No findings. |
| Independent code review | `code-reviewer` re-review | Approved | Initial HIGH diamond-graph finding was fixed with persisted fixed vertices; re-review found no remaining issues. |
| Diff guard | `git diff --check` | Passed | No whitespace errors. |

## Remaining Risk

- Predecessor reassignment reconciliation remains a separate documented ALL-6 follow-up.

## Final Status

- [x] Focused tests pass.
- [x] Independent review is complete.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.
