# Task: Build Accounting AI dashboard visualizations

Status: In Progress — Browser verification blocked by authentication
Owner: Codex
Created: 2026-07-17
Task ID: AAI-1144
Linear Issue: [AAI-1144](https://linear.app/megankharrison/issue/AAI-1144/build-accounting-ai-dashboard-visualizations)
Related Handoff: `docs/ops/handoffs/2026-07-17-S-accounting-ai-dashboard.md`

## Objective

Deliver a source-linked Accounting page inside the executive AI dashboard with a shared visualization contract and five MVP financial views.

## Scope

- Owned surface: `/ai-dashboard/accounting`, its shared accounting visualization seam, and focused tests.
- Included visuals: portfolio financial health, cost-to-complete, budget variance by cost code, AR aging, and accounting exceptions.
- Explicit exclusion: follow-on cash exposure, commitment-versus-actual, and change-order waterfall work unless existing data makes them safe without expanding scope.

## Source of Truth

- Canonical runtime/data owner: existing `/ai-dashboard/accounting` route and accounting domain services/API sources.
- Existing shared primitives/services: executive dashboard workspace shell, dashboard visualization contract/server pattern, accounting spend, reconciliation, WIP, aging, Acumatica actuals, invoices, commitments, and change-order services.
- Deprecated or parallel paths: no new accounting dashboard route or page-local financial data contract.

Verification contract: Required

## Acceptance Criteria

- [ ] Five MVP visuals render on the canonical Accounting AI route. Partial: portfolio exposure, AR aging, and exceptions added; cost-code variance remains source-deferred.
- [ ] Each visual has source metadata, integrity state, refresh state, and canonical drilldown behavior.
- [ ] Empty, incomplete, and error sources fail loudly and are not rendered as zero-success data.
- [ ] Shared executive shell and noise-gate constraints remain intact.
- [ ] Responsive desktop/mobile browser proof and independent verification are captured.

## Implementation Checklist

- [ ] Files/modules to change are listed before edits.
- [ ] Shared accounting visualization abstraction owns cross-cutting behavior.
- [ ] Errors are specific and actionable.
- [ ] Existing accounting data sources and route contracts are reused.

## Integration and Verification

- [x] Focused unit/contract checks pass.
- [ ] Canonical route browser proof passes. Blocked by auth redirect.
- [ ] Desktop and mobile screenshots are recorded. Auth-blocker screenshot captured; result screenshot remains pending.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: source unavailable, incomplete, empty, or stale state with source label and recovery link.
- Detection path: visualization contract tests, route browser proof, and source-health UI.
- Recovery path: navigate to the source recovery route or inspect the linked accounting record.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Focused lint | Frontend ESLint on changed files | Pass | Changed Accounting preview and live-data contract. |
| Changed type guard | `npm run typecheck:changed` | Pass | No new `any` type debt. |
| Unit suite | Workspace AI dashboard unit suite | Pass | 7 tests passed. |
| Browser proof | `agent-browser` canonical route | Blocked | Redirected to `/auth/login`; screenshot captured at `/Users/meganharrison/.codex/visualizations/2026/07/17/019f6e28-896c-7013-8562-17302771e398/accounting-ai-dashboard-auth-blocked.png`. |

## Remaining Risk

- Authenticated browser proof is still required. Owner: Codex. Next action: load an authorized browser state and recapture desktop/mobile screenshots.
- Cost-code variance source fields are not present in the current live hook contract. Owner: implementation. Next action: extend shared accounting aggregation after source availability is confirmed.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
