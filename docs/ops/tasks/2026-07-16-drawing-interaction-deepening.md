# Task: Deepen canonical Drawing interaction module

Status: In Progress
Owner: Codex / S163
Created: 2026-07-16
Task ID: AAI-1122
Linear Issue: [AAI-1122](https://linear.app/megankharrison/issue/AAI-1122/deepen-canonical-drawing-interaction-module)
Related Handoff: `docs/ops/handoffs/2026-07-16-S163-drawing-interaction-deepening.md`

## Objective

Make the canonical drawing viewer's canvas behavior observable through one deep Drawing interaction module while preserving existing user behavior end to end.

## Scope

- Own the canonical drawing viewer route, `PdfjsExpressDrawingViewer`, `PdfjsExpressMarkupOverlay`, their focused tests, and task-owned verification artifacts.
- Move canvas tool/color/filter state, viewport behavior, annotation persistence, undo, pin selection, and link placement behind one module.
- Keep drawing identity in the canonical route adapter; the workspace owns the existing viewer and side-panel composition.
- Exclude `viewer-v2`, `viewer-v3`, migration/schema changes, and unrelated Velt comment work.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx` plus the canonical PDF.js Express viewer and annotation routes.
- Existing shared primitives/services: `frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx`, `frontend/src/components/drawings/PdfjsExpressMarkupOverlay.tsx`, `frontend/src/lib/api-client.ts`, and drawing annotation endpoints.
- Deprecated or parallel paths: `viewer-v2` and `viewer-v3` are excluded.

Verification contract: Required

## Acceptance Criteria

- [ ] The canonical route crosses one Drawing interaction seam rather than forwarding canvas state through route, viewer, and overlay.
- [ ] Pan, wheel zoom, toolbar zoom, rotation, tool selection, markup color, filter visibility, annotation edit/delete, undo, pin selection, and link placement retain their current observable behavior.
- [ ] Annotation persistence is owned internally with a production HTTP adapter and an in-memory test adapter.
- [ ] The route receives semantic interaction intent, not imperative viewer controls or a long callback list.
- [ ] A failed annotation read/write is specific, actionable, and visibly recoverable; no state silently disappears.
- [ ] Desktop, tablet, and mobile canonical-route evidence proves the requested outcome.
- [ ] Independent functional, visual, and evidence review is recorded before closure.

## Implementation Checklist

- [x] Record the current interaction contract in focused tests before moving behavior.
- [x] List each existing caller input and classify it as route context, internal canvas state, or semantic intent.
- [x] Create the canonical Drawing interaction workspace at `frontend/src/components/drawings/DrawingInteractionWorkspace.tsx`.
- [x] Migrate the canonical route to a two-field adapter (`projectId`, `drawingId`) with no parallel route path.
- [x] Add the internal persistence seam and in-memory adapter without changing the existing persisted annotation contract.
- [x] Remove replaced route-level forwarding props and imperative handles.
- [x] Add a regression guardrail for a route-to-canvas behavior leak.
- [x] Replace indefinite drawing-load state with a bounded, retryable failure state.

## Integration and Verification

- [x] Verification manifest records the required end-to-end claims at `scripts/verification/fixtures/drawing-interaction-deepening-manifest.json`.
- [x] Baseline focused unit checks pass (3 suites, 9 tests).
- [x] Targeted static and focused unit checks pass after implementation.
- [ ] Fresh browser flow proves create, persist, reload, edit/delete, undo, pin selection, link placement, pan/zoom, and rotation.
- [x] Failure-path browser proof records a specific failed-save state and recovery.
- [ ] Evidence artifacts and verification manifest/result are recorded.
- [ ] Screenshot evidence is attached to the AAI-1122 Linear comment.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a canvas-level failed read/write state or drawing-load state naming the operation and allowing retry.
- Detection path: focused module tests, canonical-route browser flow, persisted annotation readback, request/error evidence, and HMR/runtime lifecycle evidence for browser harnesses.
- Recovery path: remove the unpersisted canvas object to keep the server authoritative while offering a Retry action that reuses the intended annotation payload; re-run failed annotation reads or drawing queries in place.

## Interaction Ownership Map

| Input / behavior | Owner after extraction | Boundary classification |
| --- | --- | --- |
| `projectId`, `drawingId` | Canonical route adapter | Route context |
| Tool, color, filter, selected pin, side panel, viewer ref, page/viewport state | `DrawingInteractionWorkspace` and its viewer internals | Internal canvas state |
| Pin selection and link placement | Workspace callbacks to existing pin/link workflows | Semantic interaction intent |
| Annotation HTTP reads/writes | `DrawingAnnotationStore` behind the overlay | Persistence boundary |

The route no longer forwards viewer callbacks or an imperative handle. The viewer-to-overlay details remain internal to the sole workspace consumer; reshaping that local interface without a second consumer would add an abstraction without a real seam.

## Incident Learning

- Failure fingerprint: `frontend.viewer-capability-regression`
- Root cause: interaction choreography and persistence leak across the canonical route, vendor viewer, and markup overlay.
- Detection gap: focused tests exercise helpers and internals without one route-to-canvas interaction seam.
- Prevention: module-level interaction contract plus canonical browser contract and failure-state evidence.
- Guardrail evidence: pending implementation.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, ownership, and done gate captured before product-code edits. |
| Prior ownership | S127/S138/S139/S150 handoffs | Consolidated | Prior changes and evidence are inputs; AAI-1122 owns the follow-on seam. |
| Baseline interaction checks | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/components/drawings/__tests__/PdfjsExpressDrawingViewer.cleanup.unit.test.tsx src/components/drawings/__tests__/PdfjsExpressMarkupOverlay.undo.unit.test.tsx src/components/drawings/__tests__/PdfjsExpressMarkupOverlay.pan-propagation.unit.test.tsx` | Pass | 3 suites, 9 tests. |
| Route adapter contract | `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/__tests__/page.test.tsx` | Pass | Route passes only project and drawing context to the canonical workspace. |
| Route, canvas, and persistence regression checks | Scoped ESLint + Jest + `typecheck:changed` + `git diff --check` | Pass | Final checkpoint: 8 suites / 31 tests; no new `any` debt and no whitespace errors. |
| Annotation read/write recovery | `PdfjsExpressMarkupOverlay.object-editing.unit.test.tsx` | Pass | Failed saved-markup hydration and failed new-annotation save both expose a Retry action using the existing persistence contract. |
| Drawing-load failure guardrail | `DrawingInteractionWorkspace.load-timeout.unit.test.tsx` | Pass | After 20 seconds of unresolved drawing loading, the canonical workspace names the problem, confirms no changes were modified, and refetches only the drawing query through `ErrorState`’s retry action. |
| Canonical browser route | `agent-browser open http://localhost:3000/67/drawings/viewer/6b720f54-3376-4b94-a913-eb593698c2b2` | Blocked | Browser session redirected to `https://projects.alleatogroup.com/auth/login` for an unrelated production callback; no screenshot is treated as route evidence. |
| Canonical capability contract | `pnpm exec playwright test --config=config/playwright/playwright.config.drawings-capability.ts --grep "header navigation reaches adjacent drawings and the drawings register"` | Blocked by shared dev runtime | Trace proves the first navigation loaded the title and completed previous-drawing navigation. Under repeated HMR/full reload activity, the next fresh context never issued another drawing detail/list query and timed out at “Loading drawing…”. Server logs record an aborted malformed annotation request, forced full reload, and memory-threshold restart. First failing boundary: shared Next dev HMR → client hydration/query initiation, not Drawing API → workspace. Artifacts: `frontend/tests/test-results/drawings-capability/artifacts/drawings-viewer-capability-1d246-s-and-the-drawings-register-chromium/{test-failed-1.png,test-failed-2.png,trace.zip}`. |
| Isolated canonical header contract | `PLAYWRIGHT_BASE_URL=http://localhost:3105 pnpm exec playwright test --config=config/playwright/playwright.config.drawings-capability.ts --grep "header navigation reaches adjacent drawings and the drawings register"` | Pass | 1 test passed in 59.8s on a disposable runtime with an isolated cache and freshly verified localhost auth. Previous/next drawing, drawings register, and close navigation all passed. This is valid functional proof but not screenshot evidence. |
| Isolated drawing-load recovery | `drawing-viewer-load-retry.png` | Pass | A browser run aborted the first canonical drawing-detail request. The route showed “Failed to load drawing” with “Try again”; after the interception was removed, retry restored `A050 - Architectural Site Plan`. |
| Isolated persisted annotation flow | `PLAYWRIGHT_BASE_URL=http://localhost:3105 pnpm exec playwright test e2e/drawings/pdfjs-express-annotations.spec.ts --project=chromium --no-deps --config=config/playwright/playwright.config.ts --grep "persists, restores"` | Pass | 1 test passed in 16.9s: created a rectangle, received persisted success, reloaded and restored it, filtered it, erased it, and cleaned the exact test annotation. Screenshot proves the restored state. |
| Isolated annotation-save retry | `PLAYWRIGHT_BASE_URL=http://localhost:3105 pnpm exec playwright test e2e/drawings/pdfjs-express-annotations.spec.ts --project=chromium --no-deps --config=config/playwright/playwright.config.ts --grep "retries a failed initial rectangle save"` | Pass | 1 test passed in 16.0s: a scoped first POST returned 503; the existing “Markup could not be saved” toast exposed Retry, retry persisted the rectangle, reload restored it, and the test awaited erase cleanup. |
| Isolated annotation Undo | `PLAYWRIGHT_BASE_URL=http://localhost:3105 pnpm exec playwright test e2e/drawings/pdfjs-express-annotations.spec.ts --project=chromium --no-deps --config=config/playwright/playwright.config.ts --grep "undo removes"` | Pass | 1 test passed in 9.0s: a persisted rectangle enabled the existing Undo action; Undo issued the exact DELETE and removed the SVG annotation. |
| Isolated canvas controls | `PLAYWRIGHT_BASE_URL=http://localhost:3105 pnpm exec playwright test --config=config/playwright/playwright.config.drawings-capability.ts --grep "retained controls|zoom, rotation"` | Pass | 2 tests passed in 32.9s: link-placement modal state, retained navigation controls, wheel/button zoom, rotation, and responsive usability. |
| Isolated linked-record pin preview | `PLAYWRIGHT_BASE_URL=http://localhost:3105 pnpm exec playwright test e2e/drawings/drawings-viewer-capability-contract.spec.ts --config=config/playwright/playwright.config.drawings-capability.ts --grep "a rendered pin opens"` | Pass | 1 test passed in 6.9s. A route-fixtured document pin opened its linked-record preview with the expected title and description, then closed through the dialog footer. |
| Canonical visual evidence | `docs/ops/evidence/2026-07-16-drawing-interaction-deepening/{drawing-viewer-desktop,drawing-viewer-tablet,drawing-viewer-mobile}.png` | Pass | Isolated runtime captures show the canonical A050 route, toolbar, and rendered sheet at 1440×900, 768×1024, and 375×812. Visual review found no overlap or new product noise. Existing PDF.js Express watermarks remain a vendor-license artifact. |

## Remaining Risk

- Vendor PDF.js Express lifecycle and the viewer-to-overlay interface are retained inside the workspace; do not introduce a second production adapter without a real variation.
- Existing drawing route edits are dirty and must be preserved until their provenance is classified.
- Shared-runtime browser evidence remains invalid under HMR/full reload pressure; the isolated runtime proved header navigation, responsive rendering, drawing-load recovery, persisted rectangle creation/reload/filter/erase, failed-save Retry recovery, Undo, link-placement modal state, zoom, rotation, and linked-record pin preview. The remaining browser coverage still needs a free-space pan gesture.
- Rejected interim shape: a provider that leaves the route rendering canvas controls and side-panel consumers only moves the same broad interface. The workspace now owns that composition; further prop reshaping must be driven by a concrete second consumer, not cosmetic interface reduction.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
