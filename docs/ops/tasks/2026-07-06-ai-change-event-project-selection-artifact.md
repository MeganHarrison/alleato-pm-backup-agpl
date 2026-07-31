# AI Change Event Project Selection Artifact

Date: 2026-07-06
Linear: [AAI-970](https://linear.app/megankharrison/issue/AAI-970/persist-ai-change-event-project-selection-from-artifact-picker)
Status: Complete

## Objective

Make project selection update the persisted Change Event draft artifact directly,
so choosing a project resolves `projectId` / `projectName`, recomputes readiness,
and survives reload without requiring a chat follow-up.

## Scope

- Reuse the current `change_event_draft` artifact edit API and service helper.
- Add project edit support to the Change Event workflow merge helper.
- Wire the artifact panel project picker to persist project context.
- Keep final creation owned by the native `createChangeEvent` preview and
  confirmation path.
- Keep the project selection UI quiet and reusable for future project-scoped
  artifact workflows.

## Out Of Scope

- Eve implementation.
- Deep-agent implementation.
- Full line-item phase.
- New database migration unless current artifact state cannot support this.

## Current Repo Truth

- The artifact panel can now edit and persist title/narrative/type/scope/cost
  and schedule fields.
- Project context is still shown as text and the checklist remains active when
  project context is missing.
- The assistant already has a generative project picker widget, but that picker
  lives in chat and does not update the persistent artifact directly.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Add project fields to the Change Event artifact edit helper/schema.
- [x] Wire artifact project selection UI to persist project context.
- [x] Recompute readiness/checklist after project selection.
- [x] Add focused tests for project edit merge/persistence.
- [x] Run focused lint/tests/type/route checks.
- [x] Browser-verify project selection persists after reload.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-970`.
- Linear closeout comment: `34a9b87c-b459-4986-bce1-d116bcbf90f1`.
- Unit tests: `cd frontend && npx jest src/lib/ai/services/__tests__/workspace-artifact-service.test.ts src/lib/ai/__tests__/change-event-workflow.test.ts --runInBand` passed, 14 tests.
- Targeted lint: `cd frontend && npx eslint src/lib/ai/change-event-workflow.ts src/app/api/ai-assistant/workspace/route.ts src/components/ai-assistant/change-event-draft-artifact.tsx src/components/ai-assistant/chat-area.tsx src/lib/ai/__tests__/change-event-workflow.test.ts src/lib/ai/services/__tests__/workspace-artifact-service.test.ts` passed.
- Route check: `npm run check:routes` passed.
- Changed-file type guard: `cd frontend && npm run typecheck:changed` passed.
- Noise gate: `impeccable noise-gate ...` was unavailable in this shell (`command not found`); manual review against `.agents/skills/impeccable/reference/alleato-product-noise-gate.md` passed because the change adds one existing-form-control field inside the artifact and no wrapper card, duplicate CTA, decorative icon, helper panel, or secondary summary.
- Browser proof before selection: `docs/ops/evidence/ai-change-event-project-selection-before.png`.
- Browser proof after reload: `docs/ops/evidence/ai-change-event-project-selection-artifact.png`.
- Workspace API read-back after artifact project selection:
  `{"id":"5bd3853c-46d5-44d0-8259-841e29c0b7e6","version":3,"project_id":760,"draftProjectId":760,"draftProjectName":"Exol Wilmer","ready":true,"missing":["supporting_docs"]}`.

## Failure Contract

- Cause: project selection still depends on chat flow instead of artifact state.
- Detection gap: previous browser proof verified title edits, but the checklist
  could remain blocked at `Project selected` even when the user needs a direct
  picker.
- Prevention: make project selection a first-class artifact edit that saves to
  `workspace_artifacts`, recomputes workflow readiness, and renders from the
  persisted draft after reload.
