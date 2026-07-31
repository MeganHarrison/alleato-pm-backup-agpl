# Change Event Workflow State And Debug

Date: 2026-07-06
Linear: AAI-952
Status: Complete

## Objective

Persist the Change Event Assistant live intake workflow state across assistant
turns and expose readiness/missing-state in the AI Assistant Debug Console.

## Scope

- Persist structured `change_event_workflow` metadata when the assistant emits
  the live change-event intake widget.
- Rehydrate/update the workflow draft from prior session metadata and the latest
  user message.
- Keep `createChangeEvent` as the only write owner and preserve preview-first
  confirmation.
- Surface workflow readiness and missing checklist in the debug console.
- Add focused tests and command evidence.

## Out Of Scope

- Retrieval-backed related-record search.
- Deep Agent evidence packets for change-event creation.
- Post-create next-action automation.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Add reusable workflow-state persistence/update helper.
- [x] Persist workflow state in assistant response metadata/data parts.
- [x] Show workflow state/readiness in debug API and debug console.
- [x] Add focused tests.
- [x] Run focused checks.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-952`.
- Linear closeout comment: `709fba1c-bc0a-41ba-ab4d-b1498d4627fa`.
- Added `buildChangeEventWorkflowMetadata` and prior-draft merge behavior in
  `frontend/src/lib/ai/change-event-workflow.ts`.
- Added deterministic `change_event_write` intake handling in
  `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`; it emits the live
  widget, persists `metadata.change_event_workflow`, and skips this fast path
  for final preview prompts so the `createChangeEvent` write tool can run.
- Added `changeEventWorkflow` to the AI Assistant Debug API projection and Flow
  tab.
- `cd frontend && npx jest src/lib/ai/__tests__/change-event-workflow.test.ts src/lib/ai/__tests__/assistant-widgets.test.ts src/app/api/admin/ai-assistant-debug/__tests__/route.test.ts --runInBand`
  passed.
- `cd frontend && npx eslint src/lib/ai/change-event-workflow.ts src/lib/ai/assistant-widgets.ts src/lib/ai/__tests__/change-event-workflow.test.ts src/lib/ai/__tests__/assistant-widgets.test.ts src/app/api/ai-assistant/chat/handler-v2.ts src/app/api/admin/ai-assistant-debug/route.ts 'src/app/(admin)/ai-assistant-debug/ai-assistant-debug-console-client.tsx' src/app/api/admin/ai-assistant-debug/__tests__/route.test.ts`
  passed.
- `cd frontend && npm run typecheck:changed` passed.
- `npm run check:routes` passed.
- `npx markdownlint-cli2 --no-globs docs/ops/tasks/2026-07-06-change-event-workflow-state-debug.md`
  passed.
- Browser verification attempted with `agent-browser open
  http://localhost:3001/ai-assistant-debug`; the automation browser reached the
  app but rendered `Access Denied` with reason `admin-dashboard-allowlist`, so
  visual debug-page proof is blocked by auth/allowlist for that browser user.

## Failure Contract

- Cause: the first live intake widget was generated from the current prompt
  only, so follow-up turns had no durable workflow state and the debug console
  could not explain whether the workflow was ready for `createChangeEvent`.
- Detection gap: `chat_history.metadata` did not include a normalized
  change-event workflow snapshot separate from generic data parts.
- Prevention: persist the workflow snapshot on the assistant turn, rehydrate it
  before building the next widget, and expose readiness/missing checklist in the
  debug console.
