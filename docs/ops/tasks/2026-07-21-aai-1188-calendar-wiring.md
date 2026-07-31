# Task: Wire Project Calendars into Schedule CPM and Editor

Status: In Progress
Owner: Codex SROOT1188W
Task ID: AAI-1188
Linear: [AAI-1188](https://linear.app/megankharrison/issue/AAI-1188/calculate-cpm-float-and-calendar-aware-schedule-impacts)

## Objective

Make the persisted project construction calendar selected in the canonical schedule editor and CPM calculation instead of relying on default weekday behavior.

## Acceptance Checklist

- [x] Authenticated calendar API returns explicit defaults or persisted weekday/exception settings.
- [x] Schedule page supplies that calendar to the task editor.
- [x] Editor exposes the calendar basis of a pre-save impact.
- [ ] CPM analyzer accepts the same calendar for date-derived durations/float.
- [ ] Focused tests start red then pass; browser proof follows deployment.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Calendar foundation | Pass | `7fdb13318` on main; live tables/RLS verified. |
| Calendar API/editor tests | Pass | Default API response and holiday-aware canonical task-editor impact, 2 focused suites. |
