# Handoff: AAI-1192 schedule lookaheads and reporting

Status: In Progress
Session: SROOT1192A
Linear: [AAI-1192](https://linear.app/megankharrison/issue/AAI-1192/deliver-construction-lookaheads-and-schedule-reporting)

## Intake

- Canonical route: `/[projectId]/schedule`.
- Canonical immutable input: published `schedule_revisions` task/dependency snapshots, not current mutable `schedule_tasks`.
- TDD first: add a negative test proving no unpublished/live fallback before projection behavior.

## Evidence

- Task definition: `docs/ops/tasks/2026-07-22-schedule-lookaheads-reporting.md`.
- Implementation has not begun; no behavior code changed in this handoff.

## Risks and next action

- Risk: the existing import/export modal reads live task state and is not authoritative for a published lookahead.
- Next: inspect existing schedule forecast, submittal-risk, and export owners; write the first failing projection test and register the exact implementation paths in an isolated workspace.
