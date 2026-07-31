# Drawings Tool and Annotation Feature Tracker

Status: Active
Owner: Codex / Product
Created: 2026-07-13
Primary route: `/67/drawings/viewer/0e486628-f210-4be4-bc1b-3eec20f0b44d`

## Purpose

This file is the working checklist for the Drawings viewer, markup, comments, and linked-item workflow. A feature is not complete until its status is `Verified` with evidence.

## Status Legend

| Status | Meaning |
| --- | --- |
| `Verified` | Implemented and confirmed in the browser or automated check. |
| `Implemented - needs verification` | Code exists, but end-to-end proof is still needed. |
| `Partial` | Some behavior exists, but the workflow is incomplete or mismatched. |
| `Not started` | Required behavior is not implemented yet. |
| `Blocked` | Cannot complete without a known dependency or decision. |
| `Regression risk` | Worked before or was recently touched and needs recheck. |

## Screenshot References

| Screenshot | Path | What It Shows |
| --- | --- | --- |
| Legacy viewer base | `/Users/meganharrison/Desktop/Screenshot 2026-07-13 at 4.31.40 AM.png` | Expected left rail tools, top header, drawing canvas layout. |
| Legacy links panel | `/Users/meganharrison/Desktop/Screenshot 2026-07-13 at 4.32.00 AM.png` | Links panel, left rail Link tool, add-link affordance. |
| Legacy filter panel | `/Users/meganharrison/Desktop/Screenshot 2026-07-13 at 4.32.11 AM.png` | Layer visibility filters for comments, links, markup types, linked item types. |
| Legacy info panel | `/Users/meganharrison/Desktop/Screenshot 2026-07-13 at 4.32.23 AM.png` | Drawing metadata panel. |
| Legacy search panel | `/Users/meganharrison/Desktop/Screenshot 2026-07-13 at 4.32.27 AM.png` | Drawing search and drawing navigation list. |
| Current broken comment UI | `/var/folders/ff/1ybhtyzs5kz7sbvy_l8d4qf80000gn/T/codex-clipboard-3331500d-6622-4c7c-9134-732e59c65cbe.png` | Comment/note UI with wrong dark inline composer, wrong icon behavior, red plus note marker. |

## Core Viewer Requirements

| Area | Required feature | Screenshot | Notes / acceptance criteria | Current status | Evidence / next action |
| --- | --- | --- | --- | --- | --- |
| Shell | Full-screen drawing viewer opens from project drawings route | Legacy viewer base | Route loads authenticated, shows drawing canvas, left tools, top controls, right panels. | Verified | Playwright route check on `/67/drawings/viewer/0e486628-f210-4be4-bc1b-3eec20f0b44d` showed route renders and canvas/iframe present. |
| Header | Back to Drawings button | Legacy viewer base | Returns to project drawings list without losing app state. | Verified | Browser proof returned to `/67/drawings`. Evidence: `codex-26-navigation-download-links-history-summary.json`. |
| Header | Previous / next drawing navigation | Legacy viewer base | Moves between drawings in current project set. Disabled or inert at list bounds. | Verified | Browser proof navigated to previous and next drawing viewer routes. Evidence: `codex-26-navigation-download-links-history-summary.json`. |
| Header | Drawing title, number, revision, page count | Legacy viewer base | Shows drawing identity and current page count accurately. | Verified | Playwright text showed `A050 - Architectural Site Plan`, `Revision JP8572`, `Page 1 of 1`. |
| Header | Download drawing | Legacy viewer base | Downloads current drawing file through drawing API; errors loudly if no URL. | Verified | Download button called drawing download API with 200 and returned `A050 - Architectural Site Plan.pdf`. Evidence: `codex-26-navigation-download-links-history-summary.json`. |
| Header | Close viewer | Legacy viewer base | Returns to drawings list. | Verified | Browser proof returned to `/67/drawings`. Evidence: `codex-26-navigation-download-links-history-summary.json`. |
| Canvas | PDF renders at usable size | Legacy viewer base | Canvas is not blank, drawing content is visible, PDF.js Express watermark/state does not block use. | Verified | Playwright screenshot showed drawing sheet content and one canvas/iframe. |
| Canvas | Current page tracking | Legacy viewer base | Page indicator updates when page changes. | Implemented - needs verification | Single-page drawing verified; multipage drawing still needs check. |
| Canvas | Viewer should fail loudly | N/A | Missing license, PDF load failure, or API failure must show actionable error, not indefinite blank/loading. | Partial | Existing viewer has license/init error; stuck loading paths still need explicit guard. |

