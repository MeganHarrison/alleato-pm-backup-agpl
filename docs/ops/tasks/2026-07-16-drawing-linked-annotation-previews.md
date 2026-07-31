# Task: Show linked drawing annotation details and record previews

Status: In Progress
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1100
Linear Issue: [AAI-1100](https://linear.app/megankharrison/issue/AAI-1100/show-linked-drawing-annotation-details-and-record-previews)
Related Handoff: N/A, single-session task

## Objective

Every linked-record annotation on the canonical drawings viewer identifies its record on hover, opens a focused preview on click, and offers an explicit route to the canonical record page.

## Scope

- Canonical drawing viewer linked-record pins and shared linked-record preview behavior.
- Preserve existing photo preview/lightbox and drawing-markup editing behavior.
- Excludes changes to link persistence, record schemas, and unrelated annotation styles.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx` and `frontend/src/components/drawings/PdfjsExpressMarkupOverlay.tsx`.
- Existing shared primitives/services: `DrawingLinksPanel.tsx`, `DrawingPhotoPreview.tsx`, and `punch-item-preview-dialog.tsx`.
- Deprecated or parallel paths: `viewer-v3` is not the requested production route.

Verification contract: Required

## Acceptance Criteria

- [ ] A linked annotation shows concise identifying details on hover.
- [ ] Clicking a linked annotation opens a record-detail modal.
- [ ] The modal supplies one explicit route to the linked RFI, punch list, document, or other supported record.
- [ ] Missing or unsupported linked records fail loudly with useful recovery guidance.
- [ ] Existing photo-pin and markup-selection behavior remains intact.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared linked-record preview behavior owns cross-cutting canvas pin behavior.
- [x] Errors are specific and actionable.
- [ ] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a linked record cannot be resolved for preview.
- Detection path: annotation hover/click state and focused regression test.
- Recovery path: clear unavailable-record message with a route action when the record link remains navigable.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: Linked-record pins expose only a generated number at the canvas layer, despite richer record data already being available through the drawing links surface.
- Detection gap: The existing preview contract covered photos and a sidebar punch-item preview, but not direct canvas interaction for all linked-record types.
- Prevention: Centralize linked-record summary and preview resolution for both canvas pins and sidebar rows, with focused regression coverage.
- Guardrail evidence: Targeted linked-record interaction tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Live symptom | `agent-browser` production route readback | Observed | Authenticated customer screenshot shows bare `#1` pin; available browser session redirects to login. |
| Focused unit | `cd frontend && npx jest --runInBand --runTestsByPath src/components/drawings/__tests__/DrawingLinkedRecordPreviewDialog.test.tsx` | Pass | Summary and explicit RFI CTA contract. |
| Lint | focused ESLint over changed drawing files | Pass | No errors or warnings. |
| Typecheck | `cd frontend && npm run typecheck` | Pass | Independent verification sub-agent; no current-task errors. |

## Remaining Risk

- Production browser verification requires an authenticated session for project `1142`; code-level and accessible local verification will be recorded separately if unavailable.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
