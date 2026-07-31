# Change Event Workflow Evidence Suggestions

Date: 2026-07-06
Linear: [AAI-954](https://linear.app/megankharrison/issue/AAI-954/add-retrieval-backed-evidence-suggestions-to-change-event-assistant)
Status: Complete

## Objective

Enrich the AI Assistant Change Event live intake workflow with compact related
evidence suggestions from the existing retrieval planner/executor path.

## Scope

- Reuse existing AI Assistant retrieval context; do not add a second related
  records system or direct table-query path.
- Convert semantic retrieval results into compact evidence suggestions on the
  persisted `change_event_workflow` metadata.
- Render the evidence suggestions in the existing chat workflow card.
- Record evidence counts/source path in workflow readiness/debug metadata.
- Keep `createChangeEvent` as the only write owner and final preview form path.

## Out Of Scope

- Eve ownership of change-event creation.
- Backend Deep Agent orchestration for this write workflow.
- New database schema, migrations, or new retrieval tables.
- Post-create automation.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Add related evidence model and extractor.
- [x] Wire existing retrieval results into workflow metadata.
- [x] Render related evidence in the workflow widget.
- [x] Add focused tests.
- [x] Run focused checks.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-954`.
- Linear closeout comment: `b05b1c94-a269-4347-8e06-421339872b9c`.
- Added `ChangeEventWorkflowEvidenceSuggestion` and
  `buildChangeEventRelatedEvidence` in
  `frontend/src/lib/ai/change-event-workflow.ts`.
- The `change_event_write` intake fast path now executes the existing retrieval
  plan before building/persisting the workflow metadata, converts semantic
  results into related evidence, and records `semantic_vector_search` in
  `tool_trace`, `source_debug`, and `retrieval_plan.sources`.
- `AssistantWidgetRenderer` now renders up to three related evidence suggestions
  in the live change-event intake card.
- `cd frontend && npx jest src/lib/ai/__tests__/change-event-workflow.test.ts src/lib/ai/__tests__/assistant-widgets.test.ts src/app/api/admin/ai-assistant-debug/__tests__/route.test.ts --runInBand`
  passed.
- `cd frontend && npx eslint src/lib/ai/change-event-workflow.ts src/lib/ai/assistant-widgets.ts src/lib/ai/__tests__/change-event-workflow.test.ts src/lib/ai/__tests__/assistant-widgets.test.ts src/app/api/ai-assistant/chat/handler-v2.ts src/components/ai-assistant/assistant-widget-renderer.tsx src/app/api/admin/ai-assistant-debug/route.ts 'src/app/(admin)/ai-assistant-debug/ai-assistant-debug-console-client.tsx' src/app/api/admin/ai-assistant-debug/__tests__/route.test.ts`
  passed with one pre-existing warning in
  `frontend/src/components/ai-assistant/assistant-widget-renderer.tsx:884`
  about a raw search `Input`.
- `cd frontend && npm run typecheck:changed` passed.
- `npm run check:routes` passed.
- `npx markdownlint-cli2 --no-globs docs/ops/tasks/2026-07-06-change-event-workflow-evidence-suggestions.md`
  passed.

## Failure Contract

- Cause: the live intake fast path persisted workflow state before the normal
  retrieval block executed, so the workflow knew form readiness but could not
  show which source records were considered.
- Detection gap: workflow metadata had no evidence count/source path separate
  from generic retrieval debug.
- Prevention: enrich the workflow metadata from the existing retrieval executor
  and expose evidence count/source path in readiness/debug state.
