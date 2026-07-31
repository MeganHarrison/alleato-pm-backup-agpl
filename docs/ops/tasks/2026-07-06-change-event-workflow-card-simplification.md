# Change Event Workflow Card Simplification

Date: 2026-07-06
Linear: [AAI-956](https://linear.app/megankharrison/issue/AAI-956/reduce-cognitive-load-in-change-event-assistant-workflow-card)
Status: Complete

## Objective

Reduce cognitive load in the AI Assistant change-event workflow card by making
the default state focused on the next user action and moving diagnostic detail
behind progressive disclosure.

## Scope

- Simplify the default `change_event_workflow` card in chat.
- Remove the large warning/checklist stack from the initial view.
- Show one primary next question/action first.
- Hide draft fields, checklist, missing risks, and related evidence behind
  compact disclosure controls.
- Keep existing workflow metadata, retrieval evidence, and `createChangeEvent`
  ownership unchanged.
- Rank reusable project-context picker options by recent activity when activity
  data is available.

## Out Of Scope

- Backend workflow behavior changes.
- Retrieval/planner changes.
- Eve or Deep Agent ownership changes.
- New database schema or migrations.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Simplify default card hierarchy.
- [x] Add progressive disclosure for details/evidence.
- [x] Add project-context prerequisite card before change-event detail intake.
- [x] Run focused design/code checks.
- [x] Attempt browser visual verification.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-956`.
- Linear closeout comment: `5ea46b09-adf5-48c2-97cd-c643266ebdfb`.
- Changed the missing-project flow so the assistant first asks which project to
  use and displays a reusable `project_picker` widget instead of showing the
  change-event workflow details too early.
- Added `actionLabel` to `ProjectPickerWidgetPayload` so the same picker can
  say `Use project` for context selection while preserving queue-generation
  usage elsewhere.
- Replaced the `project_picker` searchable popover with a short direct project
  list, so the picker passes the surface-complexity budget and does not behave
  like a mini page.
- Updated the reusable `project_picker` to show the most active projects first
  and keep the remaining project options behind a compact dropdown.
- Ranked default project picker results from `project_activity_view` using open
  tasks, meeting count, and recent activity, with a fallback to active projects
  when activity data is unavailable.
- Added project-context parsing in `buildChangeEventWorkflowDraft` so a picker
  follow-up containing `Project ID` and `Project Name` continues the same
  workflow.
- Rendered `project_picker` as a trailing assistant widget so the assistant
  sentence appears before the card, and disabled the streaming caret for that
  completed guided-selection response.
- Added `change_event_workflow` to chat text suppression so the workflow card
  owns its response without duplicate text.
- Simplified `ChangeEventWorkflowWidget` default hierarchy to one status line,
  one next question, primary actions, and disclosure controls for details and
  sources.
- `cd frontend && npx jest src/lib/ai/__tests__/assistant-widgets.test.ts src/lib/ai/__tests__/change-event-workflow.test.ts --runInBand`
  passed with 14 tests.
- `cd frontend && npx eslint src/components/ai-assistant/assistant-widget-renderer.tsx src/components/ai-assistant/chat-area.tsx src/app/api/ai-assistant/chat/handler-v2.ts src/lib/ai/change-event-workflow.ts src/lib/ai/assistant-widgets.ts src/lib/ai/__tests__/assistant-widgets.test.ts src/lib/ai/__tests__/change-event-workflow.test.ts`
  passed with one pre-existing warning at
  `frontend/src/components/ai-assistant/assistant-widget-renderer.tsx:1088`.
- `cd frontend && npm run typecheck:changed` passed.
- `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/ai-assistant/assistant-widget-renderer.tsx`
  passed.
- `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/ai-assistant/assistant-widget-renderer.tsx frontend/src/components/ai-assistant/chat-area.tsx`
  passed for `assistant-widget-renderer.tsx` and failed for an existing composer
  project-context popover search in `chat-area.tsx:1739`.
- `npx markdownlint-cli2 --no-globs docs/ops/tasks/2026-07-06-change-event-workflow-card-simplification.md`
  passed.
- Authenticated browser proof captured at
  `tmp/ai-card-proof/change-event-project-picker-most-active-dropdown.png`.
  The live `/ai` route shows the assistant sentence first, then a compact
  `project_picker` card with `Most active projects` and a `Choose another
  project` dropdown.
- Final authenticated browser proof captured at
  `tmp/ai-card-proof/change-event-project-picker-plain-header.png`. The picker
  header now uses only `Select Project` with no icon or eyebrow, and the
  description says which project is needed before creating the change event.
- Dropdown interaction proof captured at
  `tmp/ai-card-proof/change-event-project-picker-dropdown-open.png`.

## Failure Contract

- Cause: the previous card exposed internal workflow state, checklist rows,
  missing fields, warnings, and evidence as Tier 1 content.
- Detection gap: implementation checks validated data/state but did not include
  a cognitive-load gate for the live chat surface.
- Prevention: default the card to one next action, hide diagnostic detail until
  requested, and run the design-doctrine/noise-gate review for the changed UI.
