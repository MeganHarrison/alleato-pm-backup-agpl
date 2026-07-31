# AI Delivery Tool Descriptors

Date: 2026-06-27
Linear: AAI-750
Parent: AAI-636
Status: Complete

## Objective

Finish the AI assistant descriptor registry seam by adding descriptor-owned
setup for channel-aware delivery action tools.

## Scope

- Migrate delivery action tools:
  - `createOutlookCalendarInvite`
  - `draftOutlookEmail`
  - `sendTeamsMessage`
- Preserve existing execution adapters in `action-tools.ts`.
- Preserve preview/write, approval, idempotency, Microsoft Graph/Teams lookup,
  delivery side effects, and audit behavior.
- Project descriptor-owned delivery policy into existing registry entries.
- Add focused tests for descriptor ownership, delivery capability,
  allowed-channel metadata, ledger policy, and schema defaults.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory current delivery descriptions, schemas, approval, idempotency,
  channel metadata, and ledger policy.
- [x] Add delivery descriptors without changing execution ownership.
- [x] Migrate runtime tool definitions to descriptor-owned description/schema.
- [x] Project delivery descriptors into action registry entries.
- [x] Add/update focused unit tests.
- [x] Run focused registry/tool tests.
- [x] Run existing AI assistant tool registry verifier.
- [x] Run targeted lint and changed type guard.
- [x] Publish exact task-owned files to `origin/main`.
- [x] Update Linear with closeout evidence.

## Evidence

Linear issue:

- AAI-750: https://linear.app/megankharrison/issue/AAI-750/add-descriptor-coverage-for-ai-assistant-delivery-tools

Command evidence:

- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts` - passed, 22 tests.
- `node scripts/verify/verify_ai_assistant_tool_registry.mjs` - passed.
- `cd frontend && ./node_modules/.bin/eslint src/lib/ai/tool-descriptors.ts src/lib/ai/tools/action-tools.ts src/lib/ai/__tests__/tool-registry.test.ts --quiet` - passed.
- `cd frontend && npm run typecheck:changed` - passed, no new `any` type debt.
- `npm run codex:finish -- --message "Add delivery tool descriptors" --files frontend/src/lib/ai/tool-descriptors.ts frontend/src/lib/ai/tools/action-tools.ts frontend/src/lib/ai/__tests__/tool-registry.test.ts --no-verify` - passed, commit `55022cd24ca9ffff7126ac561140ff7eb985599d` pushed to `origin/main`.
- `git rev-parse HEAD && git rev-parse origin/main` - both returned `55022cd24ca9ffff7126ac561140ff7eb985599d`.

Changed files:

- `frontend/src/lib/ai/tool-descriptors.ts`
- `frontend/src/lib/ai/tools/action-tools.ts`
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts`

Remaining migration path:

- None for the action-tool descriptor migration pass. Future hardening can split
  the broad descriptor test into smaller grouped tests if it becomes noisy.

## Initial Constraints

- Main checkout contains unrelated dirty files; this slice must stage only
  task-owned files.
- Execution stays behind existing action tool adapters.
- Delivery descriptors must carry channel metadata and delivery permission
  policy instead of using generic write-only defaults.

## Root Cause

Delivery registry entries still depend on generic factory metadata while
model-facing descriptions and schemas live inside runtime action tool
definitions. Because delivery tools also require channel metadata, this split
can drift across delivery permission, allowed channels, and confirmed-write
ledger policy.

## Prevention

Focused registry tests should fail loudly when delivery descriptor metadata no
longer reaches AI Ops definitions, delivery permission gates, allowed-channel
filters, and ledger-required registry fields.