## Left Rail Tools

| Tool | Required feature | Screenshot | Notes / acceptance criteria | Current status | Evidence / next action |
| --- | --- | --- | --- | --- | --- |
| Select | Select / inspect existing markups and linked items | Legacy viewer base | Default safe mode; does not draw accidentally. | Verified | Clicking the sheet in Select mode emitted zero annotation POSTs and no page errors. Evidence: `codex-31-select-no-draw-summary.json`. |
| Pen | Freehand markup | Legacy viewer base | Draws and persists PDF-page-coordinate strokes. Color should be configurable. | Verified | UI-created pen row persisted, survived reload, then deleted. Evidence: `codex-12-markup-create-reload-delete-summary.json`. |
| Highlight | Highlight markup | Legacy viewer base; current broken comment UI | Draws translucent highlight and persists. Color should be configurable. | Verified | UI-created highlighter row persisted, survived reload, then deleted. Evidence: `codex-12-markup-create-reload-delete-summary.json`. |
| Rectangle | Rectangle markup | Legacy viewer base | Draws and persists rectangle. Color should be configurable. | Verified | UI-created rectangle row persisted, survived reload, then deleted. Evidence: `codex-12-markup-create-reload-delete-summary.json`. |
| Cloud | Revision cloud markup | Legacy viewer base; current broken comment UI | Cloud should look like construction revision cloud, not a blob or cartoon shape. Color should be configurable. | Verified | UI-created cloud row persisted, survived reload, and revised thinner outline cloud is visible in `codex-16-cloud-thinner-stroke.png`. |
| Arrow | Arrow markup | Legacy viewer base | Draws and persists arrow with visible arrowhead. Color should be configurable. | Verified | UI-created arrow row persisted, survived reload, then deleted. Evidence: `codex-12-markup-create-reload-delete-summary.json`. |
| Text | Text markup | Legacy viewer base | Places text on drawing; composer should be readable; color should be configurable. | Verified | UI-created text row persisted, survived reload, then deleted. Evidence: `codex-12-markup-create-reload-delete-summary.json`. |
| Comment | Drawing comment thread | Legacy viewer base; current broken comment UI | Left rail Comment must create/open real Velt drawing comments, not local `drawing_annotations` notes. Must show in Comments side panel. | Verified | Click check opens Comments panel with drawing target and no console/page errors. |
| Link | Linked item pin placement | Legacy links panel | Starts placement mode, then opens modal to link RFI, drawing, submittal, document, photo, etc. | Verified | Evidence: `docs/ops/evidence/2026-07-13-drawings-verification/05-link-modal-types.png`; Playwright confirmed all eight type buttons and zero errors. |
| Eraser | Delete markup | Legacy viewer base | Removes selected/targeted drawing markup; should not delete linked records accidentally. | Verified | Temporary rectangle was erased from the rectangle interior with one DELETE and API confirmed deletion after pointer-down/pointer-up hardening. Evidence: `codex-24-eraser-interior-pointerup-dedupe-summary.json`. |
| Zoom in | Zoom drawing in | Current user request | Button changes PDF zoom and overlay alignment stays correct. | Verified | Fresh Playwright pass clicked Zoom in; drawing remained visible with no errors in `codex-10-post-zoom-rotate.png`. |
| Zoom out | Zoom drawing out | Current user request | Button changes PDF zoom and overlay alignment stays correct. | Verified | Fresh Playwright pass clicked Zoom out; drawing remained visible with no errors in `codex-10-post-zoom-rotate.png`. |
| Rotate left | Rotate drawing left | Current user request | Button rotates PDF and overlay alignment refreshes. | Verified | Fresh Playwright pass clicked Rotate left; drawing remained visible with no errors in `codex-10-post-zoom-rotate.png`. |
| Rotate right | Rotate drawing right | Current user request | Button rotates PDF and overlay alignment refreshes. | Verified | Fresh Playwright pass clicked Rotate right; drawing remained visible with no errors in `codex-10-post-zoom-rotate.png`. |

## Color and Markup Controls

