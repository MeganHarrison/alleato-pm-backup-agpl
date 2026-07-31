# AI Meeting Tool Descriptors

Date: 2026-06-27
Linear: AAI-735
Parent: AAI-636
Status: Complete

## Objective

Continue the AI assistant descriptor registry seam by moving meeting source-read
tool setup into descriptor-owned metadata and schemas, without changing runtime
execution ownership.

## Scope

- Migrate meeting source-read tools:
  - `getMeetingsByDate`
  - `searchMeetingsByTopic`
  - `getMeetingDetails`
- Preserve existing execution adapters in project tools.
- Project descriptor-owned meeting policy into the existing registry and routing
  guide.
- Add focused tests for descriptor-owned registry projection and meeting schema
  defaults.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory current meeting tool descriptions, schemas, and routing policy.
- [x] Add meeting descriptors without changing execution ownership.
- [x] Migrate project-tool definitions to descriptor-owned description/schema.
- [x] Remove duplicate meeting routing policy from generic registry map.
- [x] Add/update focused unit tests.
- [x] Run focused registry/tool tests.
- [x] Run existing AI assistant tool registry verifier.
- [x] Run targeted lint and changed type guard.
- [ ] Publish exact task-owned files to `origin/main`.
- [ ] Update Linear with closeout evidence.

## Evidence

Linear issue:

- AAI-735: https://linear.app/megankharrison/issue/AAI-735/migrate-ai-assistant-meeting-source-tools-into-descriptors

Command evidence:

- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts` — PASS, 19 tests.
- `node scripts/verify/verify_ai_assistant_tool_registry.mjs` — PASS.
- `cd frontend && ./node_modules/.bin/eslint src/lib/ai/tool-descriptors.ts src/lib/ai/tool-registry.ts src/lib/ai/tools/operational.ts src/lib/ai/tools/project-tools.ts src/lib/ai/__tests__/tool-registry.test.ts --quiet` — PASS.
- `cd frontend && npm run typecheck:changed` — PASS, no new `any` type debt.

Changed files:

- `frontend/src/lib/ai/tool-descriptors.ts`
- `frontend/src/lib/ai/tool-registry.ts`
- `frontend/src/lib/ai/tools/operational.ts`
- `frontend/src/lib/ai/tools/project-tools.ts`
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts`

Remaining migration path:

- Move broad RAG/document read tools into descriptors.
- Move Acumatica read tools into descriptors.
- Bring MCP under the descriptor seam only after in-process source-read
  descriptor projection is stable.
- Move write/action tools last because confirmed-write approval and ledger
  behavior need a wider descriptor interface.

## Initial Constraints

- Main checkout contains unrelated dirty files; this slice must stage only
  task-owned files.
- Descriptor module should deepen the existing registry seam, not create a
  parallel registry.
- Execution stays behind existing tool factories/adapters.

## Root Cause

Meeting source routing policy, model-facing descriptions, and input schemas are
still split between `tool-registry.ts` and project tool definitions. That leaves
the meeting retrieval interface vulnerable to drift after the Outlook/Teams
descriptor slice.

## Prevention

Meeting tools should fail loudly through focused registry tests when descriptor
metadata no longer reaches AI Ops definitions and runtime routing guidance.
