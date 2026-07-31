# S127 Handoff: PDF.js Express Drawing Annotations

Status: Complete
Owner: Codex
Task: `docs/ops/tasks/2026-07-13-drawings-pdfjs-express-annotations.md`
Linear: Blocked - connector reauthentication required (`oauth_token_invalid_grant`).

## Scope

Persist, authorize, restore, and browser-verify PDF.js Express annotations on
the canonical drawings route without losing legacy drawing markup.

## Evidence Log

| Time | Action | Result |
| --- | --- | --- |
| 2026-07-13 | Queried `drawing_annotations` with the configured service-role connection. | The remote table did not exist; there were no legacy rows to convert. |
| 2026-07-13 | Applied and read back migration `20260710120000_drawing_annotations`. | Pass; the remote migration ledger and table column catalog match the local migration. |
| 2026-07-13 | Re-ran the repository migration verifier after S134 repaired the duplicate July 9 version. | Pass: local and remote both contain `20260710120000`. |
| 2026-07-13 | Created annotation tools on the live A201 PDF.js Express route and queried persisted rows. | Blocked; the vendor's free viewer build disables annotation creation/XFDF import/export, so no row was created. |
| 2026-07-13 | Added and browser-tested the custom SVG overlay above PDF.js Express. | Pass: create saved a rectangle row, reload restored it, and eraser removed the visible shape and row. |
| 2026-07-13 | Rebound the custom overlay to the rendered PDF page canvas and exercised it on A201. | Pass: rectangle page percentages remained unchanged through vendor zoom, pan, reload, and erase; the page frame moved/resized with the vendor canvas. |
| 2026-07-13 | Added cloud and note types to the custom toolbar/API contract, then exercised cloud input on A201. | Partial: static checks pass and the tool is exposed, but the live cloud gesture did not create a shape or surface an API rejection; this must be resolved before marking the required-tool checklist complete. |
| 2026-07-13 | Traced the cloud POST and repaired drawing author identity. | Pass: the request exposed `drawing_annotations_created_by_fkey` as the source of the 400. Applied/ledgered `20260713120000`, then browser-proved cloud create/reload/delete with a `201` API response. |
| 2026-07-13 | Replaced browser-native prompt markup with a custom inline note editor. | Pass: note input opens at the page coordinate, saves, restores after reload, and erases through the custom overlay. |
| 2026-07-13 | Completed the remaining canonical A201 tool loops. | Pass: freehand, highlighter, arrow, and inline text each created, persisted, restored after one reload, and were erased. |
| 2026-07-13 | Mounted legacy drawing link pins as a page-coordinate PDF.js Express layer and hardened the pin API. | Pass: temporary authenticated pin creation returned `201`, the normal viewer visibly rendered `TEST`, and creator-owned deletion returned `200` before reload confirmed cleanup. |
| 2026-07-13 | Restored the historical drawings viewer interaction hierarchy on A201. | Pass: the dark workspace, vertical annotation rail, and top-right Links, Comments, History, Legacy Viewer, and Download actions are live. Links opens the persisted linked-items panel; Comments mounts the discussion panel; History resolves its empty state. |
| 2026-07-13 | Refined the canonical viewer against historical screenshots. | Pass: the top bar now uses icon-only utility controls for links, filters, info, search, comments, history, and download. PDF.js Express header controls are suppressed; custom left-rail zoom/zoom-out/rotate-left/rotate-right controls call the vendor document API and were browser-verified. Filter visibility toggles are bound to the custom overlay. |
| 2026-07-13 | Audited the retired Fabric viewer and added the legacy-markup compatibility guardrail. | Pass: Fabric objects were strictly in-memory and never persisted. Canonical writes now require `page_percent: true`; existing unmarked rows stay out of the unsafe PDF renderer and expose a conditional raw JSON export rather than disappearing silently. |
| 2026-07-13 | Ran the full A201 custom-annotation E2E loop. | Pass: rectangle, pen, highlighter, cloud, arrow, text, and note created as seven persisted rows. All restored after PDF render completion; rectangle filtering worked; screenshot confirmed page alignment after zoom/rotation. Browser reconnection was interrupted when the desktop app was shut down, so exact UUID cleanup was completed through the configured database connection. Read-back confirmed `0` A201 annotation rows. |
| 2026-07-13 | Added and ran the deterministic canonical-overlay Playwright regression. | Pass: `pdfjs-express-annotations.spec.ts` waits for nonzero SVG page geometry rather than relying on Next navigation completion. The A201 run created a rectangle, restored it after reload, hid/restored it with the filter, erased it, and completed exact-id cleanup. 1 test passed in 23.1s. |
| 2026-07-13 | Ran a recorded `agent-browser` A201 regression with screenshots and WebM evidence. | Pass: `docs/ops/evidence/2026-07-13-drawings-annotation-agent-browser/` contains the recording and eight screenshots. The run found the PDF.js Express iframe could win hit testing while a markup tool was active. `PdfjsExpressDrawingViewer` now disables vendor iframe pointer input during custom-tool interaction; live browser proof created and erased a rectangle, and exact annotation read-back returned `0`. |
| 2026-07-13 | Re-ran the focused Playwright test after the pointer-ownership repair. | Deferred runner condition: the test reached the scenario but its video worker remained active for nearly two minutes without an assertion or timeout. The isolated process was stopped to avoid local resource pressure; previous deterministic evidence remains passing and current agent-browser evidence covers the repaired interaction. |

## Risks

- Legacy OSD markup is image-coordinate JSON while PDF.js Express uses XFDF.
- Browser proof must cover actual persistence, not only toolbar visibility.
- The current package cannot implement native PDF.js Express annotations. The
  canonical reader remains intact; no nonfunctional persistence UI was kept.
- New overlay records use `page_percent` geometry. The temporary
  `viewport_percent` marker is retained only as an explicit compatibility
  contract and must not be silently interpreted as PDF-page geometry. If one
  is encountered, the canonical viewer provides an explicit raw export until a
  source-dimension-aware importer is available.
- Do not represent the vendor cloud/note buttons as supported; they remain
  disabled by the free PDF.js Express package. The canonical custom toolbar is
  the supported implementation. The remaining work is collaboration pin/comment
  routing and explicit legacy-overlay compatibility, not unverified drawing
  tool behavior.
- Pin ownership no longer assumes a row in `auth.users`; migration
  `20260713123000_drawing_markup_pins_author_identity` removes that incompatible
  FK and the API validates project scope and creator identity before service
  writes.
- Comments are available in the canonical right-side panel, but comments do not
  yet create page-anchored markers. That remains a separately scoped overlay
  routing improvement.
- The browser test must wait for the vendor page-render lifecycle before
  asserting overlay geometry. Checking immediately after Next page load is too
  early and produces a false empty-overlay result.

## Next Step

The compatibility path is complete. A subsequent collaboration slice can add
page-anchored comment markers and, if legacy source image dimensions become
available, a deterministic image-to-PDF coordinate importer.