| Requirement | Screenshot | Notes / acceptance criteria | Current status | Evidence / next action |
| --- | --- | --- | --- | --- |
| Color picker for pen | Current user request | User can change pen color before drawing. | Verified | UI-created pen markup persisted selected red color and survived reload. Evidence: `codex-12-markup-create-reload-delete-summary.json`. |
| Color picker for highlight | Current user request | User can change highlight color before drawing. | Verified | UI-created highlighter markup persisted selected red color and survived reload. Evidence: `codex-12-markup-create-reload-delete-summary.json`. |
| Color picker for cloud | Current user request | User can change cloud color before drawing. | Verified | Evidence: `docs/ops/evidence/2026-07-13-drawings-verification/codex-08-cloud-swatches.png`; fresh pass counted 7 swatches. |
| Color picker for text | Current user request | User can change text color before placing text. | Verified | UI-created text markup persisted selected red color and survived reload. Evidence: `codex-12-markup-create-reload-delete-summary.json`. |
| Color picker for rectangle | Current user request implies all markups | Rectangle now uses the same swatches as other drawn markup. | Verified | Evidence: `docs/ops/evidence/2026-07-13-drawings-verification/codex-07-rectangle-swatches.png`; fresh pass counted 7 swatches. |
| Color picker for arrow | Current user request implies all markups | Arrow now uses the same swatches as other drawn markup. | Verified | Evidence: `docs/ops/evidence/2026-07-13-drawings-verification/codex-09-arrow-swatches.png`; fresh pass counted 7 swatches. |
| Saved markup keeps selected color | N/A | Reloading drawing shows same color. | Verified | UI-created rows persisted `color: "#ef4444"` and survived reload. Evidence: `codex-12-markup-create-reload-delete-summary.json`. |
| Overlay alignment after zoom/rotate | Current user request | Existing markup and pins remain aligned after PDF zoom/rotate. | Verified | Temporary punch and coordination pins remained visible after rotate; all temp pins were deleted. Evidence: `codex-30-punch-coord-pins-rotate-cleanup-summary.json`. |

## Comments Requirements

| Requirement | Screenshot | Notes / acceptance criteria | Current status | Evidence / next action |
| --- | --- | --- | --- | --- |
| Comment side panel uses comment icon | Current broken comment UI | Top header Comments button should use `MessageSquare`, not heartbeat/activity icon. | Verified | Code changed from `Activity` to `MessageSquare`; screenshot shows comment icon active. |
| Left rail has Comment tool | Legacy viewer base; current broken comment UI | Left rail should show Comment, not Note. | Verified | Playwright text and screenshot show `Comment`. |
| Adding comment uses light in-canvas composer | Current broken comment UI | New comment placement should use Velt comment flow and avatar-style marker, not black local note input. | Partial | Local Note flow no longer exposed; Velt comment mode starts. Need click-on-canvas composer screenshot. |
| Comment appears in Comments side panel | User clarification | Comment created from drawing must show in the right Comments panel. | Verified | Evidence: `docs/ops/evidence/2026-07-13-drawings-verification/10-comment-attachment-staged.png` shows existing drawing comment text in the Comments panel. |
| Comment hover opens preview | User clarification | Hovering comment marker should show comment preview, consistent with other pages. | Implemented - needs verification | Velt has `bubbleOnPinHover` / `dialogOnHover`; needs drawing canvas test. |
| Comment click opens thread | User clarification | Clicking marker opens comment thread/panel. | Implemented - needs verification | Velt should handle; needs drawing canvas test. |
| Comment marker shows avatar | User clarification | Marker should look like avatar/comment marker, not red plus. | Partial | Legacy note marker changed to avatar-style; Velt marker behavior needs visual check after creating new comment. |
| Comments side panel input has dark background | Current broken comment UI | Input itself is dark; surrounding section does not create an extra black block. | Verified | Screenshot `/tmp/drawing-comments-final-check-2.png` showed dark composer input and transparent panel section. |
| Remove comment section background color | Current broken comment UI | No separate background slab behind comment section. | Verified | `.drawing-comments-panel` CSS sets section chrome transparent; screenshot confirms. |
| Comments support image/file upload | User clarification | Composer allows file/image attachments. | Verified | Evidence: focused DOM found `Attach files` button/file input; `docs/ops/evidence/2026-07-13-drawings-verification/10-comment-attachment-staged.png` shows staged image preview. |
| Comments can reference linked records | User clarification | Comments workflow must support linking to RFIs, drawings, submittals, photos, documents, etc. | Verified for drawing-level links | Comments panel exposes `Link item`; link modal supports RFI, drawing, submittal, document, photo, punch item, coordination issue, task. Embedded comment-body chips remain an open decision. |
| Comment thread metadata includes drawing/page | N/A | New comments carry drawing ID, project ID, page, and drawing-viewer context. | Implemented - needs verification | `openDrawingComments` sets Velt context with project/drawing/page. Need Velt event/API check. |
| Legacy notes migrated to Velt comments | Current broken comment UI | Old `drawing_annotations` notes should appear as actual comment threads if historical continuity is required. | Not started | Requires Velt/backfill migration; current fix only changes marker and opens Comments panel. |

