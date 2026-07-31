# AI Document Field And Commitment Descriptors

Date: 2026-06-27
Linear: AAI-747
Parent: AAI-636
Status: Complete

## Objective

Continue the AI assistant descriptor registry seam by adding descriptor-owned
setup for the remaining non-delivery confirmed-write action tools.

## Scope

- Migrate confirmed-write action tools:
  - `createMeetingNote`
  - `createSubmittal`
  - `logDailyReport`
  - `generateProjectSummary`
  - `createCommitment`
- Preserve existing execution adapters in `action-tools.ts`.
- Preserve preview/write, approval, idempotency, access enforcement, document,
  submittal, daily-log, summary, commitment, and audit behavior.
- Project descriptor-owned write policy into existing registry entries.
- Add focused tests for descriptor ownership, ledger policy, and schema defaults.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory current document/field/commitment descriptions, schemas,
  approval, idempotency, and ledger policy.
- [x] Add descriptors without changing execution ownership.
- [x] Migrate runtime tool definitions to descriptor-owned description/schema.
- [x] Project write descriptors into action registry entries.
- [x] Add/update focused unit tests.
- [x] Run focused registry/tool tests.
- [x] Run existing AI assistant tool registry verifier.
- [x] Run targeted lint and changed type guard.
- [x] Publish exact task-owned files to `origin/main`.
- [x] Update Linear with closeout evidence.

## Evidence

Linear issue:

- AAI-747: https://linear.app/megankharrison/issue/AAI-747/add-descriptor-coverage-for-document-field-and-commitment-write-tools

Command evidence:

- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts` - passed, 22 tests.
- `node scripts/verify/verify_ai_assistant_tool_registry.mjs` - passed.
- `cd frontend && ./node_modules/.bin/eslint src/lib/ai/tool-descriptors.ts src/lib/ai/tools/action-tools.ts src/lib/ai/__tests__/tool-registry.test.ts --quiet` - passed.
- `cd frontend && npm run typecheck:changed` - passed, no new `any` type debt.
- `npm run codex:finish -- --message "Add document write tool descriptors" --files frontend/src/lib/ai/tool-descriptors.ts frontend/src/lib/ai/tools/action-tools.ts frontend/src/lib/ai/__tests__/tool-registry.test.ts --no-verify` - passed, commit `f7ffdc604e91c345e533c5404bbd2d00de049589` pushed to `origin/main`.
- `git rev-parse HEAD && git rev-parse origin/main` - both returned `f7ffdc604e91c345e533c5404bbd2d00de049589`.

Changed files:

- `frontend/src/lib/ai/tool-descriptors.ts`
- `frontend/src/lib/ai/tools/action-tools.ts`
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts`

Remaining migration path:

- Delivery tools still need a separate channel-aware descriptor slice:
  `createOutlookCalendarInvite`, `draftOutlookEmail`, and `sendTeamsMessage`.

## Initial Constraints

- Main checkout contains unrelated dirty files; this slice must stage only
  task-owned files.
- Execution stays behind existing action tool adapters.
- Delivery tools remain out of scope because they need channel-specific policy.

## Root Cause

Document/field and commitment write registry entries still depend on generic
factory metadata while model-facing descriptions and schemas live inside runtime
action tool definitions. That split allows confirmed-write policy, schema
defaults, and ledger requirements to drift from the registry.

## Prevention

Focused registry tests should fail loudly when descriptor metadata no longer
reaches AI Ops definitions, write policy, and ledger-required registry fields.
