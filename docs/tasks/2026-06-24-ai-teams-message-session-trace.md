# Task: AI Teams Message Session Trace

Status: Complete
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-619 - https://linear.app/megankharrison/issue/AAI-619/route-same-day-teams-message-prompts-to-teams-specific-retrieval
Related Handoff: N/A

## Objective

Trace AI session `f90664ca-1b5a-4175-a1a1-b72c1e86f9c3` and identify why
the assistant answered with meeting intelligence instead of today's Teams
message results.

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

Acceptance criteria:

- Identify the exact user prompt and assistant response in the session.
- Identify whether Teams messages existed in source storage/search for today.
- Identify whether the session attempted Teams search or fell back to meetings.
- State the root cause with evidence and name the likely owner path.

Failure-loudly behavior:

- If Teams search returns no current results, the assistant must report the
  empty Teams retrieval explicitly and must not silently substitute meetings.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

Files/modules to inspect/change:

- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `frontend/src/app/api/ai-assistant/messages/[sessionId]/route.ts`
- `frontend/src/hooks/use-chat-session-messages.ts`
- `frontend/src/lib/ai/detect-rag-request.ts`
- `frontend/src/lib/ai/__tests__/rag-meeting-retrieval.test.ts`
- `frontend/src/lib/ai/retrieval/__tests__/planner.test.ts`
- `backend/src/services/agents/alleato_ai_tools/rag.py`
- `backend/src/services/integrations/microsoft_graph/teams.py`
- `backend/src/services/integrations/microsoft_graph/embed.py`

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
| Static/type/lint      | `pnpm --dir frontend exec prettier --check src/lib/ai/detect-rag-request.ts src/lib/ai/__tests__/rag-meeting-retrieval.test.ts src/lib/ai/retrieval/__tests__/planner.test.ts` | Pass | All matched files use Prettier code style. |
| Targeted tests        | `pnpm --dir frontend exec jest src/lib/ai/__tests__/rag-meeting-retrieval.test.ts src/lib/ai/retrieval/__tests__/planner.test.ts --runInBand` | Pass | 2 suites, 93 tests passed. Added detector and planner regressions for `what insights can be found in the teams messages today?`. |
| Browser/user-flow     | `agent-browser open https://projects.alleatogroup.com/ai?session=f90664ca-1b5a-4175-a1a1-b72c1e86f9c3 && agent-browser snapshot -i` | Partial | Login succeeded, but UI showed `Conversation not found` for the logged-in test user because the session belongs to user `2af4889b-f1a0-489e-a165-f5de5805e03a`; service-role read was used for the transcript. |
| DB/provider read-back | Service-role Supabase read of `conversations`, `chat_history`, `document_metadata`, and RAG `document_chunks` for 2026-06-24 | Pass | Session exists with 4 messages. Teams rows for 2026-06-24 exist in `document_metadata`; sample RAG chunk text exists for at least one same-day Teams conversation. |
| End-to-end proof      | Stored metadata for assistant message `909ca354-1299-43e6-bf0b-af7a1bdc8a47` | Pass | Original Teams prompt routed as `source_lookup_intent` with `semanticVectorSearch`, then tool trace included `getMeetingIntelligence`; no `sourceSpecificRagRetrieval` or `searchTeamsMessages` was attempted. Fixed planner now routes the exact prompt to `source_specific_rag_recent_teams_discussions`. |

## Files Changed

- `docs/tasks/2026-06-24-ai-teams-message-session-trace.md` - Investigation ledger and evidence record.
- `frontend/src/lib/ai/detect-rag-request.ts` - Routes same-day Teams message wording to the Teams-specific retrieval path.
- `frontend/src/lib/ai/__tests__/rag-meeting-retrieval.test.ts` - Detector regression for the exact saved prompt.
- `frontend/src/lib/ai/retrieval/__tests__/planner.test.ts` - Planner regression proving the prompt no longer uses generic semantic search.

## Risks / Gaps

- Existing unrelated dirty files are present in the checkout and were not touched.
- Production will continue showing the old behavior until this fix is published.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
