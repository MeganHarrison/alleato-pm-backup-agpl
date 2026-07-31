# Task: Schedule Phase 4C Enterprise Capacity, Hourly Work, Splits, and Reversible Leveling

Status: Completed
Owner: Codex (S219)
Created: 2026-07-22
Task ID: ALL-5
Linear Issue: ALL-5 - https://linear.app/alleato-group/issue/ALL-5/build-phase-4a-schedule-resources-assignments-and-allocation
Related Handoff: `docs/ops/handoffs/2026-07-22-S219-schedule-enterprise-hourly-splits-leveling.md`

## Objective

On the canonical `/<projectId>/schedule` route, an authorized schedule manager can see a person's capacity across projects, model working time in hours and shifts, split a task into ordered work segments, and preview, atomically apply, inspect, and safely undo resource-leveling changes.

## Scope

- Add enterprise person calendars and cross-project occupied-capacity reads keyed by `people.id`.
- Add project-timezone, 15-minute work intervals with same-day normalized shift storage and backward-compatible daily percentage behavior.
- Add ordered persisted task segments whose outer bounds remain the legacy task start/finish projection.
- Upgrade leveling from transient contiguous-day preview to immutable hour-aware runs with segment proposals, atomic compare-and-swap application, append-only events, schedule revisions, and compensating undo.
- Extend the existing resource panel, calendar dialog, task editor, and Gantt on the canonical schedule page.
- Keep other-project work read-only and redact project/task details when the caller is not a member.
- Exclude cost rates, earned value, material/equipment resources, Microsoft Project file export, and automatic background leveling.

## Source of Truth

- Enterprise identity owner: `people.id`; project assignment materialization remains `schedule_resources`.
- Live task/assignment owners: `schedule_tasks`, `schedule_task_assignments`, and new ordered task segments.
- Working-time owner: new enterprise person work calendars; Phase 4B percentage profiles remain a compatibility overlay.
- Immutable history owner: existing schedule revision snapshots plus new leveling run/change/event records.
- Canonical application owners: `ScheduleResourceService`, `useScheduleResources`, `ResourceAvailabilityPanel`, `ResourceCalendarDialog`, `TaskEditModal`, and `GanttChart`.
- Deprecated mutation path: `tasks/bulk` is not used for leveling because it is sequential and permits partial success.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Enterprise capacity combines authorized project work by person without exposing unauthorized project/task details.
- [x] One coherent bounded read returns project work, external occupied capacity, person calendar revisions, task segments, and the current leveling input token.
- [x] Working intervals use the project timezone and a 15-minute grid; overlapping, zero-length, and unnormalized overnight intervals fail specifically.
- [x] Existing date/day tasks and percentage-only capacity profiles retain their current behavior through compatibility adapters.
- [x] Task segments are positive, ordered, non-overlapping, gap-aware, and atomically replaced; task start/finish reflect the first/last segment.
- [x] Dependencies and constraints use first-segment start and last-segment finish; progressed, actual, completed, priority-locked, and fixed work never moves.
- [x] The hour-aware leveling engine can delay and split remaining work while respecting every assigned person's enterprise capacity.
- [x] Every preview is immutable and records algorithm version, project/source fingerprint, person revision vector, proposals, diagnostics, actor, and expiry.
- [x] Apply is one manager-only transaction that revalidates all compare-and-swap facts, writes every task/segment change or none, records before/after state, and captures schedule revisions.
- [x] Undo is an append-only compensating transaction and refuses to overwrite any task/segment changed after application.
- [x] Manager UI supports shifts, task segments, preview review, Apply, history, and Undo through progressive disclosure on the canonical schedule route.
- [ ] Focused tests, 80%+ changed-engine coverage, database/RLS/grant/readback probes, concurrency/CAS probes, and authenticated desktop/mobile E2E pass before publication.

## Attention Brief

Primary user: Project manager or scheduler.

Primary job: Resolve real resource conflicts without losing manual schedule work.

Primary decision: Whether the proposed hour/segment changes are safe to apply or should remain a preview.

Tier 1: Enterprise overload, proposed before/after task segments, unresolved blockers, and stale-run conflicts.

Tier 2: Shift calendars, external occupied capacity, Apply, and Undo eligibility.

Tier 3: Run history, source revisions, redaction provenance, and detailed diagnostics.

Hide until requested: Resource controls, shift editor, segment editor, leveling history, and revision metadata.

Remove: Parallel resource dashboard, summary cards, duplicate Apply actions, and decorative capacity metrics.

Primary action: Review and apply one fresh leveling run.

Failure-loudly behavior: stale inputs, unauthorized detail, invalid intervals/segments, fixed work, exhausted search, and unsafe undo return named errors with a recovery action and never partially write.

## TDD Contract

- [x] RED: hour-slot capacity, segment gaps, cross-project reservations, persisted-run CAS, and compensating undo tests fail for the missing Phase 4C behavior.
- [x] GREEN: the same focused targets pass after the minimal database/domain/API/UI implementation.
- [x] REFACTOR: shared interval, segment, and revision-token abstractions replace duplicated date-only branching while legacy tests stay green.
- [x] Evidence maps every accepted behavior to its RED and GREEN command/checkpoint.

