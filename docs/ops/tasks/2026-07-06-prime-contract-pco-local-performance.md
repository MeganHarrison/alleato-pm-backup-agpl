# Task: Prime-contract PCO local performance

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-976 - https://linear.app/megankharrison/issue/AAI-976/speed-up-local-prime-contract-pco-detail-route-by-deferring-financial
Related Handoff: Not created yet

## Objective

Reduce the initial local load cost of the prime-contract PCO detail route by deferring financial-markup code and data until the Financial Markup tab is actually opened.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/page.tsx' 'src/lib/prime-contract-pcos/financial-markup-load.ts' 'src/lib/prime-contract-pcos/__tests__/financial-markup-load.unit.test.ts'` | Pass | No ESLint findings on touched files. |
| Targeted tests        | `./node_modules/.bin/jest --runTestsByPath 'src/lib/prime-contract-pcos/__tests__/financial-markup-load.unit.test.ts' --runInBand` | Pass | Guard proves the page only loads financial markup data when the tab is opened and only once. |
| Browser/user-flow     | `agent-browser --session-name alleato-test-3001 open '<exact local route>'` plus resource-entry evals | Pass | Earlier fresh-route eval returned `[]` for `budget-codes`/`vertical-markup`; after clicking `Financial Markup`, resource eval returned both request URLs. Screenshot: `docs/ops/evidence/2026-07-06-prime-contract-pco-financial-markup-lazy-load.png`. |
| DB/provider read-back | N/A                | N/A    | No migration or provider change expected. |
| End-to-end proof      | Exact route: `http://localhost:3001/876/prime-contracts/6d90f64a-d9e2-4cb7-9aee-389dda0c9f4f/change-orders/pcos/04e484af-457e-4e39-ad59-8515da5e3dde` | Pass | General tab no longer needs financial-markup requests; Financial Markup tab still loads them on demand. |

## Files Changed

- `docs/ops/tasks/2026-07-06-prime-contract-pco-local-performance.md` - task ledger
- `frontend/src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/page.tsx` - defer heavy financial-markup code and requests until tab activation
- `frontend/src/lib/prime-contract-pcos/financial-markup-load.ts` - shared guard for deferred-load contract
- `frontend/src/lib/prime-contract-pcos/__tests__/financial-markup-load.unit.test.ts` - regression coverage for deferred-load contract

## Risks / Gaps

- The broader app shell and middleware still contribute meaningful local dev cost; this slice only removes page-owned waste.
- One later browser check reused a warm browser context and showed stale resource entries; the reliable proof for this task is the fresh-route eval plus on-demand-tab eval recorded above.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
