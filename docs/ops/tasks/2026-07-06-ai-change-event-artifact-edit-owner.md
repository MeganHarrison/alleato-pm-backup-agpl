# AI Change Event Artifact Edit Owner

Date: 2026-07-06
Linear: [AAI-963](https://linear.app/megankharrison/issue/AAI-963/make-ai-change-event-artifact-the-editable-draft-owner)
Status: Complete

## Objective

Make the persistent Change Event artifact own editable draft state, so field
edits in the artifact panel are saved to `workspace_artifacts` and survive
reloads before the final native `createChangeEvent` preview/create flow.

## Scope

- Reuse the existing `change_event_draft` workspace artifact model.
- Add an authenticated API path for saving edits to the current session draft.
- Keep workflow metadata, readiness, checklist, confirm prompt, and draft
  fields consistent after artifact edits.
- Wire `ChangeEventDraftArtifact` so `Update draft` persists changes.
- Keep final record creation owned by the native `createChangeEvent` tool.

## Out Of Scope

- Eve implementation.
- Deep-agent implementation.
- Full line-item phase.
- New schema migration unless current artifact state cannot support editing.

## Current Repo Truth

- The previous slice persists `change_event_draft` rows in
  `workspace_artifacts`, keyed by user/session/status.
- `ChangeEventDraftArtifact` currently keeps edited field values in local React
  state and does not persist them.
- The AI Assistant still uses message data parts when present and persisted
  artifact state as a hydration fallback.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Add a shared helper to merge user edits into Change Event workflow
  artifact content.
- [x] Add an authenticated API route for updating the current session draft.
- [x] Wire `ChangeEventDraftArtifact` edit/save UX to the API route.
- [x] Refresh local artifact state after save and fail loudly on save errors.
- [x] Add focused tests for helper/API behavior.
- [x] Run focused lint/tests/type checks.
- [x] Browser-verify a field edit persists after reload.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-963`.
- Implemented edit ownership in:
  - `frontend/src/lib/ai/change-event-workflow.ts`
  - `frontend/src/lib/ai/services/workspace-artifact-service.ts`
  - `frontend/src/app/api/ai-assistant/workspace/route.ts`
  - `frontend/src/components/ai-assistant/change-event-draft-artifact.tsx`
  - `frontend/src/components/ai-assistant/chat-area.tsx`
- Focused tests:
  - `cd frontend && npx jest src/lib/ai/services/__tests__/workspace-artifact-service.test.ts src/lib/ai/__tests__/change-event-workflow.test.ts --runInBand`
    - Pass: 2 suites, 12 tests.
- Focused lint:
  - `cd frontend && npx eslint src/lib/ai/change-event-workflow.ts src/lib/ai/__tests__/change-event-workflow.test.ts src/lib/ai/services/workspace-artifact-service.ts src/lib/ai/services/__tests__/workspace-artifact-service.test.ts src/app/api/ai-assistant/workspace/route.ts src/components/ai-assistant/change-event-draft-artifact.tsx src/components/ai-assistant/chat-area.tsx`
    - Pass.
- Changed-file type debt:
  - `cd frontend && npm run typecheck:changed`
    - Pass: no new `any` type debt detected.
- Route check:
  - `npm run check:routes`
    - Pass: no route conflicts found.
- Product noise gate:
  - `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/components/ai-assistant/change-event-draft-artifact.tsx frontend/src/components/ai-assistant/chat-area.tsx`
    - Pass: `frontend/src/components/ai-assistant/change-event-draft-artifact.tsx`
    - Existing unrelated warning: `frontend/src/components/ai-assistant/chat-area.tsx` composer project-selector popover.
- Browser/API proof:
  - Started frontend on `http://localhost:3001`.
  - Authenticated `agent-browser --session-name alleato-test-3001` using local test auth.
  - Created/loaded session draft at
    `http://localhost:3001/ai?session=ff743f27-f008-462c-8f50-1431c5171756`.
  - Saved title edit from the artifact panel:
    `Owner requested restroom relocation - persisted edit`.
  - Read
    `/api/ai-assistant/workspace?type=change_event_draft&status=draft&sessionId=ff743f27-f008-462c-8f50-1431c5171756&limit=1`.
  - API returned artifact `5bd3853c-46d5-44d0-8259-841e29c0b7e6`,
    `version: 2`, title and `workflow.draft.title` equal to the edited value.
  - Reloaded AI route and captured visible artifact panel:
    `docs/ops/evidence/ai-change-event-artifact-edit-owner.png`.
- Linear closeout:
  - Posted implementation checkpoint comment and marked `AAI-963` Done.

## Failure Contract

- Cause: the artifact panel can display a persistent draft, but local edits are
  still component state until the next AI turn.
- Detection gap: prior browser proof verified artifact persistence from the AI
  handler, but not direct user edits from the artifact workspace.
- Prevention: route artifact field edits through an authenticated save endpoint
  that updates the versioned `change_event_draft` artifact and reloads it as
  source of truth.
