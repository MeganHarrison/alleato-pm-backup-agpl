# Task: Surface Auto-Scheduling Preconditions in the Schedule UI

Status: Complete
Owner: Codex
Created: 2026-07-28
Task ID: SCHED-ERROR-PROPAGATION

## Objective

Task and dependency editors must display the actionable `PRECONDITION_FAILED`
message returned by guarded scheduling APIs.

Delivery lane: Standard

## Acceptance

- [x] One schedule-specific parser supports legacy `error`, guarded `error_message`, and safe fallback responses.
- [x] Modal task updates display guarded scheduling messages.
- [x] Inline grid/Gantt task updates display guarded scheduling messages.
- [x] Dependency helpers retain guarded scheduling messages.
- [x] Focused tests and lint pass.
- [x] Independent React and code review pass.
- [ ] Task-owned files are published to `origin/main`.

## Evidence

| Check | Result |
| --- | --- |
| API client tests | 8/8 passed |
| Focused lint | 0 errors; 7 pre-existing raw-fetch/design-spacing warnings |
| Malformed error body | Safe fallback message |
| Guardrail envelope | `error_message` reaches modal and inline task error paths |
| Code review | APPROVE |
| React review | APPROVE |
