# Task: Drawing Annotation Object Editing

Status: In Progress
Owner: Codex S138
Created: 2026-07-13
Task ID: AAI-1059
Linear Issue: AAI-1059 — https://linear.app/megankharrison/issue/AAI-1059/make-drawing-annotations-selectable-resizable-movable-and-deletable
Related Handoff: `docs/ops/handoffs/2026-07-13-S138-drawing-annotation-object-editing.md`

## Objective

Make rectangle and cloud drawing annotations behave as editable objects: select, highlight, move, resize, persist, reload, and delete from the canonical drawing viewer.

## Scope

- Own shared annotation-object interaction in `frontend/src/components/drawings/PdfjsExpressMarkupOverlay.tsx`, the PDF.js lifecycle boundary in `PdfjsExpressDrawingViewer.tsx`, and focused tests.
- Reuse the existing drawing annotation PATCH/DELETE API and persisted percentage-coordinate contract.
- Cover rectangle and cloud move/resize first; preserve appropriate selection/delete behavior for other persisted annotation types.
- Exclude Velt drawing comments and site-header feedback comments; those remain separate collaboration workflows.

## Source of Truth

- Canonical runtime/data owner: PDF.js Express drawing viewer plus `drawing_annotations` API/table.
- Existing shared primitives/services: `frontend/src/components/drawings/PdfjsExpressMarkupOverlay.tsx`, `frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx`, `frontend/src/app/api/projects/[projectId]/drawings/[drawingId]/annotations/[annotationId]/route.ts`.
- Deprecated or parallel paths: `OsdDrawingViewer.tsx` is not the canonical route owner for this interaction.

## Attention Brief

- Primary user: project team member reviewing and correcting drawing markups.
- Primary job: adjust or remove an existing annotation without recreating it.
- Primary decision: which object is active and whether to move, resize, or delete it.
- Tier 1: drawing, selected object, selection outline, resize handles.
- Hidden until requested: transform handles and delete affordance remain absent until an object is selected.
- Removal candidates: no new persistent toolbar, inspector card, helper panel, or duplicate controls.
- Failure-loudly behavior: failed persistence restores the prior geometry, retains selection, and surfaces the exact action that failed.

## Workflow Map

| Stage | Owner | Contract |
| --- | --- | --- |
| Select object | `PdfjsExpressMarkupOverlay` | Select mode activates one persisted annotation and shows a quiet selection state. |
| Move/resize draft | shared overlay pointer interaction | Pointer capture updates a local percentage-coordinate transform without losing the active object. |
| Persist transform | annotation `PATCH` route | Updated `data.start`/`data.end` is stored for the same annotation ID. |
| Delete | keyboard or selected-state action → annotation `DELETE` route | Annotation is removed locally and remotely; failure restores it. |
| Reload proof | canonical viewer GET path | Persisted geometry is rendered at the updated location and size. |

## Acceptance Criteria

- [ ] Requested behavior is observable end to end: select, resize, move, reload, and delete.
- [x] Rectangle and cloud annotations expose understandable resize handles only when selected.
- [x] Delete and Backspace work without deleting while a text field is active.
- [x] Failed transform or delete requests restore the previous annotation and show a specific error.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are explicitly excluded.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared overlay abstraction owns selection and transform behavior.
- [x] Errors are specific and actionable.
- [x] Existing API authentication, permission, and data-shape contracts remain enforced.

## Integration and Verification

- [x] Focused annotation interaction tests pass.
- [x] Targeted lint checks pass; focused Jest compiles the touched TypeScript through ts-jest.
- [ ] Actual browser flow proves select → resize/move → reload → delete on the named viewer route.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: action-specific toast such as “Could not resize annotation” or “Could not delete annotation.”
- Detection path: focused unit test plus exact-route browser flow and network/readback evidence.
- Recovery path: restore the last persisted geometry or deleted annotation, keep it selected, and allow retry.

## Incident Learning

- Failure fingerprint: `frontend.viewer-capability-regression`
- Root cause: the custom annotation overlay implemented creation and visual selection without a complete editable-object interaction contract.
- Detection gap: viewer verification covered annotation creation/persistence but did not require selection, transform, reload, and deletion as one user journey.
- Prevention: focused interaction tests plus a rerunnable browser contract for the complete object-editing journey.
- Guardrail evidence: `node scripts/ops/learning-registry.mjs lookup --symptom "drawing annotations cannot be selected resized moved or deleted" --files 'frontend/src/components/drawings/PdfjsExpressMarkupOverlay.tsx' 'frontend/src/app/api/projects/[projectId]/drawings/[drawingId]/annotations/[annotationId]/route.ts'` matched the canonical viewer regression fingerprint.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file + AAI-1059 | Pass | Scope and done gate captured before implementation. |
| Recurring-failure lookup | `node scripts/ops/learning-registry.mjs lookup ...` | Pass | Matched `frontend.viewer-capability-regression`. |
| Focused regression tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath ...cleanup... ...object-editing... ...text-edit... ...undo...` | Pass | 4 suites, 10 tests covering selection, resize, move, delete, rollback, text, undo, Strict Mode vendor startup, safe cleanup, and fail-loud initialization. |
| Targeted lint | `cd frontend && npx eslint` on the two drawing owners and focused tests | Pass | No findings. |
| Changed-file type debt gate | `cd frontend && npm run typecheck:changed` | Pass | No new `any` debt. Full high-heap typecheck confirmed the overlay/tests clean; a minimal PDF.js Express declaration now types the touched vendor boundary. |
| Browser diagnosis | Authenticated Playwright on project 67 plus `agent-browser` | In progress | Proved and fixed Agentation DOM interference, direct-child cleanup assumption, Strict Mode double-start, and hidden non-Error vendor failures. Final uncontended lifecycle run waits for the separate S139 viewer suite to release the shared dev server. |

## Remaining Risk

- Exact-route reload/deletion browser proof remains pending because a separate three-test viewer capability run is occupying the shared dev server; percentage-coordinate behavior and vendor lifecycle guardrails are covered by focused tests.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is linked.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
