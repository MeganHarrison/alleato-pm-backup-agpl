# Task: Preserve Hidden Successor Relationships

Status: Complete - audit only
Owner: Codex
Created: 2026-07-28
Task ID: SCHED-HIDDEN-SUCCESSOR

## Objective

Verify whether editing a filtered Schedule grid Successors cell can delete a
relationship to a successor that is not represented by a visible row number.

Delivery lane: Standard

## Acceptance

- [x] Trace the filtered hierarchy into the grid dependency map.
- [x] Verify hidden successor relationships cannot enter the editable diff.
- [x] Preserve visible create, update, and removal behavior unchanged.
- [x] Reject unnecessary product code after independent review.

## Evidence

| Check | Result |
| --- | --- |
| Data-flow trace | `successorDependenciesByTaskId` scans only filtered `flatTasks`; each dependency is owned by a visible successor task |
| Focused shorthand tests | 28/28 passed before the no-op guard was removed |
| Focused lint | 0 errors; 8 pre-existing design-system warnings |
| Code review | APPROVE |
| React review | Found the proposed filter was an identity operation; product/test changes removed |

## Resolution

No product defect exists in the current data path. A filtered-out successor is
also absent as a dependency owner from `successorDependenciesByTaskId`, so its
persisted relationship cannot be included in or removed by the cell diff.
Publishing a defensive identity filter and a synthetic unit test would have
created false confidence, so both were discarded.
