# Task: Schedule Resource Cost and Earned Value

Status: In Progress
Owner: Codex (S019FACC)
Created: 2026-07-29
Task ID: SCHED-COST-EV
Linear Issue: Not created; the current scheduling continuation is tracked by
the user-owned Codex goal rather than a Linear issue.
Related Handoff: N/A while this single isolated session remains active.

## UX Exposure Continuation

Delivery lane: Standard

The cost, earned-value, resource-leveling, and enterprise-capacity controls are
live but were hidden behind a collapsed `Project resource load` disclosure.
The owning schedule planning workspace now requests that disclosure open by
default. Other callers retain opt-in disclosure through the new `defaultOpen`
prop so the shared component remains reusable.

Acceptance:

- [x] A focused component regression fails when planning tools start collapsed.
- [x] The canonical schedule page requests the expanded planning state.
- [x] Existing on-demand disclosure behavior remains the component default.
- [x] Focused component tests pass: 8/8.
- [x] Focused ESLint reports zero errors; two unrelated existing warnings remain
  in the schedule page.
- [ ] Navigation copy explicitly names resources and costs.
- [ ] The no-revision state tells the user how to activate reporting.
- [ ] Authenticated desktop and mobile production screenshots prove the final
  published experience.

## Objective

An authorized schedule manager can persist explicit person, equipment, and
material cost facts and inspect deterministic BAC, PV, EV, AC, CV, SV, CPI, and
SPI without the system inventing actual cost or presenting partial financial
facts as complete.

## Scope

- Add one pure cost/EVM engine before introducing persistence or UI.
- Add guarded resource-rate and assignment-unit persistence, immutable revision
  snapshots, service/API ownership, and canonical resource-panel presentation.
- Explicitly exclude inferred actual cost and any UI that cannot offer an
  authorized recovery action.
- Cost persistence remains deferred while CRM-002 owns
  `supabase/migrations`, `supabase/tests`, and
  `frontend/src/types/database.types.ts`.

## Source of Truth

- Canonical runtime/data owner: `schedule_resources`,
  `schedule_task_assignments`, `schedule_tasks`, and schedule revision
  snapshots after the additive migration.
- Existing shared primitives/services:
  `frontend/src/lib/scheduling/schedule-calendar.ts`,
  `frontend/src/lib/services/schedule-resource-service.ts`,
  `frontend/src/components/scheduling/resource-availability-panel.tsx`, and
  `frontend/src/types/scheduling.ts`.
- New domain owner: `frontend/src/lib/scheduling/schedule-resource-cost.ts`.
- Deprecated or parallel paths: no cost/EVM implementation exists; legacy
  person-only assignment fields are not extended or dual-written.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Pure calculations cover person-hour, equipment-day, and material-unit
  semantics, including cost-per-use.
- [x] Missing/invalid references, rate, rate unit, planned units, actuals, and
  task dates produce named diagnostics.
- [x] Incomplete cost facts make project cost metrics unavailable rather than
  publishing valid-subset totals as complete.
- [x] Missing task dates leave PV, SV, and SPI unavailable rather than
  fabricating zero planned value.
- [x] Explicit actual cost remains included when the planned baseline is zero.
- [x] Actual cost, CV, and CPI remain unavailable unless every cost-bearing
  assignment has actual units or explicit actual cost.
- [ ] Persistence, manager authorization, stale-write, tenant, and immutable
  snapshot contracts pass.
- [ ] Requested behavior is observable end to end in the canonical resource
  panel with desktop/mobile screenshots.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before persistence edits.
- [x] Premature placeholder UI and canonical-type extensions were removed.

## Implementation Checklist

- [x] Files/modules for the pure engine are isolated and session-owned.
- [x] Shared engine owns cross-cutting cost/EVM math and completeness state.
- [x] Errors and diagnostics are specific and actionable.
- [ ] Additive migration, generated types, service, API, hook, and canonical UI
  paths are implemented after the conflicting database lease clears.
- [ ] Database, authentication, permission, CAS, and delivery contracts are
  handled.

## Integration and Verification

- [x] Focused engine tests pass after the latest review fixes.
- [x] Targeted ESLint, changed type-debt, and unsafe-pattern checks pass after
  removing the test-only unsafe-cast finding.
- [ ] Database readback and rollback-only probes prove constraints, grants/RLS,
  authorization, CAS, and snapshot immutability.
- [ ] Authenticated E2E and current final-route screenshots prove the requested
  user flow.
- [x] Known repository-wide typecheck limitation is recorded precisely.
- [x] The approved pure-engine slice is published with exact origin/main blob
  parity; full feature publication remains pending persistence and UI.

## Failure-Loudly Contract

- Cause surfaced as: named engine diagnostic, guarded API error, visible
  recovery state, or stable database exception.
- Detection path: focused unit/route/component test, rollback-only database
  probe, authenticated browser network/DOM evidence, and schedule release gate.
- Recovery path: correct the named rate/unit/reference/date fact, record all
  required actuals, refresh stale data, or obtain schedule-manager access.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A; this is feature delivery, not an incident.
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: focused financial-completeness tests and independent
  two-axis review.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | High-risk acceptance, ownership, failure, and release gates recorded. |
| Focused tests | `pnpm.cmd --dir frontend exec jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-resource-cost.test.ts` | Passed | 1 suite, 10 tests after completeness review fixes. |
| Targeted lint | `pnpm.cmd --dir frontend exec eslint ...` | Passed | Engine and focused test are clean. |
| Changed guardrails | `typecheck:changed`; `guardrails:unsafe-patterns` | Passed | No new any or unsafe-pattern debt after removing the test-only double cast. |
| Full TypeScript | `node scripts/run-typecheck-bounded.mjs` | Bounded failure | No diagnostics emitted before the configured 300-second timeout; not claimed as a pass. |
| Independent review | Code-review skill, standards and spec axes | Approved | Final re-review found no unresolved P1/P2 standards, smell, or spec findings in the pure-engine slice. |
| Database ownership | `isolated-session-workspace.mjs status` | Blocked | CRM-002 still owns migration/test/generated-type paths through 2026-08-04. |
| Pure-engine publication | `remote-main-publish.mjs`; origin blob readback | Passed | Three exact files published at `01140887a4ba67648c3ddb5079cd58b6d2789f42`; all local/remote blob IDs match. |

## Remaining Risk

- Persistence and authenticated UI remain blocked by CRM-002 path ownership.
  Owner: CRM-002. Detection: isolated-workspace registry. Next action: claim
  the paths immediately after that workspace publishes/retires, then finish
  migration through production readback.
- Repository-wide TypeScript can exceed its five-minute bound without
  diagnostics. Owner: frontend build tooling. Prevention: keep focused strict
  compilation, lint, and release gates mandatory; do not call the full check a
  pass.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred work names cause, detection, prevention, owner, and next action.