## Linked Item Requirements

| Linked item type | Screenshot | Required behavior | Current status | Evidence / next action |
| --- | --- | --- | --- | --- |
| RFI | Legacy links panel | Link existing RFI or create RFI from modal; pin appears on drawing and in Links panel. | Verified | Temporary RFI pin against existing RFI was created, listed, screenshotted, and deleted. Evidence: `codex-17-required-linked-type-pins-create-delete-summary.json`. |
| Drawing | Legacy links panel | Link to another drawing; clicking pin navigates to linked drawing. | Verified | Temporary drawing-link pin against existing drawing was created, listed, screenshotted, and deleted. Evidence: `codex-17-required-linked-type-pins-create-delete-summary.json`. |
| Submittal | Legacy links panel | Link existing/new submittal; open linked submittal from panel/pin. | Verified | Temporary submittal pin against existing submittal was created, listed, screenshotted, and deleted. Evidence: `codex-17-required-linked-type-pins-create-delete-summary.json`. |
| Document | Legacy links panel | Link project document; open linked document. | Verified | Temporary document pin against existing document was created, listed, screenshotted, and deleted. Evidence: `codex-17-required-linked-type-pins-create-delete-summary.json`. |
| Photo | Legacy links panel | Link/upload photo; open linked photo. | Verified | Temporary photo pin against existing photo was created, listed, screenshotted, and deleted. Evidence: `codex-17-required-linked-type-pins-create-delete-summary.json`. |
| Punch item | Legacy filter panel | Link/create punch item if required by Procore parity. | Verified | Temporary punch pin rendered on the drawing, appeared in Links, and was deleted. Evidence: `codex-30-punch-coord-pins-rotate-cleanup-summary.json`. |
| Coordination issue | Legacy filter panel | Link/create coordination issue if required by Procore parity. | Verified | Temporary coordination issue pin rendered on the drawing, appeared in Links, and was deleted. Evidence: `codex-30-punch-coord-pins-rotate-cleanup-summary.json`. |
| Task | Legacy filter panel | Link/create task if required by Procore parity. | Verified | Temporary Task pin was created through the Link modal, appeared on the drawing, and was deleted successfully. Evidence: `codex-11-temp-task-pin-create-delete.json`. |
| Linked item panel list | Legacy links panel | Panel groups linked items by type, shows count/status, supports open and delete. | Verified | Temporary task pin rendered in the Links panel and was deleted with no leftover row. Evidence: `codex-26-navigation-download-links-history-summary.json`. |
| Link from Comments panel | User clarification | Comments panel includes a path to link records without leaving the comment workflow. | Verified | Evidence: `docs/ops/evidence/2026-07-13-drawings-verification/06-comments-panel.png` and `08-comments-snapshot.txt` show `Link item`. |

## Right Panel Requirements

| Panel | Screenshot | Required behavior | Current status | Evidence / next action |
| --- | --- | --- | --- | --- |
| Links | Legacy links panel | Shows linked item count, empty state, add-link action, grouped linked items. | Verified | Temporary linked task appeared in Links panel; exact temp pin was deleted afterward. Evidence: `codex-25-links-panel-temp-pin.png` and `codex-26-navigation-download-links-history-summary.json`. |
| Filter | Legacy filter panel | Toggle comments, linked items, drawn markup, freehand, highlights, rectangles, clouds, arrows, text, RFI, punch, coordination, tasks, drawings, documents, photos, submittals. | Verified | Filter panel now exposes linked item type controls for RFIs, Punch Items, Coordination Issues, Tasks, Drawing Links, Documents, Photos, and Submittals. Evidence: `codex-22-filter-linked-item-types-summary.json`. |
| Info | Legacy info panel | Shows drawing title/number, discipline, revision, status, date, received date, file, size if available. | Verified | Info panel now shows drawing date, received date, and file size. Evidence: `codex-18-info-panel.png`. |
| Search | Legacy search panel | Search drawings by number/title and navigate. | Verified | Search panel filtered `A100` to `A100 Overall Plan`. Evidence: `codex-19-search-panel-a100.png` and `codex-19-search-panel-a100-snapshot.txt`. |
| Comments | Current broken comment UI | Shows drawing-scoped Velt comments and composer; no extra background; dark input. | Verified | Evidence: `docs/ops/evidence/2026-07-13-drawings-verification/06-comments-panel.png` and `10-comment-attachment-staged.png`. |
| History | Header | Shows drawing change/activity history. | Verified | Change-history API returned 200 and the panel settled to the empty state. Evidence: `codex-27-history-panel-settled-summary.json`. |

