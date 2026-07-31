# Task: Drawings Viewer Controls Follow-Up

Status: Completed
Owner: Codex
Created: 2026-07-13
Linear Issue: Blocked - Linear connector reauthentication is required (`oauth_token_invalid_grant` from the prior drawings task).

## Objective

Fix the drawing viewer follow-up defects reported on
`/[projectId]/drawings/viewer/[drawingId]`: zoom in, zoom out, and rotate controls
must work, and the left vertical sidebar must not duplicate Activity or Links
because those panels already live in the top viewer header.

## Done Checklist

- [x] Existing control wiring is inspected before changing the viewer.
- [x] Zoom in and zoom out call a supported PDF.js Express API path and fail loudly if unavailable.
- [x] Rotate left and rotate right call a supported PDF.js Express API path and refresh overlay geometry.
- [x] Activity and Links are removed from the left rail without removing annotation tools.
- [x] Link creation remains available from the top Links flow instead of the left rail.
- [x] Targeted lint/type checks pass for changed files.
- [x] Browser proof is captured for rail cleanup and working zoom/rotate controls.
- [x] Noise gate closeout records what was removed or simplified, remaining risk, and the regression guardrail.

## Evidence

| Check | Artifact / Command | Result | Notes |
| --- | --- | --- | --- |
| Targeted lint | `pnpm --dir frontend exec eslint 'src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx' 'src/components/drawings/PdfjsExpressDrawingViewer.tsx' 'src/components/drawings/DrawingLinksPanel.tsx'` | Passed | No errors or warnings. |
| Changed-file type guard | `pnpm --dir frontend run typecheck:changed` | Passed | No new `any` type debt detected. |
| Rail cleanup | `docs/ops/evidence/2026-07-13-drawings-viewer-controls-followup/01-rail-cleaned.png` | Passed | Left rail shows annotation tools plus zoom/rotate only; Links and Comments remain in top header. |
| Zoom in | `docs/ops/evidence/2026-07-13-drawings-viewer-controls-followup/02-after-zoom-in.png` | Passed | Canvas measured `937x669` before zoom and `1124x803` after zoom in. |
| Zoom out | `docs/ops/evidence/2026-07-13-drawings-viewer-controls-followup/03-after-zoom-out.png` | Passed | Canvas returned to `937x669` after zoom out. |
| Rotate right | `docs/ops/evidence/2026-07-13-drawings-viewer-controls-followup/04-after-rotate-right.png` | Passed | Page container measured `669x937` after rotate right. |
| Rotate left | `docs/ops/evidence/2026-07-13-drawings-viewer-controls-followup/05-after-rotate-left-restored.png` | Passed | Page container returned to `937x669` after rotate left. |
| Top Links add action | `docs/ops/evidence/2026-07-13-drawings-viewer-controls-followup/06-links-panel-add-link.png` and `07-add-link-placement-mode.png` | Passed | Top Links panel exposes `Add link`; clicking it closes the panel and enters click-to-place mode. |
| Surface complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs 'frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx' frontend/src/components/drawings/DrawingLinksPanel.tsx frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx` | Passed | No noise-gate complexity violations. |

## Noise Gate Closeout

- Primary user: project staff reviewing drawings.
- Primary job: navigate, zoom, rotate, annotate, and link without duplicated controls.
- Tier 1 content: drawing canvas, annotation rail, top header panels, contextual links panel actions.
- Removed/simplified: duplicate Activity and Links entries are removed from the left rail.
- Failure-loud behavior: missing vendor zoom/rotation APIs now emit specific console errors instead of silent no-ops.
- Remaining risk: full project typecheck was not rerun for this focused follow-up; prior full `tsc` still needs a higher-heap pass.
- Regression guardrail: targeted lint, changed-file type guard, surface-complexity audit, and browser screenshots with measured zoom/rotate dimensions.
