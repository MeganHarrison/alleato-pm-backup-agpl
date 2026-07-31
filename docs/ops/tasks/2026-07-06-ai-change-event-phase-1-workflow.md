# AI Change Event Phase 1 Workflow

Date: 2026-07-06
Linear: [AAI-959](https://linear.app/megankharrison/issue/AAI-959/implement-phase-1-ai-change-event-creation-workflow)
Status: Verification Complete

## Objective

Implement the first phase of the AI-assisted Change Event creation workflow in
the existing AI Assistant path, using the app's actual Change Event API,
validation rules, and UI patterns as source of truth.

## Scope

- Treat the external plan as functional intent only.
- Keep the workflow in AI Assistant / AI SDK chat, not Eve or Deep Agents.
- After project selection, ask for a natural-language event description before
  displaying change-event details.
- Build and update a live draft artifact from user responses.
- Ask only the next highest-value missing question.
- Gate final preview/creation on the real Change Event API requirements.
- Preserve explicit user confirmation before any database write.
- Keep line-item creation as a post-creation continuation, not a blocker for
  creating the Change Event draft record.
- Render the Change Event draft as a persistent artifact/workspace surface,
  not as the primary chat message card.

## Out Of Scope

- Eve implementation.
- Deep-agent implementation.
- Full related-record search/linking automation.
- Full conversational line-item creation after the Change Event is created.
- Database migrations unless the current schema proves insufficient.

## Current Repo Truth

- `change_events.project_id` is an integer and `change_events.id` is a UUID.
- The Change Event create API requires `title`, `type`, and `scope`; `status`
  defaults to `Open`, `origin` defaults to `Internal`, and `number` is generated
  server-side.
- Line items are separate records under `change_event_line_items` and can be
  added after the parent Change Event exists.
- Related records can be linked through the existing related-items endpoint
  after user confirmation.
- The existing `createChangeEvent` AI write tool already supports
  preview/confirmation behavior, but the guided workflow controls when it is
  allowed to run.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Normalize change-event workflow draft/readiness around real API
  requirements.
- [x] Make post-project-selection flow ask for the natural-language event
  description first.
- [x] Update the live artifact so it does not expose form/checklist details
  before there is a meaningful description.
- [x] Add or update tests for project selection, description intake, readiness,
  and final preview gating.
- [x] Add persistent editable Change Event draft artifact outside the chat
  message scroll.
- [x] Run focused lint/tests/type checks.
- [x] Browser-verify the `/ai` interaction with authenticated proof.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-959`.
- Linear closeout comment: `de17e574-0091-4974-90c8-84c15a1a7316`.
- Repo inspection confirmed the existing Change Event form/API contract:
  - `frontend/src/app/api/projects/[projectId]/change-events/validation.ts`
  - `frontend/src/app/(main)/[projectId]/change-events/new/page.tsx`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/related-items/route.ts`
- Focused Jest:
  - `cd frontend && npx jest src/lib/ai/__tests__/assistant-widgets.test.ts src/lib/ai/__tests__/change-event-workflow.test.ts --runInBand`
  - Result: 2 suites passed, 15 tests passed.
- Focused lint:
  - `cd frontend && npx eslint src/components/ai-assistant/chat-area.tsx src/components/ai-assistant/change-event-draft-artifact.tsx src/components/ai-assistant/assistant-widget-renderer.tsx src/app/api/ai-assistant/chat/handler-v2.ts src/lib/ai/change-event-workflow.ts src/lib/ai/__tests__/change-event-workflow.test.ts`
  - Result: 0 errors, 1 pre-existing warning in `assistant-widget-renderer.tsx`
    for an unrelated raw search input.
- Changed-file type debt:
  - `cd frontend && npm run typecheck:changed`
  - Result: no new `any` type debt.
- Route check:
  - `npm run check:routes`
  - Result: no route conflicts.
- Alleato UI audit:
  - `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/components/ai-assistant/change-event-draft-artifact.tsx frontend/src/components/ai-assistant/assistant-widget-renderer.tsx`
  - Result: pass.
  - `chat-area.tsx` full-surface audit still reports existing
    `popup-search-or-filter:L1759` in the composer project picker.
- Browser proof:
  - `tmp/ai-card-proof/artifact-project-picker.png`
  - `tmp/ai-card-proof/artifact-after-project-selection.png`
  - `tmp/ai-card-proof/artifact-final-layout-proof.png`
  - Verified: project picker stays in chat, Change Event draft renders in a
    persistent editable right-side artifact panel, create review stays disabled
    until required fields are available, and the composer no longer overlaps
    the artifact panel.

## Failure Contract

- Cause: prior assistant UI encoded the workflow as a chat card/wizard instead
  of a persistent draft workspace, and project-selection text could be treated
  like change-event narrative.
- Detection gap: prior checks validated widget rendering but did not prove the
  end-to-end guided intake sequence or whether the draft survived outside the
  chat scroll.
- Prevention: workflow state is explicit in the AI data part, the persistent
  artifact is derived from the latest workflow state, generic start/project
  selection messages are ignored as draft content, and focused tests cover those
  state transitions.
