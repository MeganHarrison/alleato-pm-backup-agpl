# Task: Persist Construction Working Calendars for Schedule Impacts

Status: Complete — independent review accepted 2026-07-21
Owner: Codex SROOT1188
Created: 2026-07-21
Task ID: AAI-1188
Linear Issue: [AAI-1188](https://linear.app/megankharrison/issue/AAI-1188/calculate-cpm-float-and-calendar-aware-schedule-impacts)
Verification contract: Not applicable

Independent review accepted this parent task after the persisted-calendar Gantt/CPM correction, direct-write hardening, and canonical browser proof.

## Objective

Use a project-owned construction calendar—not a hard-coded weekend rule—when calculating CPM float and pre-save successor impacts.

## Scope

- Add a durable project schedule-calendar data contract and a read API.
- Make the shared CPM/impact calculation consume configured working weekdays and project non-working dates.
- Retain the existing dependency/constraint behavior and expose the calendar basis in the canonical editor.
- Do not begin AAI-1189 field-update work; it is blocked by this ticket.

## Source of Truth

- Canonical route: `/<projectId>/schedule` and its task editor.
- Calculation owners: `schedule-impact-preview.ts` and `schedule-network-analysis.ts`.
- Database owner: project-scoped schedule calendar settings and exceptions.
- Documentation: [Schedule overview](https://linear.app/megankharrison/project/schedule-442d20f1fad1/overview), [delivery plan](https://linear.app/megankharrison/document/schedule-implementation-audit-and-delivery-plan-502ecf448fd1), [autonomous TDD protocol](https://linear.app/megankharrison/document/schedule-autonomous-tdd-execution-protocol-c3ddcfc1e1b5).

## Acceptance Criteria

- [x] Configured working days and non-working dates change successor dates, Gantt criticality, float, and calendar-aware warning state.
- [x] Default construction calendar is explicit and backward-compatible for projects without settings.
- [x] The task editor identifies the calendar used for pre-save impact calculation.
- [x] Tests begin red and cover persisted-calendar Gantt/CPM, warning-state, custom weekday, holiday, lag/lead, and constraint behavior.
- [x] Migration is applied, read back, and canonical desktop/mobile browser evidence is attached to Linear.

## TDD Checklist

- [x] Write focused calendar arithmetic tests and capture red output.
- [x] Implement the pure shared calendar contract.
- [x] Make API/Gantt/CPM callers consume the persisted calendar and refresh after a save.
- [x] Add DB settings/exceptions and authorized read/write API.
- [x] Make Gantt non-working-day cues calendar-aware; add UI/calendar-basis test and browser evidence.

## Verification

- [x] Focused unit/component tests cover persisted calendar through the Gantt/CPM API and calendar-aware warnings.
- [x] Targeted lint has no errors.
- [x] Migration is applied and read back.
- [x] Authenticated canonical route is captured on desktop and mobile.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Current-state audit | Pass | Existing implementation uses a weekend-only pure helper; no persisted schedule-calendar schema exists. |
| Red calendar test | Pass | Missing `schedule-calendar` module failed before behavior code was added. |
| Calendar/impact tests | Pass | 2 suites, 10 tests including custom week and holiday successor movement. |
| Migration apply/read-back | Pass | Calendar + exception tables, RLS, and project-member/app-admin policies are live. |
| Full calendar regression | Pass | 8 suites / 39 focused tests cover persisted exceptions, working-day warnings, Gantt service analysis, calendar rendering, and post-save refresh. |
| Canonical browser proof | Pass | Production `35ef4a2` authenticated calendar GET, calendar PUT, and Gantt GET all return 200; screenshot attachment `2419a1b1-7dd5-452d-a93b-bbc1de9bd0b1` is viewable on AAI-1188. |
| Independent review | Pass | Fresh review of `6b8888897` found no blocking source issue; persisted Gantt/CPM propagation, warning behavior, visual calendar cues, receiver preservation, and write-boundary hardening were accepted. |

## Failure-Loudly Contract

- Missing/invalid settings fall back only to the documented default calendar; malformed calendar payloads return a corrective error.
- Calendar exceptions and computed basis are visible to the editor so impact shifts are explainable.
- The API rejects project-mismatched calendar writes or reads.
- The prior detached Supabase RPC receiver produced a visible 500; regression coverage now fails if the SDK method loses its client receiver.
- Prevention: route/service/component regressions retain the Supabase receiver, persisted calendar propagation, warning offsets, and Gantt visual calendar basis; direct table writes are unavailable to authenticated API users.
