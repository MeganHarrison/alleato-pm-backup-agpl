# AI RAG Document Tool Descriptors

Date: 2026-06-27
Linear: AAI-736
Parent: AAI-636
Status: Complete

## Objective

Continue the AI assistant descriptor registry seam by moving broad RAG/document
source-read tool setup into descriptor-owned metadata and schemas, without
changing runtime execution ownership.

## Scope

- Migrate broad RAG/document source-read tools:
  - `semanticSearch`
  - `searchExternalDocuments`
  - `findProjectDocuments`
  - `searchDocuments`
- Preserve existing execution adapters in operational and project tools.
- Project descriptor-owned document/RAG policy into the existing registry and
  routing guide.
- Add focused tests for descriptor-owned registry projection and schema defaults.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory current document/RAG tool descriptions, schemas, and routing policy.
- [x] Add document/RAG descriptors without changing execution ownership.
- [x] Migrate runtime tool definitions to descriptor-owned description/schema.
- [x] Remove duplicate document/RAG routing policy from generic registry map.
- [x] Add/update focused unit tests.
- [x] Run focused registry/tool tests.
- [x] Run existing AI assistant tool registry verifier.
- [x] Run targeted lint and changed type guard.
- [ ] Publish exact task-owned files to `origin/main`.
- [ ] Update Linear with closeout evidence.

## Evidence

Linear issue:

- AAI-736: https://linear.app/megankharrison/issue/AAI-736/migrate-ai-assistant-rag-document-read-tools-into-descriptors

Command evidence:

- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts` — PASS, 20 tests.
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

Broad document/RAG routing policy, model-facing descriptions, and input schemas
are still split between `tool-registry.ts`, operational tools, and project tools.
That leaves document source retrieval vulnerable to drift after the Outlook,
Teams, and meeting descriptor slices.

## Prevention

Document/RAG tools should fail loudly through focused registry tests when
descriptor metadata no longer reaches AI Ops definitions and runtime routing
guidance.
