# Task: Add Schedule Baselines, Revisions, and Controlled Publishing

Status: Complete
Owner: Codex S216
Created: 2026-07-22
Task ID: AAI-1191
Linear Issue: [AAI-1191](https://linear.app/megankharrison/issue/AAI-1191/add-baselines-revisions-and-controlled-schedule-publishing)
Architecture documentation: [`SCHEDULE-REVISIONS.md`](../../architecture/SCHEDULE-REVISIONS.md)
Related handoff: [`2026-07-22-S216-schedule-baseline-variance.md`](../handoffs/2026-07-22-S216-schedule-baseline-variance.md)

## Objective

An authorized project member can snapshot the live schedule as an immutable baseline, review a draft revision against it, and publish exactly one auditable current revision for stakeholders.

## Phase 3.0-3.1 Delivery Slice

- Stabilize the existing revision boundary before adding more schedule consumers.
- Capture named baselines as metadata that references an existing immutable revision snapshot; do not duplicate task snapshots or introduce a parallel baseline owner.
- Compare the active baseline with live authoring or an explicit revision using project-calendar working days.
- Surface active-baseline dates and start/finish/duration variance on the canonical schedule, including a quiet Tracking Gantt overlay.
- Defer work/cost variance until the Phase 4 resource and assignment model exists.

## Attention Brief

Primary user: Project manager.

Primary job: Freeze an approved plan and explain slippage.

Primary decision: Which activities moved from the active baseline, and by how much?

Tier 1: Active baseline, visible date variance, and Tracking Gantt overlay.

Tier 2: Capture or activate a named baseline.

Tier 3: Immutable capture metadata, revision history, and audit evidence.

Hide until requested: Baseline management, revision history, and raw snapshot metadata.

Remove: Dashboard cards, duplicate summaries, and a parallel baseline page.

Primary action: Capture or select the active baseline.

Failure-loudly behavior: Baseline loading, capture, activation, and comparison report precise errors; the UI never displays stale or default comparison data after a failed request.

## Source of Truth

- Live authoring source: `schedule_tasks` and `schedule_dependencies`.
- Immutable publication source: new project-scoped revision, task-snapshot, dependency-snapshot, and event tables.
- Canonical route owner: `/<projectId>/schedule`; revision controls extend the existing schedule page rather than creating a parallel schedule surface.
- Stakeholder read: revision API returns only the authorized published current revision.

## Acceptance Criteria

- [x] A baseline snapshot and revision comparison are available for a project schedule.
- [x] Named baselines reference immutable revision snapshots and exactly one can be active per project.
- [x] Start, finish, and duration variance use the canonical project calendar and are returned by a guarded comparison API.
- [x] The canonical Gantt can show a quiet active-baseline overlay without obscuring current dates or progress.
- [x] Draft, review, published, and superseded states have role-gated transitions.
- [x] Published viewers receive only the authorized current revision.
- [x] Publishing and durable change history are proven end to end.
- [x] Immutable snapshot rows cannot be changed by later live-schedule writes.
- [x] Browser screenshots and database readback are attached to AAI-1191 before closure.

## TDD Contract

- [x] Red: later live writes cannot mutate a captured baseline snapshot.
- [x] Red: unauthorized and invalid status transitions, including direct draft-to-published bypasses, are rejected.
- [x] Red: unpublished or superseded revisions cannot be returned by the stakeholder current-revision read.
- [x] Green: snapshot, diff, review, publish, supersession, current read, and audit history pass focused tests.

## Implementation Checklist

- [x] Canonical authoring route, live schedule tables, and task ownership are identified.
- [x] Generate and inspect current Supabase types before database code.
- [x] Apply a migration with immutable snapshot tables, transition RPCs, read policies, and audit rows.
- [x] Add transaction-safe API routes and focused authorization/transition tests.
- [x] Reuse the canonical schedule page for revision controls and comparison.
- [x] Apply migration and record remote ledger/readback evidence.
- [ ] Capture authenticated desktop/mobile canonical-route proof and attach it to AAI-1191.
- [x] Obtain independent review and formal acceptance.

## Failure-Loudly Contract

- Invalid transition: specific state/role error; no partial publish or current-revision pointer.
- Snapshot mismatch: explicit revision/row error; live schedule remains unchanged.
- Viewer read: no draft/superseded fallback; returns a specific no-published-revision state.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Kickoff | AAI-1191 set In Progress | Pass | Linear ownership and TDD protocol active. |
| Design | `docs/architecture/SCHEDULE-REVISIONS.md` | Pass | Canonical ownership and state-machine contract documented before code. |
| Phase 3 resume | S216 write lease and updated implementation contract | Pass | Existing AAI-1191 is continued in the registered clean checkout; no duplicate task or baseline subsystem. |
| Database migrations | `20260722045025`, `20260722051959`, `20260722052640` | Pass | Local and remote ledger versions match exactly. |
| Live schema readback | `docs/ops/evidence/2026-07-22-schedule-baseline-variance/readback.sql` | Pass | RLS, grants, immutable triggers, current-pointer integrity, one-active-baseline invariant, composite foreign keys, source locking, publish-alert preservation, and provenance all pass. |
| Mutation probes | `immutability-probe.sql`, `pointer-guard-probe.sql` | Pass | Snapshot/event mutation and authenticated direct current-pointer mutation were blocked; pointer probe rolled back. |
| Generated types | `npm run db:types:check` | Pass | Generated TypeScript database types match the linked schema. |
| Focused verification | 15 Jest suites / 36 tests | Pass | Domain, API, component, accessibility, comparison, transition, current-read, and lookahead coverage pass. |
| Static checks | `npm run lint:changed:debt`; touched-file TypeScript filter; `git diff --check` | Pass | No new lint debt, no touched-file type errors, and no whitespace errors. |
| Structured route errors | `npm run quality:changed`; `schedule-route-errors.test.ts` | Pass | All six scheduling routes use shared envelopes; client input maps to 400 while unexpected snapshot-integrity failures remain alertable 500 errors. |
| Database lint | `npx supabase db lint --linked --level warning` | Pass with repository debt | No Phase 3 scheduling function issue; existing unrelated schema-function findings remain outside this task. |
| Independent review | Code, database, and React re-reviews | Approved | Zero remaining actionable findings across all severities. |
| Canonical production lifecycle | Authenticated `https://projects.alleatogroup.com/43/schedule` | Pass | UI snapshot → review → publish created published revision 1 (`369ad62f-1d0d-4600-9826-68877ccd2197`) with captured snapshot/resource provenance; no live schedule tasks were edited. |
| Published-consumer readback | Authenticated route fetch | Pass | Risk summary returned ready/no-risk, lookahead returned a captured 2-week window, and trade activities returned the recipient-scoped empty set from the same published revision. |
| Desktop + mobile proof | Linear comment `b026859f-2d13-493b-8417-b1f580878562`; attached screenshots | Pass | Viewable canonical screenshots show Published revision 1, lookahead, source-linked risk state, and responsive Schedule controls. |
| Current canonical route proof | [desktop](../evidence/2026-07-22-schedule-current-production/schedule-desktop-current.png) · [mobile](../evidence/2026-07-22-schedule-current-production/schedule-mobile-current.png) | Pass | Fresh authenticated captures of `/43/schedule` show Published revision 1, the published lookahead state, risk state, and responsive Schedule controls. They do not claim the newer assignment-picker deployment, which remains under Vercel build verification. |

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Independent review is accepted.
