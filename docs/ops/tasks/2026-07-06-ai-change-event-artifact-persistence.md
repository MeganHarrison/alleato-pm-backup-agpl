# AI Change Event Artifact Persistence

Date: 2026-07-06
Linear: [AAI-961](https://linear.app/megankharrison/issue/AAI-961/persist-ai-change-event-draft-artifact-state)
Status: Complete

## Objective

Persist the AI Change Event draft as durable workspace artifact state so the
artifact survives reloads and can be edited independently from the chat scroll.

## Scope

- Reuse the existing `workspace_artifacts` persistence model if it fits.
- Add a `change_event_draft` workspace artifact type in application code.
- Upsert the latest Change Event workflow draft by user/session/project.
- Load the persisted draft for the active AI Assistant session.
- Keep the chat thread conversational and the artifact state structured.
- Preserve explicit user confirmation before creating any Change Event record.

## Out Of Scope

- Eve implementation.
- Deep-agent implementation.
- Full line-item workflow.
- New database migration unless `workspace_artifacts` proves insufficient.

## Current Repo Truth

- `workspace_artifacts` already supports user-scoped, project-scoped,
  session-scoped, versioned JSON artifacts.
- `workspace_artifacts.artifact_type` is `TEXT`, not a database enum.
- The existing service writes embeddings to the AI DB document chunks path and
  keeps PM App `workspace_artifacts.embedding` empty.
- The current Change Event artifact is derived from AI SDK data parts emitted
  into `chat_history.metadata.data_parts`.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Add a first-class `change_event_draft` artifact type in app code.
- [x] Add upsert/load helpers for session-scoped Change Event draft artifacts.
- [x] Persist workflow draft state from the AI assistant handler.
- [x] Load persisted workflow state into the chat UI before falling back to
  message data parts.
- [x] Add focused tests for artifact persistence helper behavior.
- [x] Run focused lint/tests/type checks.
- [x] Browser-verify the draft survives reload for the active AI session.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-961`.
- Repo inspection confirmed `workspace_artifacts` can represent this without a
  schema migration:
  - `supabase/migrations/20260503210000_workspace_artifacts.sql`
  - `frontend/src/lib/ai/services/workspace-artifact-service.ts`
  - `frontend/src/types/database.types.ts`
- Implemented `change_event_draft` artifact support in:
  - `frontend/src/lib/ai/services/workspace-artifact-service.ts`
  - `frontend/src/lib/ai/tools/workspace-tools.ts`
  - `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
  - `frontend/src/app/api/ai-assistant/workspace/route.ts`
  - `frontend/src/components/ai-assistant/chat-area.tsx`
  - `frontend/src/components/ai-assistant/artifact-body.tsx`
  - `frontend/src/components/ai-assistant/artifact-renderer.tsx`
  - `frontend/src/components/ai-assistant/artifact-side-panel.tsx`
- Focused tests:
  - `cd frontend && npx jest src/lib/ai/services/__tests__/workspace-artifact-service.test.ts src/lib/ai/__tests__/assistant-widgets.test.ts src/lib/ai/__tests__/change-event-workflow.test.ts --runInBand`
    - Pass: 3 suites, 17 tests.
- Focused lint:
  - `cd frontend && npx eslint src/lib/ai/services/workspace-artifact-service.ts src/lib/ai/services/__tests__/workspace-artifact-service.test.ts src/lib/ai/tools/workspace-tools.ts src/app/api/ai-assistant/workspace/route.ts src/app/api/ai-assistant/chat/handler-v2.ts src/components/ai-assistant/chat-area.tsx src/components/ai-assistant/artifact-body.tsx src/components/ai-assistant/artifact-renderer.tsx src/components/ai-assistant/artifact-side-panel.tsx`
    - Pass.
- Changed-file type debt check:
  - `cd frontend && npm run typecheck:changed`
    - Pass: no new `any` type debt detected.
- Route check:
  - `npm run check:routes`
    - Pass: no route conflicts found.
- Product noise gate:
  - `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/components/ai-assistant/artifact-body.tsx frontend/src/components/ai-assistant/chat-area.tsx`
    - Pass: `frontend/src/components/ai-assistant/artifact-body.tsx`
    - Existing unrelated warning: `frontend/src/components/ai-assistant/chat-area.tsx` popover project selector.
- Browser/API proof:
  - Authenticated `agent-browser --session-name alleato-test-3001` opened
    `http://localhost:3001/ai?session=ff743f27-f008-462c-8f50-1431c5171756`.
  - Sent follow-up: `The cost impact is about $18,000 and there is no schedule impact.`
  - Read
    `/api/ai-assistant/workspace?type=change_event_draft&status=draft&sessionId=ff743f27-f008-462c-8f50-1431c5171756&limit=1`.
  - API returned artifact `8ef14f5c-c597-4514-b6bd-e02d7cc211c7` with
    `artifact_type: change_event_draft`, `status: draft`, matching
    `session_id`, `readiness`, `workflow`, and structured `draft` content.
  - Reloaded the AI route and captured screenshot:
    `docs/ops/evidence/ai-change-event-artifact-persistence.png`.
- Linear closeout:
  - Posted implementation checkpoint comment to `AAI-961`.

## Failure Contract

- Cause: the first artifact implementation derived the draft from chat message
  data parts only, so the UI was persistent on screen but not independently
  persisted as artifact state.
- Detection gap: browser proof verified scroll persistence and reload from chat
  history, but not independent workflow artifact persistence.
- Prevention: store the Change Event draft as a versioned workspace artifact
  keyed by user/session/project/workflow type, then load that artifact state
  into the AI Assistant workspace.
