# AI MCP Tool Descriptor Policy

Date: 2026-06-27
Linear: AAI-742
Parent: AAI-636
Status: Complete

## Objective

Continue the AI assistant descriptor registry seam by moving MCP runtime exposure
policy into descriptor-owned helpers, without changing MCP discovery, client
lifecycle, or the currently dirty chat handler.

## Scope

- Preserve existing MCP server discovery and close behavior.
- Keep the handler-owned MCP merge path unchanged for this slice.
- Add descriptor-owned MCP exposure policy before tools are returned from the
  adapter.
- Preserve the Excalidraw allowlist behavior and generic read-only filtering.
- Add focused tests for descriptor projection and denial reasons.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory current MCP allowlist/pattern policy and handler merge path.
- [x] Add MCP descriptor policy without changing handler execution ownership.
- [x] Route MCP tool filtering through descriptor-owned policy.
- [x] Add/update focused MCP tests.
- [x] Run focused MCP tests.
- [x] Run existing AI assistant tool registry verifier.
- [x] Run targeted lint and changed type guard.
- [ ] Publish exact task-owned files to `origin/main`.
- [ ] Update Linear with closeout evidence.

## Evidence

Linear issue:

- AAI-742: https://linear.app/megankharrison/issue/AAI-742/bring-ai-assistant-mcp-tools-under-descriptor-policy-seam

Command evidence:

- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/ai/tools/__tests__/mcp-tools.test.ts` — PASS, 3 tests.
- `node scripts/verify/verify_ai_assistant_tool_registry.mjs` — PASS.
- `cd frontend && ./node_modules/.bin/eslint src/lib/ai/tool-descriptors.ts src/lib/ai/tools/mcp-tools.ts src/lib/ai/tools/__tests__/mcp-tools.test.ts --quiet` — PASS.
- `cd frontend && npm run typecheck:changed` — PASS, no new `any` type debt.

Changed files:

- `frontend/src/lib/ai/tool-descriptors.ts`
- `frontend/src/lib/ai/tools/mcp-tools.ts`
- `frontend/src/lib/ai/tools/__tests__/mcp-tools.test.ts`

Remaining migration path:

- Move write/action tools into descriptors with confirmed-write approval and
  ledger policy.

## Initial Constraints

- Main checkout contains unrelated dirty files; this slice must stage only
  task-owned files.
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` is already dirty with
  unrelated work, so this slice must not modify it.
- MCP tools are runtime-discovered, so the descriptor seam is dynamic exposure
  policy rather than static global registry entries.

## Root Cause

MCP tool exposure currently depends on allowlist and read-only pattern checks
inside `mcp-tools.ts`. That policy is not expressed as a descriptor seam, so MCP
tools bypass the registry-style setup hardening applied to in-process assistant
tools.

## Prevention

MCP discovery should construct a descriptor for every exposed prefixed tool and
return a denial reason for tools that fail descriptor policy. Focused tests
should prove the adapter no longer exposes MCP tools through raw pattern checks
alone.
