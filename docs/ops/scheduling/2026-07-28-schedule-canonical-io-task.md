# Task: Consolidate Schedule Import and Export

Status: Complete - code and focused acceptance
Owner: Codex
Created: 2026-07-28
Task ID: SCHED-CANONICAL-IO

## Objective

Eliminate the partial legacy CSV importer and make the atomic Schedule Import
workflow the only schedule ingestion path. Keep flat CSV/JSON downloads only as
explicitly lossy analysis snapshots.

Delivery lane: Standard

## Acceptance

- [x] The schedule page no longer creates imported tasks with `Promise.all`.
- [x] All visible import actions route to `/{projectId}/schedule/import`.
- [x] Previously inert context-menu import/export actions now open the canonical import route and export snapshot.
- [x] The export modal contains no file upload, mapping, or import mutation path.
- [x] CSV/JSON downloads are labeled as flat, intentionally lossy snapshots.
- [x] Omitted relationship, hierarchy, resource, calendar, segment, baseline, risk, and alert data is disclosed.
- [x] CSV values correctly escape commas, quotes, and newlines.
- [x] Spreadsheet formula-leading CSV values are neutralized.
- [x] Export format selection and success/error feedback are accessible.
- [x] Focused tests and lint pass.
- [x] Independent React and code review pass.
- [ ] Task-owned files are published to `origin/main`.

## Evidence

| Check | Result |
| --- | --- |
| Export and atomic-import tests | 10/10 passed |
| Focused lint | 0 errors; 2 pre-existing schedule page warnings |
| Export interactions | Download success, URL cleanup, and failure alert covered |
| Accessibility | Labeled pressed-state format group; live status and alert roles |
| Code review | APPROVE after formula-injection and failure-feedback repairs |
| React review | APPROVE; context-menu browser coverage deferred to release E2E matrix |

The final authenticated scheduling release matrix must exercise the context-menu
Import Schedule and Export Schedule actions because these page-level callbacks
are not practical to isolate from the full authenticated page in unit tests.
