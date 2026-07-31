# Task: MS-Project-Style Grid Entry — Predecessor/Successor Shorthand Columns

Status: Completed (Slice 2 of 2)
Owner: Claude Code
Created: 2026-07-23
Task ID: ALL-6 (same Linear issue as Slice 1)
Linear Issue: ALL-6 - https://linear.app/alleato-group/issue/ALL-6/auto-scheduling-cascade-successor-dates-from-dependency-changes-slice
Related: `docs/ops/tasks/2026-07-23-schedule-auto-scheduling-engine.md` (Slice 1 — the
engine this UI depends on to make typed links actually move dates)

## Objective

On the Schedule **Table** view, a scheduler can type a Microsoft-Project-style
shorthand directly into a Predecessor or Successor cell (e.g. `3`, `3FS+2`,
`1,4SS-1`) to link tasks by row number, instead of opening the Edit Task modal's
dropdown-based predecessor editor.

## Scope

- 1-based row-number ("#") column in `ScheduleGridView`, matching Microsoft Project's
  ID column — display-only, derived from the current sort, referenced by shorthand
  entries.
- Inline-editable Predecessors and Successors columns using the existing
  `InlineEditField` pattern already used for name/dates/status.
- Shorthand parser/formatter/diff (`schedule-dependency-shorthand.ts`) reusing the
  existing dependency CRUD (`createDependency`/`updateDependency`/`deleteDependency`,
  already cascade-aware per Slice 1) — no new backend endpoint.
- Successors column writes to the OTHER task's dependency row (dependencies are
  always stored on the successor side), not the edited row's own.

## Explicitly deferred (separate follow-up, not started)

**Enter-anywhere row insertion.** Investigated wiring "press Enter on any row's name
to create the next task" via a new `onSaved` hook on the shared `InlineEditField`
component, but the natural target (the last existing row's Name field) doesn't fit:
`InlineEditField`'s commit short-circuits when the saved value is unchanged, so
pressing Enter on an *existing, unedited* name would never fire a save at all — there
is no clean way to reuse "edit this task's name" semantics to mean "create a new
task." The existing bottom `InlineQuickAddRow` already supports the core rapid-entry
flow (type name, Enter, name field clears, type next name, Enter again) without
requiring a click between entries — reasonably close to the MS Project flow already.
True mid-list row insertion (Enter on row 3 pushes rows 4+ down) would need
`sort_order` renumbering machinery that doesn't exist yet; deferred as its own
follow-up rather than half-built here.

## Source of Truth

- Row number ↔ task id: `rowNumberByTaskId`/`taskIdByRowNumber`, computed in
  `ScheduleGridView` from `sortedFlatTasks` — display-only, never persisted.
- Successor reverse-lookup: `successorDependenciesByTaskId`, computed client-side from
  every task's own `.dependencies` (no new fetch — the data already exists per-task).
- Parse/format/diff/apply: `frontend/src/lib/scheduling/schedule-dependency-shorthand.ts`
  (new, pure functions, no component state).
- Mutation owner: unchanged — the same `handleCreateDependency`/`handleUpdateDependency`/
  `handleRemoveDependency` in `page.tsx`, now also passed to `ScheduleGridView` via
  `BaseViewProps`.

Delivery lane: Standard (additive UI on top of an already-verified engine; no schema
change, no new write path — reuses existing dependency CRUD)

## Acceptance Criteria

- [x] Typing `"3"` in a Predecessor cell creates a finish-to-start, zero-lag
      dependency on row 3.
- [x] Typing `"3FS+2"`/`"3SS-1"`/etc. sets the relationship type and lag.
- [x] Multiple comma-separated entries (`"1,4SS-1"`) are all applied.
- [x] Editing an existing cell only touches what changed — an unmodified predecessor
      in a multi-predecessor cell isn't recreated or removed.
- [x] Clearing a cell removes all of that task's predecessors (or successors).
- [x] A malformed entry throws a named error and applies nothing (no partial writes).
- [x] The Successors column's writes land on the OTHER task's dependency row, with
      this row as its predecessor — not on this row's own dependencies.
- [x] Existing columns/behavior in `ScheduleGridView` (sorting, inline name/date/
      status editing, drag-to-reparent, quick-add row) are unchanged.

## TDD Contract

- [x] RED: `schedule-dependency-shorthand.test.ts` written against the
      not-yet-implemented parser/formatter/diff/apply functions.
- [x] GREEN: 27/27 pass after implementation.
- [x] REFACTOR: apply logic was first written inline inside `ScheduleGridView`, then
      extracted into pure, directly-testable `applyPredecessorShorthandEdit`/
      `applySuccessorShorthandEdit` functions in the shorthand module — the component
      now only supplies state (current dependencies, row-number resolver, the
      existing mutation callbacks).
- [x] Evidence below maps every accepted behavior to its test.

## Evidence

| Check | Command | Result | Notes |
| --- | --- | --- | --- |
| Shorthand module tests | `npx jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-dependency-shorthand.test.ts` | 27/27 passed | Parse (bare/typed/lagged/multi/malformed/unresolvable), format, diff, and both apply functions (create/update/remove, throw-without-mutating on malformed input). |
| Full scheduling suite | `npx jest --runInBand src/lib/scheduling src/lib/services/__tests__/scheduling src/components/scheduling` | 237/241 passed | 4 failures, all pre-existing and unrelated (confirmed against Slice 1's baseline): `scheduling-service.hierarchy.test.ts` (mock-count assertion), `gantt-chart-critical-path.test.tsx`/`resource-calendar-dialog.test.tsx`/`task-edit-modal.submittal-risk.test.tsx` (a11y query mismatches). `task-dependencies-editor.test.tsx` (the existing modal editor, untouched) still passes. |
| Focused typecheck/lint | Delegated to sub-agent | Pending | See PR for result before merge. |
| Authenticated browser proof | Not run this session | Deferred | Needs a real credentialed session/display — same gap as `ALL-5`'s follow-up, [GitHub #102](https://github.com/The-Alleato-Group/project-management/issues/102). |

## Remaining Risk

- No authenticated browser verification yet — this is new user-facing UI, so per
  `.claude/rules/VISUAL-PROOF-GATE.md` this should not be called fully done until a
  screenshot of the working Predecessor/Successor columns exists. Owner: whoever next
  has real credentials or a display (same environment gap as #102). Next action: run
  through the exact flow described in this doc's Objective on a live project and
  screenshot it.
- Enter-anywhere row insertion (see "Explicitly deferred" above) remains a real gap
  against the full Microsoft Project mental model; the existing quick-add row covers
  the common case adequately in the interim.

## Final Status

- [x] All acceptance criteria for this slice are complete.
- [x] Evidence is filled in, including the deferred browser-proof gap.
- [x] Incident learning is N/A — feature delivery, not incident remediation.
- [x] Deferred work (row insertion, browser proof) has cause, owner, and next action.