## Persistence and Data Contracts

| Data | Required behavior | Current status | Notes / next action |
| --- | --- | --- | --- |
| Drawn markup | Saves to `drawing_annotations` with PDF page percent coordinates. | Verified | Pen, highlighter, rectangle, cloud, arrow, and text were created through the UI, verified in API with `page_percent: true`, survived reload, then deleted. |
| Linked item pins | Saves to drawing pin API with x/y/page and entity metadata. | Verified | RFI, drawing, document, photo, submittal, and Task pins were created and deleted with exact ID cleanup. |
| Drawing comments | Saves to Velt under `entity:drawing:{drawingId}`. | Implemented - needs verification | Need create real comment and confirm side panel list. |
| Comment attachments | Saves through Velt attachment handling. | Implemented - needs verification | Need upload image/file from drawing comment composer. |
| Legacy notes | Existing `drawing_annotations` note rows remain visible. | Partial | Marker restyled, but not migrated to Velt comments. |

## Verification Matrix

| Test | Scope | Status | Evidence / owner |
| --- | --- | --- | --- |
| Targeted ESLint for drawing/comment files | Static check | Verified | `pnpm exec eslint ... page.tsx DrawingComments.tsx PdfjsExpressDrawingViewer.tsx PdfjsExpressMarkupOverlay.tsx VeltGlobalLayer.tsx` passed. |
| Authenticated drawing route renders | Browser | Verified | Playwright authenticated route check; no loading state, canvas/iframe present. |
| Left rail Comment opens Comments panel | Browser | Verified | Playwright click check returned `hasCommentsPanel: true`, `hasLinkItem: true`, `errorCount: 0`. |
| Comments panel style | Visual | Verified | Screenshot `/tmp/drawing-comments-final-check-2.png` showed dark input, transparent section, Link item action. |
| Create drawing comment and confirm side panel list | Browser + Velt | Verified existing thread | Existing drawing comment appears in side panel in `10-comment-attachment-staged.png`; creating a new live test comment intentionally avoided to prevent junk data. |
| Upload image/file to drawing comment | Browser + Velt | Verified staged image | `10-comment-attachment-staged.png` shows image preview after setting Velt `Attach files input`; no comment was submitted. |
| Link each entity type from drawing | Browser + DB/API | Verified | Modal type coverage verified for all required entity types. RFI/drawing/document/photo/submittal pins and Task pin were created, listed, screenshotted, then deleted. |
| Zoom/rotate overlay alignment | Browser visual | Verified route remains usable | `codex-10-post-zoom-rotate.png`; Playwright clicked zoom in/out and rotate left/right, drawing canvas/iframe remained visible, no loading state remained, and no console/network errors were captured. Coordinate alignment still needs marked-up overlay screenshot. |
| Cloud visual quality review | Visual | Verified | `codex-16-cloud-thinner-stroke.png` shows the revised thinner outline cloud drawn on the sheet. |

## Open Decisions

| Decision | Why it matters | Recommendation |
| --- | --- | --- |
| Should rectangle and arrow also have color controls? | User asked for color controls for cloud/highlight/text/pen, but likely expects all drawn markup to be colorable. | Add rectangle and arrow to colorable tools unless product explicitly says no. |
| Should linked records be embedded inside comment threads or remain drawing pins beside comments? | Current implementation exposes `Link item` in Comments panel but stores links as drawing pins. | Keep pins as source of truth for drawing links; add comment-to-pin association only if comments must carry linked-record chips. |
| Should old local notes be migrated to Velt? | Existing note rows will not show as Velt threads. | Backfill only if historical notes matter; otherwise keep legacy marker and move forward with Velt comments. |
| Should comments be visible in global all-comments page under drawing document name? | Drawing comments use entity document ID, not route path. | Add all-comments grouping/label support for `entity:drawing:*` if needed. |

## Verification Evidence Added 2026-07-13

