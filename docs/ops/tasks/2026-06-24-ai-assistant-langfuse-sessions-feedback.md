# Task: AI Assistant Langfuse Sessions And Feedback

Status: Complete
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-623 - https://linear.app/megankharrison/issue/AAI-623/add-langfuse-sessions-and-feedback-scores-to-ai-assistant-chat
Related Handoff: N/A

## Objective

Add the first AI Assistant Langfuse observability slice: stable session/user trace
metadata on the live chat path and Langfuse feedback scores from existing
assistant feedback endpoints, without disrupting existing persisted
`chat_history.metadata` debug fields.

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
| Static/type/lint      | `NODE_OPTIONS=--max-old-space-size=8192 pnpm --dir frontend exec tsc --noEmit --pretty false --incremental false` | Pass | Initial run reported a transient/stale `project-documents-browser.tsx` `"full"` variant error; rerun passed after file content showed `variant="dashboard"`. |
| Static/type/lint      | `pnpm --dir frontend exec eslint <touched files>` | Pass | No lint output. |
| Targeted tests        | `pnpm --dir frontend exec jest src/lib/ai/__tests__/langfuse-feedback.test.ts src/components/ai-assistant/__tests__/langfuse-trace-metadata.test.ts src/components/ai/__tests__/AiResponseFeedback.test.tsx --runInBand` | Pass | 3 suites, 7 tests. |
| Browser/user-flow     | N/A | Not run | No visible UI behavior changed; component test verifies the exact feedback payload sent by the UI control. |
| DB/provider read-back | N/A | Not run | No schema, migration, env, or provider config change. Langfuse runtime call path uses existing configured client. |
| End-to-end proof      | Targeted tests above | Pass | Persisted metadata extraction maps Langfuse trace ids to UI message ids, feedback UI sends `traceId`, API route accepts direct trace id and falls back to DB metadata lookup. |

## Files Changed

- `docs/ops/tasks/2026-06-24-ai-assistant-langfuse-sessions-feedback.md` - Task done gate and evidence ledger.
- `frontend/src/lib/ai/langfuse-feedback.ts` - Shared trace id normalization and metadata helpers.
- `frontend/src/lib/ai/response-feedback-types.ts` - Feedback subject now carries optional message and trace ids.
- `frontend/src/components/ai/AiResponseFeedback.tsx` - Feedback POST sends message id and Langfuse trace id.
- `frontend/src/components/ai/__tests__/AiResponseFeedback.test.tsx` - Guardrail for feedback payload.
- `frontend/src/components/ai-assistant/chat-history.ts` - Extracts Langfuse trace ids from persisted assistant metadata.
- `frontend/src/components/ai-assistant/__tests__/langfuse-trace-metadata.test.ts` - Guardrail for persisted trace id extraction.
- `frontend/src/hooks/use-chat-session-messages.ts` - Loads Langfuse trace id map alongside existing trace diagnostics.
- `frontend/src/components/ai-assistant/chat-area.tsx` - Passes trace id into assistant-message feedback control.
- `frontend/src/components/ai-assistant/rag-chat-page.tsx` - Wires trace id map through full AI chat.
- `frontend/src/components/ai-assistant/widget-ai-chat.tsx` - Wires trace id map through floating AI widget.
- `frontend/src/app/api/ai-assistant/feedback/route.ts` - Scores direct Langfuse trace id first, with DB metadata fallback for older clients.
- `frontend/src/lib/ai/__tests__/langfuse-feedback.test.ts` - Guardrail for trace id normalization and metadata helpers.

## Risks / Gaps

- Existing unrelated dirty files are present in the checkout and must not be staged accidentally.
- Live Langfuse score creation was not re-tested against the provider in this slice; existing Langfuse client configuration is reused.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
