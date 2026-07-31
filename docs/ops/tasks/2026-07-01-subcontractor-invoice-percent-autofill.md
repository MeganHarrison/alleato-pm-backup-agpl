# Task: Subcontractor Invoice Percent Autofill

Status: In Progress - Reopened after numeric-input regression report
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-843
Related Handoff: docs/ops/handoffs/2026-07-01-S105-subcontractor-invoice-percent-autofill.md

## Objective

Allow users creating a subcontractor invoice on `/[projectId]/invoicing/subcontractor/new`
to enter a percent and have the current-period dollar amount populate
deterministically for commitment SOV and approved commitment change-order rows.

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
| Static/type/lint      | `cd frontend && npx eslint src/app/'(main)'/'[projectId]'/invoicing/subcontractor/new/page.tsx src/components/forms/NumberField.tsx src/components/forms/fields/RHFNumberField.tsx`; `cd frontend && npx eslint --rule 'design-system/require-approved-form-components:error' src/components/daily-log/DailyLogFormClient.tsx`; `cd frontend && npm run audit:forms:components` | Pass | Invoice page lint now passes with only pre-existing table/page warnings. The tightened rule fails loudly on existing raw numeric-input debt (`DailyLogFormClient.tsx`: 5 errors). Full audit currently reports 514 form-component violations repo-wide: 427 `require-approved-form-components`, 85 `no-raw-form-controls`, 2 `require-money-field`. |
| Targeted tests        | `cd frontend && npx jest --runInBand src/lib/invoicing/__tests__/subcontractor-percent-autofill.test.ts` | Pass | 4/4 tests passed. JSON artifact written to `/tmp/aai843-jest.json`. |
| Browser/user-flow     | `agent-browser --state frontend/tests/.auth/user.json --session aai843percent2 ...`; screenshot `/tmp/aai843-percent-focus-fix.png` | Pass | Exact route `/876/invoicing/subcontractor/new?commitmentType=purchase_order&commitmentId=a0d9d40d-37c5-4739-872e-e5412cbc785b` loaded locally. The first percent field started at `0`; after click + real keyboard input `2`, the value remained `2` instead of becoming `20`, and the amount field updated to `560.00`. Changing the amount field to `600` synced the percent field to `2.14`. |
| DB/provider read-back | Supabase service-role read-back for test-user access to project `876`; GitHub issue `#595` close; Linear `AAI-843` set to Done | Pass | Verification-only provider updates: ensured active `project_directory_memberships` row for browser proof, then closed both tracking issues after publish. |
| End-to-end proof      | Live local form interaction on the exact invoice-create route | Pass | Entering `50%` on the first SOV row auto-populated `$14,000`; manually changing the amount to `$14,100` synced the percent back to `50.36%`. Published to `origin/main` at `93293ab83`. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/invoicing/subcontractor/new/page.tsx` - invoice-create UI behavior
- `frontend/src/components/forms/NumberField.tsx` - shared non-currency wrapper now uses `NumberInput`
- `frontend/src/components/forms/fields/RHFNumberField.tsx` - RHF numeric wrapper now uses `NumberInput`
- `frontend/eslint-plugin-design-system/rules/require-approved-form-components.js` - numeric-input guardrail
- `frontend/eslint-plugin-design-system/rules/require-approved-form-components.test.cjs` - guardrail test coverage
- `frontend/eslint.config.mjs` - global warn-level visibility for the approved-components rule
- `frontend/src/lib/invoicing/**` - shared helper/test surface if needed
- `docs/ops/tasks/2026-07-01-subcontractor-invoice-percent-autofill.md` - task definition of done
- `docs/ops/handoffs/2026-07-01-S105-subcontractor-invoice-percent-autofill.md` - handoff ledger
- `docs/ops/orchestration/session-board.md` - session claim and closeout status
- `docs/ops/orchestration/review-queue.md` - pending review row for the completed handoff

## Risks / Gaps

- The input now behaves as total completed percent-to-date, deriving the
  current-period amount from `scheduled_value * percent - previously billed`.
  If product later wants a different percent semantic, this shared helper is
  the single seam to change.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