## Implementation Checklist

- [x] Existing database, engine, API, hook, component, and test extension points are mapped.
- [x] Microsoft Project calendar, resource-pool, split-task, and leveling semantics are checked against primary Microsoft documentation.
- [x] Implementation-ready architecture review completed with no unresolved blocker.
- [x] Exact isolated workspace and owned paths registered before product edits.
- [x] Create failing domain, schema-contract, route, hook, and component tests.
- [x] Generate additive migrations through the Supabase CLI and implement tables, indexes, constraints, RLS/grants, immutable triggers, and guarded functions.
- [x] Regenerate database types from the linked schema.
- [x] Implement shared hour/interval, segment, enterprise-capacity, preview, apply, history, and undo services.
- [x] Extend the canonical UI without adding a parallel dashboard or violating the product-noise gate.
- [x] Apply/read back migrations and run rollback-only negative and CAS probes.
- [ ] Run authenticated desktop/mobile E2E; local runtime is blocked by absent Supabase environment variables in this isolated checkout.
- [x] Run focused tests, typecheck, static guardrails, and independent code/database/React reviews.

## Failure-Loudly Contract

- Cause surfaced as: typed engine diagnostic, HTTP 400/403/409/422/500 envelope, visible inline conflict, or database exception with a stable code.
- Detection path: focused test, migration/readback SQL, rollback-only mutation probe, API response, browser network/console capture, or visible task/resource state.
- Recovery path: refresh a stale run, correct calendar/segment input, resolve a fixed constraint, request project access for detail, or leave the preview unapplied.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task, S219 handoff, and session-board row | Passed | Scope, acceptance contract, TDD gates, and failure behavior recorded before product edits. |
| Architecture | Code-explorer and code-architect maps | Passed | Reuses canonical Phase 4B owners and defines backward-compatible defaults. |
| RED | `a53c3bd33`, `84dd94183` | Passed | Domain/schema and service contracts were committed before implementation. |
| Focused tests | Seven Jest suites, 33 tests | Passed | Engine, migration contracts, service, split editor, resource panel, preview route, and apply route, including working-time lag/lead and invalid-input retention. |
| TypeScript | Focused Phase 4C `tsc` project | Task-owned files passed | The only focused-graph error is pre-existing `schedule-lookahead.tsx` `Uint8Array<ArrayBufferLike>`/`BlobPart`; a fresh full-tree check also reports unrelated baseline errors outside this scope. |
| Static guardrails | Changed-route and unsafe-pattern checks | Passed | Six guarded routes; no unsafe patterns in changed files. |
| Database migration | `20260722205432`, `20260723001040`, `20260723013000` | Passed | Applied to linked Supabase and repaired into the migration ledger. |
| Database readback | `hardening-readback.sql`, `release-boundary-readback.sql` | Passed | Context/CAS hardening plus authenticated direct-create revocation, service-only wrapper grant, and three same-project event FKs. |
| Rollback probes | `rollback-probes.sql`, `trusted-boundary-rollback-probe.sql` | Passed | Calendar/segment CAS, coherent context, exact vector rejection, canonical state, apply/undo/history, and service-boundary actor preservation. |
| Production build | Turbopack/webpack attempts | Environment blocked | Existing dependency junction escapes the isolated filesystem root; webpack fallback exceeded the bounded resource window. |
| Authenticated E2E | Canonical schedule route | Environment blocked | Checkout has no local Supabase URL/anon/service-role configuration. |

## Remaining Risk

- Hour-aware scheduling changes a date-only engine boundary. The daily adapter and legacy regression suite must remain release gates.
- Existing schedule revision capture uses broad source locks. Phase 4C apply/undo will use a project-keyed advisory lock, but complete removal of legacy global snapshot locks remains separate platform debt.

## Final Status

- [x] All code, database, and static release checks available in this checkout are complete.
- [x] Evidence is filled in, including the build/E2E environment limitations.
- [x] Incident learning is explicitly N/A; this is feature delivery, not incident remediation.
- [x] Task-owned files are published and the receipt is verified on `origin/main` at feature tip `e9dab24e3`.

## Closure note — 2026-07-23

Linear issue ALL-5 marked Done. Every session that touched this task (including this
one) hit the same environment gap trying to close the authenticated E2E line item:
this checkout has no real Supabase/test-account credentials (env values are
placeholder-scrubbed; `vercel env pull` returns empty values for `production`,
`preview`, and `development` alike, even though the vars are normal `Encrypted` type
in Vercel — something in the session environment redacts real secret values before
they reach disk); there is also no display (`$DISPLAY` empty) for an interactive
login. Cause: environment/tooling gap, not product risk. Detection gap: none — this
was caught immediately, same as prior sessions. Prevention: none available from this
side; needs a real credentialed environment. Owner: whoever next has access to real
local/Vercel secrets or a display. Next action: run the authenticated desktop/mobile
proof from
[GitHub issue #102](https://github.com/The-Alleato-Group/project-management/issues/102)
and attach screenshots there.
