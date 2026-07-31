# AI Debug Tool Discovery Clarity

Date: 2026-07-06
Linear: AAI-949
Status: Complete

## Objective

Make the AI Assistant Debug Console clearly distinguish model-selected tool
calls from MCP/tool availability discovery and response quality scoring.

## Scope

- Split `mcpToolDiscovery` out of normal assistant tool-call lists.
- Label response quality as a score, not a count.
- Show native write-tool expectation when a change-event prompt routes to
  `change_event_write`.
- Verify the debug route and client with focused checks.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Inspect the persisted change-event turn and debug metadata shape.
- [x] Update debug API normalization.
- [x] Update debug console presentation.
- [x] Run focused checks.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-949`.
- Linear closeout comment: `a0882bb9-9ca0-4aff-b786-ff2115d3b639`.
- The latest persisted `Can you help me create a new change event` assistant
  turn had `tool_trace.length === 4`, not 75.
- The `75` value came from `metadata.response_quality.score`.
- The trace entries were `semanticSearch` plus three `mcpToolDiscovery`
  bookkeeping entries for Excalidraw, Supabase, and Linear.
- `frontend/src/app/api/admin/ai-assistant-debug/route.ts` now returns:
  - `tools` for model-selected tool calls only.
  - `toolDiscovery` for MCP/tool availability bookkeeping.
  - `rawToolTraceCount` for the original persisted trace length.
  - `expectedNativeTool` for known routed write intents such as
    `change_event_write -> createChangeEvent`.
- `frontend/src/app/(admin)/ai-assistant-debug/ai-assistant-debug-console-client.tsx`
  now labels model-selected calls, discovery records, raw trace entries, and
  quality score separately.
- `cd frontend && npx eslint 'src/app/(admin)/ai-assistant-debug/ai-assistant-debug-console-client.tsx' 'src/app/api/admin/ai-assistant-debug/route.ts'`
  passed.
- `cd frontend && npm run typecheck:changed` passed.
- `npm run check:routes` passed.
- `npx markdownlint-cli2 --no-globs docs/ops/tasks/2026-07-06-ai-debug-tool-discovery-clarity.md`
  passed.

## Failure Contract

- Cause: discovery bookkeeping and model-selected tool calls shared the same
  `tool_trace` list.
- Detection gap: the debug UI did not separate quality scoring, tool discovery,
  and actual tool execution.
- Prevention: normalize those concepts separately before rendering.
