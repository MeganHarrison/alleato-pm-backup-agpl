# Schedule Revisions and Controlled Publishing

## Ownership

`schedule_tasks` and `schedule_dependencies` remain the editable working schedule. Publication never repoints or mutates those rows. A revision captures immutable copies of tasks and dependencies plus a baseline/revision relationship and append-only transition event.

## State Machine

`draft → review → published → superseded`.

Only a project manager or app admin can request review or publish. Publishing is a single transaction: validate review state, mark an existing published revision superseded, mark the target published, record the actor/event, and update the project’s current-revision pointer. No client-side state change is authoritative.

## Read Contract

Authoring APIs may expose draft and review revisions to authorized project members. Stakeholder/current APIs select the project’s published current revision only; they do not fall back to the latest draft, review, or superseded record.

## Comparison Contract

The server computes revision-vs-baseline differences using immutable snapshot task IDs and captured schedule fields. The UI displays the server result on the canonical schedule page; it must never derive historical values from mutable live tasks.

## Named Baseline Contract

`schedule_baselines` is lightweight project metadata that points to one `schedule_revisions` row. Task, dependency, deadline, calendar, submittal, and future assignment facts remain owned by the revision snapshot family. Baseline capture calls the one snapshot transaction and records the metadata before commit. A partial unique index allows exactly one active baseline per project.

Baseline capture and activation require a project manager or app admin. Project members may read baselines and comparisons through project-scoped RLS. Direct table writes are revoked; guarded RPCs own capture and activation, and snapshot/audit tables reject direct update or delete operations while preserving parent cascade cleanup.

The comparison endpoint accepts a baseline identifier and an optional target revision identifier. Without a target revision it compares against the mutable live authoring schedule; with one it compares two immutable revisions. It returns baseline/current dates plus signed project-working-day start and finish variance and duration variance. Positive variance is later/longer; negative variance is earlier/shorter.

## Phase Boundaries

Phase 3 date baselines intentionally exclude work and cost. Those values depend on the Phase 4 many-to-many resource assignment, units, capacity, and rate contracts. Resource work must be snapshotted into this same revision family before work/cost variance is added.

## Verification

Focused tests prove snapshot immutability, transition authorization, supersession, current-revision read filtering, and audit history. Closeout requires a migration ledger/readback plus canonical desktop and mobile screenshots attached to [AAI-1191](https://linear.app/megankharrison/issue/AAI-1191/add-baselines-revisions-and-controlled-schedule-publishing).
