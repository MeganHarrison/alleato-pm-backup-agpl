# AI Acumatica Tool Descriptors

Date: 2026-06-27
Linear: AAI-741
Parent: AAI-636
Status: Complete

## Objective

Continue the AI assistant descriptor registry seam by moving Acumatica/accounting
source-read tool setup into descriptor-owned metadata and schemas, without
changing runtime execution ownership.

## Scope

- Migrate Acumatica/accounting source-read tools:
  - `getAcumaticaProjectBudget`
  - `getAcumaticaProjectList`
  - `getAPAgingReport`
  - `getARAgingReport`
  - `getCashPositionReport`
  - `getVendorSpendReport`
  - `getRecentBills`
  - `getRecentInvoices`
  - `getPurchaseOrderSummary`
- Preserve existing execution adapters in Acumatica tools.
- Project descriptor-owned accounting policy into the existing registry and
  routing guide.
- Add focused tests for descriptor-owned registry projection and schema defaults.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory current Acumatica tool descriptions, schemas, and routing policy.
- [x] Add Acumatica descriptors without changing execution ownership.
- [x] Migrate runtime tool definitions to descriptor-owned description/schema.
- [x] Remove duplicate Acumatica routing policy from generic registry map.
- [x] Add/update focused unit tests.
- [x] Run focused registry/tool tests.
- [x] Run existing AI assistant tool registry verifier.
- [x] Run targeted lint and changed type guard.
- [ ] Publish exact task-owned files to `origin/main`.
- [ ] Update Linear with closeout evidence.

## Evidence

Linear issue:

- AAI-741: https://linear.app/megankharrison/issue/AAI-741/migrate-ai-assistant-acumatica-read-tools-into-descriptors

Command evidence:

- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts` — PASS, 21 tests.
- `node scripts/verify/verify_ai_assistant_tool_registry.mjs` — PASS.
- `cd frontend && ./node_modules/.bin/eslint src/lib/ai/tool-descriptors.ts src/lib/ai/tool-registry.ts src/lib/ai/tools/acumatica.ts src/lib/ai/__tests__/tool-registry.test.ts --quiet` — PASS.
- `cd frontend && npm run typecheck:changed` — PASS, no new `any` type debt.

Changed files:

- `frontend/src/lib/ai/tool-descriptors.ts`
- `frontend/src/lib/ai/tool-registry.ts`
- `frontend/src/lib/ai/tools/acumatica.ts`
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts`

Remaining migration path:

- Bring MCP under the descriptor seam after in-process source-read descriptor
  projection is stable.
- Move write/action tools last because confirmed-write approval and ledger
  behavior need a wider descriptor interface.

## Initial Constraints

- Main checkout contains unrelated dirty files; this slice must stage only
  task-owned files.
- Descriptor module should deepen the existing registry seam, not create a
  parallel registry.
- Execution stays behind existing Acumatica tool adapters.

## Root Cause

Acumatica routing policy, model-facing descriptions, and input schemas are still
split between `tool-registry.ts` and `acumatica.ts`. That leaves accounting
retrieval vulnerable to drift after the source-read descriptor slices.

## Prevention

Acumatica tools should fail loudly through focused registry tests when descriptor
metadata no longer reaches AI Ops definitions and runtime routing guidance.
