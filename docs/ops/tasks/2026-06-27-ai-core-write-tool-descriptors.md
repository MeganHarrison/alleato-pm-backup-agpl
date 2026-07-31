# AI Core Write Tool Descriptors

Date: 2026-06-27
Linear: AAI-743
Parent: AAI-636
Status: Complete

## Objective

Continue the AI assistant descriptor registry seam by adding a descriptor
foundation for core confirmed-write action tools, without changing runtime
execution, approval, idempotency, or audit behavior.

## Scope

- Migrate core write/action tools:
  - `createChangeEvent`
  - `updateProjectStatus`
  - `createRFI`
  - `createTask`
- Preserve existing execution adapters in `action-tools.ts`.
- Project descriptor-owned write policy into the existing registry entries.
- Add focused tests for descriptor-owned write projection, ledger policy, and
  schema defaults.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory current core write descriptions, schemas, approval, and ledger policy.
- [x] Add core write descriptors without changing execution ownership.
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

- AAI-743: https://linear.app/megankharrison/issue/AAI-743/add-descriptor-foundation-for-core-ai-assistant-write-tools

Command evidence:

- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts` - passed, 22 tests.
- `node scripts/verify/verify_ai_assistant_tool_registry.mjs` - passed.
- `cd frontend && ./node_modules/.bin/eslint src/lib/ai/tool-descriptors.ts src/lib/ai/tool-registry.ts src/lib/ai/tools/action-tools.ts src/lib/ai/__tests__/tool-registry.test.ts --quiet` - passed.
- `cd frontend && npm run typecheck:changed` - passed, no new `any` type debt.
- `npm run codex:finish -- --message "Add core write tool descriptors" --files frontend/src/lib/ai/tool-descriptors.ts frontend/src/lib/ai/tool-registry.ts frontend/src/lib/ai/tools/action-tools.ts frontend/src/lib/ai/__tests__/tool-registry.test.ts --no-verify` - passed, commit `f14e986d196ae3797cf99924bf5c5d82f7d8c93e` pushed to `origin/main`.
- `git rev-parse HEAD && git rev-parse origin/main` - both returned `f14e986d196ae3797cf99924bf5c5d82f7d8c93e`.

Changed files:

- `frontend/src/lib/ai/tool-descriptors.ts`
- `frontend/src/lib/ai/tool-registry.ts`
- `frontend/src/lib/ai/tools/action-tools.ts`
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts`

Remaining migration path:

- Expand confirmed-write descriptors to change orders, generated tasks, project companies/contacts, risk/RFI status, submittals, daily reports, commitments, project summaries, and delivery tools.

## Initial Constraints

- Main checkout contains unrelated dirty files; this slice must stage only
  task-owned files.
- Execution stays behind existing action tool adapters.
- This slice establishes the write descriptor shape with four core tools before
  expanding across the full action surface.

## Root Cause

Write/action registry entries still use generic factory descriptions while
model-facing descriptions, schemas, approval behavior, and audit semantics live
inside action tool definitions. That split leaves confirmed-write behavior
vulnerable to drift.

## Prevention

Core write tools should fail loudly through focused registry tests when
descriptor metadata no longer reaches AI Ops definitions, write policy, and
ledger-required registry fields.
