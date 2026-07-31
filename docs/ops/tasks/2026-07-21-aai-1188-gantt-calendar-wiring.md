# Task: Wire Persisted Calendars Through Gantt CPM and Warnings

Status: In Progress
Owner: Codex SROOT1188E
Task ID: AAI-1188
Linear: [AAI-1188](https://linear.app/megankharrison/issue/AAI-1188/calculate-cpm-float-and-calendar-aware-schedule-impacts)
Verification contract: Not applicable

This is a corrective implementation increment. Parent acceptance remains pending rerun of independent review and canonical browser proof.

## Checklist

- [x] Red tests prove a holiday successor warning and persisted calendar Gantt analysis are missing.
- [x] Gantt data service loads project calendar/exceptions and passes them to CPM analysis.
- [x] Dependency warnings use working-day offsets for all relationship types.
- [x] Gantt calendar cues and post-save refresh use the project calendar.
- [ ] Focused regression, canonical browser proof, and independent rerun are complete.

## Evidence

- Red: the new service/network tests failed before this implementation.
- Green: 8 focused suites / 39 tests pass, including a Gantt rendering test that proves a saved dated exception is shaded while a configured Saturday remains working; targeted lint has no errors (existing unrelated warnings remain in the touched page/chart).
- Root cause: calendar persistence was only used by the editor preview; it was not carried across the Gantt API/service boundary.
- Guardrail: service regression coverage now asserts a persisted exception changes returned Gantt warning state; network coverage asserts a holiday successor is warned; Gantt coverage asserts visual non-working cues use the same project calendar.
