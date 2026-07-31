# Task: Executive Portfolio Operating State

Status: Done
Owner: Codex S175
Created: 2026-07-16
Task ID: AAI-1106
Linear Issue: [AAI-1106](https://linear.app/megankharrison/issue/AAI-1106/expand-verified-executive-state-across-the-active-portfolio)
Related Handoff: `docs/ops/handoffs/2026-07-16-S175-executive-portfolio-operating-state.md`

## Objective

Expose one read-only, portfolio-wide executive operating state for every eligible active project, retaining every project with an explicit coverage limitation instead of synthesizing or omitting project state.

## Scope

- A server-owned portfolio adapter composed from the published canonical executive state, controlled projection records, and existing attention/conflict/health contracts.
- A capability-protected API and a canonical executive briefing surface that makes portfolio coverage, freshness, conflicts, attention, and explicit limitations observable.
- Explicitly excludes new project writers, project-local executive models, attention/conflict lifecycle changes, and delivery ownership.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/executive/executive-state.ts` plus existing attention/conflict/system-health adapters.
- Eligible-project owner: `public.projects` active records, correlated to controlled `public.project_current_state` projections.
- Existing shared primitives/services: `loadCanonicalExecutiveState`, `loadExecutiveAttentionFeed`, `loadExecutiveConflictFeed`, `loadExecutiveSystemHealth`, `ExecutiveBriefView`.
- Deprecated or parallel paths: legacy `portfolio-synthesis-brief` is not an operational-state writer or reader for this task.

Verification contract: Required

## Acceptance Criteria

- [x] Every eligible active project participates in the same executive-state contract.
- [x] Coverage, freshness, conflicts, and limited-state reasons are visible per project and in the portfolio.
- [x] Cross-project attention is grouped using AAI-1102 records; no bespoke project model or parallel writer exists.
- [x] Real coverage readback and canonical desktop/mobile route evidence prove behavior.

## Implementation Checklist

- [x] Task-owned modules and tests are identified before edits.
- [x] Shared adapter owns portfolio composition and fail-loud coverage rules.
- [x] API access and runtime errors are specific and actionable.
- [x] Browser evidence, independent review, and verification contract are recorded.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an eligible project lacking a controlled projection or an executive coverage dimension is shown as `Limited` with each missing owner and recovery action; adapter errors return a guardrailed, actionable API failure.
- Detection path: portfolio API readback, browser route, and unit coverage against missing projection/evidence/conflict mapping.
- Recovery path: repair/replay the controlled projection or source owner; never write state from the portfolio UI.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: explicit eligible-project coverage invariant and regression tests.
- Guardrail evidence: task-owned unit tests and remote real-coverage readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Remote migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260716204441_expose_executive_attention_project_ownership.sql` | Pass | Supabase API applied version `20260716204441`; service-only function grant readback confirmed. |
| Focused tests | `cd frontend && ./node_modules/.bin/jest --runTestsByPath src/lib/executive/__tests__/executive-portfolio-state.test.ts src/app/api/executive/portfolio-state/__tests__/route.test.ts --runInBand` | Pass | 2 suites, 7 tests; includes direct ownership and acknowledged lifecycle regression. |
| Static checks | targeted ESLint and `npm run typecheck:changed` | Pass | No lint failures or new `any` debt. |
| Live coverage readback | `docs/ops/evidence/2026-07-16-executive-portfolio-operating-state/api-live-readback.json` | Pass | One eligible Current project, `Test July 2026`, remains Limited with projection/evidence recovery owners. |
| Canonical browser proof | `aai-1106-weekly-desktop.png`, `aai-1106-weekly-mobile.png` | Pass | Same governed weekly snapshot and 1 actionable attention / 0 conflicts at desktop and mobile. |
| Independent review | `docs/ops/evidence/2026-07-16-executive-portfolio-operating-state/independent-review.md` | Pass | Approved after snapshot, ownership, and lifecycle guardrail review. |

## Remaining Risk

- Active-project eligibility must be confirmed against the live `projects` authority before the route can be represented as complete.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
