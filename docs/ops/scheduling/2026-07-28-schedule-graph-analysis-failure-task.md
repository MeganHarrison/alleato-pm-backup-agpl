# Task: Make Auto-Scheduling Analysis Fail Explicitly

Status: Complete - engine and service
Owner: Codex
Created: 2026-07-28
Task ID: SCHED-GRAPH-FAILURE

## Objective

Auto-scheduling must never report `no_change` when its affected graph cannot be
analyzed. Task updates and dependency create/update operations must fail before
writing when the affected chain is circular or lacks valid scheduling data.

Delivery lane: Standard

## Acceptance

- [x] `no_change` means analysis succeeded and produced no date updates.
- [x] Circular dependency analysis returns a typed unavailable result.
- [x] Missing schedule data returns a typed unavailable result.
- [x] Task and dependency create/update mutations reject unavailable analysis before writes.
- [x] API guardrails preserve the actionable precondition message.
- [x] Focused engine and service tests pass.
- [x] Independent code review passes.
- [ ] Task-owned files are published to `origin/main`.

## Deletion Exception

Dependency deletion remains allowed because it may repair the invalid graph.
Its recalculation and user-visible warning receipt are owned by the dependency
deletion-relaxation phase.

## Evidence

| Check | Result |
| --- | --- |
| Engine and service tests | 30/30 passed |
| Focused lint | 0 errors, 0 warnings |
| Failure classification | `PRECONDITION_FAILED` before mutation writes |
| Endpoint derivation | Start-only and finish-only anchors derive the missing endpoint with the project calendar |
| Invalid endpoint regression | Returns `unavailable / missing_dates`; no raw calendar exception |
| Independent review | APPROVE after two repair/re-review cycles |

The schedule page's task-update response reader still needs to display the
guardrail `error_message`; that UI propagation is delivered in the immediately
following isolated lane.
