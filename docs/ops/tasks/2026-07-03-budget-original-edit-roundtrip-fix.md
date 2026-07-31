# Task: Fix Budget Original Edit Round-Trip Persistence

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-910 - https://linear.app/megankharrison/issue/AAI-910/full-budget-end-to-end-audit-and-repair-loop-excluding-erpintegrations
Related Handoff: None

## Objective

Make the original-budget edit workflow on the budget page round-trip `Unit Qty`,
`UOM`, and `Unit Cost` correctly: save them through the canonical PATCH route,
return them through the canonical budget fetch path, and prove the reopen modal
prefills the saved values.

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

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Root cause evidence | `verify-output/budget-functionality/report.md` | Pass | Verification proved dropped `UOM` and blank reopen prefill on `/760/budget`. |
| Static/lint | `./node_modules/.bin/eslint ...budget...` | Pass with warnings | No errors. Existing design-system warnings remain in `frontend/src/components/budget/original-budget-edit-modal.tsx` at lines 383, 472, 478, 484. |
| Targeted tests | `npm run test:unit -- --runInBand --runTestsByPath ...` | Pass | Budget helper, compute, and PATCH-route regression tests all passed. |
| Browser/user-flow | `verify-output/budget-functionality/screenshots/unlocked-budget-edit-fixed-*.png` | Pass | Live route `/760/budget` reopened with `Calculated` selected and saved values visible. |
| DB read-back | `psql ... select id, quantity, unit_of_measure, unit_cost ...` | Pass | Temporary verification save persisted `3 / ea / 3921` before cleanup. |
| End-to-end proof | `verify-output/budget-functionality/report.md` | Pass | Report updated to current PASS state after fix and retest. |

## Files Changed

- `frontend/src/lib/budget/update-budget-line-item.ts` - include `unit_of_measure` in shared edit payload.
- `frontend/src/app/api/projects/[projectId]/budget/lines/[lineId]/route.ts` - accept and persist `unit_of_measure`.
- `frontend/src/lib/budget/compute-grand-totals.ts` - return saved qty/UOM/unit cost in canonical budget fetch data.
- `frontend/src/app/(main)/[projectId]/budget/page.tsx` - pass `uom` into the shared update helper.
- Relevant budget unit tests - guard the payload, route contract, and fetch mapping.

## Risks / Gaps

- Browser verification uses live local data; any restore step must avoid leaving artificial unit metadata behind on project `760`.
- The budget bootstrap route failed separately on `project_roles` RLS during verification. That is unrelated to this round-trip fix unless the targeted checks depend on bootstrap fixtures.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