| Evidence | Result | Notes |
| --- | --- | --- |
| `docs/ops/evidence/2026-07-13-drawings-verification/01-route-controls.png` | Pass | Authenticated drawing route renders expected left rail and top header controls. |
| `docs/ops/evidence/2026-07-13-drawings-verification/04-arrow-colors.png` | Pass | Arrow tool displays color swatches after patch. |
| `docs/ops/evidence/2026-07-13-drawings-verification/05-link-modal-types.png` | Pass | Add Link modal opens from drawing click and exposes all required link types. |
| `docs/ops/evidence/2026-07-13-drawings-verification/06-comments-panel.png` | Pass | Comments panel uses comment icon/header, transparent body, dark composer input, and Link item action. |
| `docs/ops/evidence/2026-07-13-drawings-verification/07-after-zoom-rotate.png` | Pass | Zoom in/out and rotate left/right controls remain clickable and drawing remains visible. |
| `docs/ops/evidence/2026-07-13-drawings-verification/10-comment-attachment-staged.png` | Pass | Existing drawing comment appears in side panel; image attachment preview stages in composer. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-10-followup-summary.json` | Pass | Fresh follow-up verified Rectangle, Cloud, and Arrow swatches plus zoom/rotate with zero errors or 4xx/5xx responses. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-11-temp-task-pin-create-delete.json` | Pass | Temporary Task link pin was created through the UI, confirmed through API, screenshotted, then deleted. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-12-markup-create-reload-delete-summary.json` | Pass | Pen, highlighter, rectangle, cloud, arrow, and text were created through UI, persisted, survived reload, then deleted. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-14-eraser-delete-summary.json` | Pass | Temporary rectangle was deleted through the Eraser tool with no fallback cleanup needed. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-16-cloud-thinner-stroke-summary.json` | Pass | Revised cloud stroke was drawn through UI, screenshotted, and deleted with no errors. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-17-required-linked-type-pins-create-delete-summary.json` | Pass | RFI, drawing, document, photo, and submittal pins were created against existing records, listed, screenshotted, and deleted. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-18-info-panel.png` | Pass | Info panel displays drawing date, received date, and file size alongside title, discipline, revision, status, and file name. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-19-search-panel-a100.png` | Pass | Search panel filters drawing list by drawing number and shows the expected `A100 Overall Plan` result. |
| `docs/ops/evidence/2026-07-13-drawings-verification/subagent-current/REPORT.md` | Pass with follow-up defects | Subagent verified route, cloud, cleanup, zoom, and rotate; found eraser interior miss and duplicate request fan-out before the follow-up fix. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-21-eraser-interior-and-dedupe-summary.json` | Pass | Post-fix targeted proof created one rectangle with one POST, erased it from the interior with one DELETE, and left no temp records. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-22-filter-linked-item-types-summary.json` | Pass | Filter panel shows all required linked item type visibility controls from the legacy screenshot. |
| `docs/ops/evidence/2026-07-13-drawings-verification/subagent-post-fix/REPORT.md` | Mixed | Independent verifier confirmed route, one-POST rectangle creation, thinner cloud, cleanup, and zoom/rotate; reported mixed eraser artifacts before pointer-up hardening. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-24-eraser-interior-pointerup-dedupe-summary.json` | Pass | After pointer-up hardening, targeted proof created one rectangle with one POST, erased it from the interior with one DELETE, left no temp rows, and confirmed subagent temp IDs were gone. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-26-navigation-download-links-history-summary.json` | Pass | Verified previous/next, back, close, download API, Links panel temp pin render, and exact temp pin cleanup. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-27-history-panel-settled-summary.json` | Pass | Verified change-history API 200 and History panel empty state. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-30-punch-coord-pins-rotate-cleanup-summary.json` | Pass | Temporary punch and coordination pins rendered on the drawing and Links panel, survived rotate visibility check, and were deleted. |
| `docs/ops/evidence/2026-07-13-drawings-verification/codex-31-select-no-draw-summary.json` | Pass | Select mode click on the sheet created no annotation POST and no page errors. |

## Immediate Next Actions

| Priority | Action | Owner | Done when |
| --- | --- | --- | --- |
| P0 | Create a real drawing comment from the left rail and confirm it appears in the Comments panel after reload. | Codex | Evidence screenshot and pass/fail recorded here; avoid leaving persistent test junk unless cleanup path is confirmed. |
| P0 | Upload an image/file to a submitted drawing comment. | Codex | Staging is verified; submission/reload proof remains. |
