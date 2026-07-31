# Task: Drawings Viewer Markup And Link Parity

Status: Completed - targeted verification passed; full project typecheck deferred by repo heap OOM
Owner: Codex
Created: 2026-07-13
Linear Issue: Blocked - Linear connector reauthentication is required (`oauth_token_invalid_grant`).

## Objective

Repair the canonical drawings viewer at
`/[projectId]/drawings/viewer/[drawingId]` so it matches the historical viewer
workflow shown in the supplied screenshots: links can be created to RFIs,
documents, photos, and submittals; cloud markup looks like a professional
revision cloud; and cloud, highlight, text, and pen/freehand tools expose color
selection before drawing.

## Done Checklist

- [x] Current drawing viewer implementation and existing pin/link API contract are measured before edits.
- [x] A task-scoped link creation flow exists for RFIs, documents, photos, and submittals, or any unsupported backend path fails loudly with a specific message.
- [x] Link creation restores through the existing persisted drawing pin layer after reload.
- [x] Color selection is available for cloud, highlight, text, and pen/freehand without adding noisy always-visible panels.
- [x] Selected colors persist in saved annotation rows and restore after reload.
- [x] Cloud markup geometry is replaced with a cleaner revision-cloud path and remains aligned through zoom/reload.
- [x] Targeted lint/type checks pass for changed drawing viewer files.
- [x] Browser proof is captured on the canonical viewer route or a local equivalent using drawing `ef8708e3-b196-437f-8745-3696105fc8d9`.
- [x] Noise gate closeout records what was removed or simplified, remaining risk, and the regression guardrail.

## Evidence

| Check | Artifact / Command | Result | Notes |
| --- | --- | --- | --- |
| Linear tracking | `mcp__codex_apps__linear._save_issue` | Blocked | Connector returned `oauth_token_invalid_grant`; local task file owns definition of done until Linear is reauthenticated. |
| Impeccable preflight | `node .agents/skills/impeccable/scripts/load-context.mjs` plus Alleato noise-gate references | Passed | Historical screenshots supplied by user were used as visual target; no additional image generation required. |
| Targeted lint | `pnpm --dir frontend exec eslint 'src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx' 'src/components/drawings/PdfjsExpressDrawingViewer.tsx' 'src/components/drawings/PdfjsExpressMarkupOverlay.tsx' 'src/components/drawings/LinkPinModal.tsx' 'src/components/drawings/DrawingLinksPanel.tsx' 'src/hooks/use-drawing-pins.ts' 'src/hooks/use-drawings.ts' 'src/app/api/projects/[projectId]/drawings/[drawingId]/pins/route.ts'` | Passed with warnings | Four existing `components/ui/form` lint warnings remain in `LinkPinModal.tsx`; no errors. |
| Changed-file type guard | `pnpm --dir frontend run typecheck:changed` | Passed | No new `any` type debt reported. |
| Full project typecheck | `pnpm --dir frontend exec tsc --noEmit --pretty false` | Deferred | Cheap verification sub-agent hit Node heap OOM before diagnostics: `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`; not proven related to this task. |
| Surface complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs 'frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx' frontend/src/components/drawings/LinkPinModal.tsx frontend/src/components/drawings/DrawingLinksPanel.tsx` | Passed | No nested-card or wrapper-noise violations in touched drawing surfaces. |
| Viewer route after cache clear | `docs/ops/evidence/2026-07-13-drawings-viewer-markup-link-parity/03-after-cache-clear.png` | Passed | Local equivalent route loaded drawing `ef8708e3-b196-437f-8745-3696105fc8d9` after clearing stale `.next`. |
| Color controls and revision cloud | `docs/ops/evidence/2026-07-13-drawings-viewer-markup-link-parity/04-highlight-color-swatches.png` | Passed | Color swatches appear only for colorable markup tools; cloud path renders as a scalloped revision cloud. |
| Link tool placement | `docs/ops/evidence/2026-07-13-drawings-viewer-markup-link-parity/05-link-tool-selected.png` | Passed | Left rail has a real Link tool and a clear click-drawing state. |
| Link type coverage | `docs/ops/evidence/2026-07-13-drawings-viewer-markup-link-parity/06-link-modal.png` | Passed | Modal exposes RFI, Document, Photo, Submittal, Punch Item, Drawing Link, Coordination Issue, and Task. |
| Document selector | `docs/ops/evidence/2026-07-13-drawings-viewer-markup-link-parity/07-document-link-selector.png` | Passed | Existing project documents can be searched and selected before creating a document pin. |
| Submittal selector | `docs/ops/evidence/2026-07-13-drawings-viewer-markup-link-parity/08-submittal-link-selector.png` | Passed | Existing project submittals can be searched and selected before creating a submittal pin. |
| Persisted submittal pin | `docs/ops/evidence/2026-07-13-drawings-viewer-markup-link-parity/09-submittal-pin-created.png` | Passed | Created a temporary live submittal pin; header updated to `Links (1)` and link affordance opened in the side panel. |
| Verification cleanup | `docs/ops/evidence/2026-07-13-drawings-viewer-markup-link-parity/10-submittal-pin-cleaned-up.png` | Passed | Removed the temporary verification pin; header returned to `Links`. |

## Noise Gate Closeout

- Primary user: project staff reviewing drawings and attaching field context.
- Primary job: draw or link context directly at the drawing location without hunting through separate modules.
- Tier 1 content: drawing canvas, left rail tools, contextual color swatches, and links side panel.
- Removed/simplified: the left rail `Links` button now places a link pin; review stays in the top Links panel, avoiding duplicate side-panel CTAs.
- Failure-loud behavior: drawing load retries are disabled so API/auth failures surface instead of looping indefinitely; unsupported or incomplete link selections keep the create action disabled.
- Remaining risk: full project `tsc` could not complete in the verification sub-agent because the repo currently exhausts Node heap before emitting diagnostics.
- Regression guardrail: targeted ESLint, changed-file type guard, surface-complexity audit, and browser evidence cover the drawing viewer route and link workflow.

## Files Expected To Change

- `frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx`
- `frontend/src/components/drawings/PdfjsExpressMarkupOverlay.tsx`
- `frontend/src/components/drawings/LinkPinModal.tsx`
- `frontend/src/hooks/use-drawing-pins.ts`
- `frontend/src/app/api/projects/[projectId]/drawings/[drawingId]/pins/route.ts`
- `docs/ops/tasks/2026-07-13-drawings-viewer-markup-link-parity.md`
