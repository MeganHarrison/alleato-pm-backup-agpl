# Change Event Workflow Intake Card

Date: 2026-07-06
Linear: AAI-951
Status: Complete

## Objective

Add the first implementation slice for the conversational Change Event
Assistant: a live intake draft/checklist widget that appears before the final
`createChangeEvent` review form.

## Scope

- Add a shared change-event draft/checklist model for assistant widgets.
- Generate a `change_event_workflow` widget for change-event write prompts.
- Render a quiet live draft/checklist card in the AI Assistant chat.
- Preserve the existing `createChangeEvent` final review form.
- Add focused test coverage and command evidence.

## Out Of Scope

- Server-persisted multi-turn workflow state.
- Retrieval-backed related record suggestions.
- Post-create next-action automation.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Add shared draft/checklist model.
- [x] Replace generic change-event preview widget generation with workflow widget generation.
- [x] Render the workflow widget in chat.
- [x] Add focused tests.
- [x] Run focused checks.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-951`.
- Linear closeout comment: `c2b16e07-ca58-4714-a9ae-6d5eea0b8c06`.
- Added `frontend/src/lib/ai/change-event-workflow.ts` with a conservative
  live-draft model, checklist, next-question, missing-risk, and final-preview
  prompt contract.
- `buildAssistantWidgetsFromPrompt` now generates `change_event_workflow` for
  change-event prompts instead of the generic `project_action_preview`.
- `AssistantWidgetRenderer` now renders `change_event_workflow` with live intake
  fields, checklist status, missing risks, and guarded final-preview action.
- Existing `createChangeEvent` final review form remains the confirmed write
  path.
- `cd frontend && npx jest src/lib/ai/__tests__/change-event-workflow.test.ts src/lib/ai/__tests__/assistant-widgets.test.ts --runInBand`
  passed.
- `cd frontend && npx eslint src/lib/ai/change-event-workflow.ts src/lib/ai/assistant-widgets.ts src/components/ai-assistant/assistant-widget-renderer.tsx src/lib/ai/__tests__/change-event-workflow.test.ts src/lib/ai/__tests__/assistant-widgets.test.ts`
  passed with one pre-existing warning in
  `assistant-widget-renderer.tsx:884` about a raw search `Input`.
- `cd frontend && npm run typecheck:changed` passed.
- `npm run check:routes` passed.
- `npx markdownlint-cli2 --no-globs docs/ops/tasks/2026-07-06-change-event-workflow-intake-card.md`
  passed.
- Browser verification attempted with `agent-browser open
  http://localhost:3001/ai`; the automation browser landed on
  `/auth/login?callbackUrl=%2Fai`. Saved profile `alleato-test-3001` also
  landed on the login form, so visual proof is blocked by automation auth rather
  than the route.

## Failure Contract

- Cause: change-event prompts currently generate a generic action preview, so
  the chat surface jumps too quickly toward form fields instead of guiding PMs
  through what happened, cause, cost, schedule, support, and review readiness.
- Detection gap: the assistant UI had no separate live workflow state to show
  what was understood, what was missing, and why the final review form was not
  ready yet.
- Prevention: generate and render a dedicated workflow widget with checklist
  status, inferred draft values, missing information, and a guarded final
  preview prompt.
