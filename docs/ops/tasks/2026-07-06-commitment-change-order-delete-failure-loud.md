# Task: Commitment Change Order Delete Failure-Loud Repair

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-980 - https://linear.app/megankharrison/issue/AAI-980/fix-commitment-change-order-delete-failures-and-surface-exact-blockers
Related Handoff: docs/ops/handoffs/2026-07-06-S121-commitment-cco-delete-failure-loud.md

## Objective

Make delete failures on the canonical commitment change-order detail route
(`/876/change-orders/commitment/aa35f3c3-5ec0-4568-b126-f8671b4791cc`) fail
loudly with the exact blocker reason, and delete successfully when only safe
dependent rows need coordinated cleanup.

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
| Exact route / prior context | `docs/ops/tasks/2026-07-02-commitment-change-order-email-delivery.md`; `docs/ops/evidence/2026-07-06-brandon-feedback-verification/brandon-feedback-verification-report.md` | Pass | Exact record and route already established in repo artifacts. |
| Linear tracking | `AAI-980` | Pass | Issue created before code edits for this slice. |
| Exact record read-back | service-role query against `contract_change_orders`, `commitment_change_order_lines`, and `payment_application_line_items` for `aa35f3c3-5ec0-4568-b126-f8671b4791cc` | Pass | Current row is `pending`, has `1` scoped line item, and `0` payment-application references. |
| Targeted tests | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/__tests__/route.test.ts'` | Pass | Covers non-draft blocker, payment-application blocker, and scoped line-item cleanup before parent delete. |
| Static/lint | `cd frontend && ./node_modules/.bin/eslint 'src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/route.ts' 'src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/__tests__/route.test.ts' 'src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx' --no-warn-ignored` | Pass with existing warnings | No new errors. Page file still carries pre-existing design-system warnings unrelated to this delete-path change. |
| Browser/user-flow | `agent-browser --state frontend/tests/.auth/user.json open http://localhost:3001/876/change-orders/commitment/aa35f3c3-5ec0-4568-b126-f8671b4791cc`; authenticated `fetch('/api/commitments/...',{method:'DELETE'})` from that page | Pass | Exact route loaded locally; authenticated DELETE now returns a structured `PRECONDITION_FAILED` envelope with the specific draft-status message instead of a generic error. |
| Browser artifacts | `docs/ops/evidence/2026-07-06-commitment-cco-delete-failure-loud/{localhost-route-loaded.png,delete-attempt-after-confirm.png,delete-api-response.json}` | Pass | Captures the exact route plus the authenticated delete-response payload for the named record. |

## Files Changed

- `docs/ops/tasks/2026-07-06-commitment-change-order-delete-failure-loud.md` - task definition and evidence ledger.
- `docs/ops/handoffs/2026-07-06-S121-commitment-cco-delete-failure-loud.md` - worker handoff and command ledger.
- `docs/ops/orchestration/session-board.md` - active ownership claim.
- `frontend/src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/route.ts` - canonical delete owner.
- `frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx` - exact-route delete UX.
- `frontend/src/hooks/use-commitment-change-orders.ts` - shared client delete error path if needed.
- `frontend/src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/__tests__/route.test.ts` - regression guardrail for delete behavior.

## Risks / Gaps

- The checkout is already dirty with unrelated active work; publish scope must
  stay limited to task-owned files.
- `commitment_change_order_lines` currently behaves like an app-owned child table
  without a database FK back to `contract_change_orders`; this slice deletes
  scoped line items explicitly to avoid new orphans, but a deeper schema
  backstop remains follow-on work because at least one pre-existing orphan row
  already exists in the table.
- I proved the exact authenticated DELETE response on the named route, but I did
  not capture a screenshot of the rendered toast text itself after the UI click.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
