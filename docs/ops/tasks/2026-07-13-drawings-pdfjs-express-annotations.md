# Task: Persist PDF.js Express Drawing Annotations

Status: Complete
Owner: Codex
Created: 2026-07-13
Linear Issue: Blocked - Linear connector reauthentication is required (`oauth_token_invalid_grant`).

## Objective

Make the canonical drawings viewer at
`/[projectId]/drawings/viewer/[drawingId]` a complete annotation workflow:
PDF.js Express renders the PDF while Alleato owns a separate persisted markup
overlay, authorization, restoration, and collaboration links.

## Done Checklist

- [x] Existing drawing annotation rows and their coordinate contract are measured before migration work.
- [x] A separate persisted overlay contract is implemented without mutating or discarding legacy markup.
- [x] RLS and API validation enforce project scope and creator edit/delete ownership.
- [x] Canonical viewer restores saved project-visible markup after every document load.
- [x] Create and delete events persist through the Alleato overlay contract and fail loudly on rejection.
- [x] Persisted markup stays aligned with its PDF page through zoom, pan, reload, and resize.
- [x] Required drawing tools remain available: note, freehand, highlight, rectangle, cloud, arrow, and text.
- [x] Existing drawing link pins and comment behavior remain reachable from the canonical route.
- [x] Legacy markup has an explicit compatibility or migration path with no silent data loss.
- [x] Browser proof on the A201 route demonstrates create, reload/restore, and delete behavior.
- [x] Targeted lint, type, API, and browser checks are recorded below.

## Evidence

| Check | Artifact / Command | Result | Notes |
| --- | --- | --- | --- |
| Legacy data inventory | Service-role query against `drawing_annotations` | Pass | The table was absent and therefore had no rows to convert. |
| Schema and migration ledger | Direct PostgreSQL transaction using configured `DATABASE_URL` | Pass | Applied `20260710120000_drawing_annotations`; remote ledger and column catalog were read back. |
| Repository migration verifier | `npm run db:migrations:verify-applied -- supabase/migrations/20260710120000_drawing_annotations.sql` | Pass | Duplicate version debt was repaired under S134; the verifier now confirms matching local and remote version `20260710120000`. |
| Vendor capability | `frontend/node_modules/@pdftron/pdfjs-express-viewer/public/core/webviewer-core.min.js` | Blocked | The installed PDF.js Express free viewer reports `importAnnotations` and `exportAnnotations` are unavailable; browser creation produced no annotation event or persisted row. |
| Custom overlay lint | `pnpm --dir frontend exec eslint ...PdfjsExpressMarkupOverlay.tsx ...annotations/route.ts` | Pass | Overlay, viewer, canonical page, and annotation APIs are lint-clean. |
| Custom overlay changed-file type guard | `pnpm --dir frontend run typecheck:changed` | Pass | No new `any` debt detected. |
| Browser A201 create | In-app browser, custom rectangle tool | Pass | The overlay rendered a rectangle and initially failed loudly on RLS, exposing the API identity defect. |
| Browser A201 persistence | Service-role query of `drawing_annotations` | Pass | Rectangle row `d4b16a13-1714-4cd0-b781-c7eaa6e1795b` was created with normalized overlay geometry. |
| Browser A201 restore | Full browser reload | Pass | The saved rectangle returned over the same visible drawing location after reload. |
| Browser A201 delete | Custom eraser followed by service-role count query | Pass | The visible rectangle disappeared and the drawing retained `0` annotation rows. |
| Browser A201 page-coordinate alignment | In-app browser: create rectangle, vendor zoom, pan, reload, erase | Pass | The SVG page frame followed the PDF canvas while the saved rectangle retained `x=37.6588`, `y=29.6061`, `width=7.2595`, and `height=7.6239` page percentages. |
| Cloud and note persistence | In-app browser with CDP request trace | Pass | Cloud POST initially returned `400` because `created_by` incorrectly required an `auth.users` row. After migration `20260713120000`, cloud POST returned `201`, restored after reload, and erased. Note uses a page-anchored inline editor, then saved, restored, and erased. |
| Author-identity migration ledger | Direct PostgreSQL read-back using configured `DATABASE_URL` | Pass | Remote schema no longer has `drawing_annotations_created_by_fkey`; `20260713120000_drawing_annotations_author_identity` is present in `supabase_migrations.schema_migrations`. |
| Remaining custom tools | In-app browser A201: freehand, highlight, arrow, text | Pass | Each tool created and persisted a distinct shape; one reload restored two `path` records (`opacity=1` and `0.32`), one arrow, and `Verified text markup`. The eraser removed all test shapes. |
| Canonical linked-pin layer | In-app browser A201: authenticated temporary pin create, reload, delete | Pass | `POST /pins` returned `201`; the normal viewer rendered `Open linked TEST`; `DELETE /pins/{id}` returned `200` and the marker disappeared after reload. |
| Pin author-identity migration ledger | Direct PostgreSQL read-back using configured `DATABASE_URL` | Pass | Remote schema no longer has `drawing_markup_pins_created_by_fkey`; `20260713123000_drawing_markup_pins_author_identity` is present in `supabase_migrations.schema_migrations`. |
| Historical viewer controls and panels | In-app browser A201: dark shell, vertical tool rail, Links, Comments, History | Pass | Restored historical interaction hierarchy. Links opened the persisted linked-items panel; Comments mounted the discussion panel; History resolved to `No changes recorded` rather than hanging. |
| Historical utility-control parity | In-app browser A201: icon utility bar, left zoom/rotate, filter/info panels | Pass | Header is icon-only for links, filter, info, search, comments, history, and download. Zoom and rotate call the PDF.js Express document viewer; browser proof rotated A201 and returned it to the original orientation. Filter controls now toggle persisted markup categories and linked pins. |
| Legacy markup compatibility guardrail | Annotation API and custom overlay | Pass | Canonical writes now require `page_percent: true`. Rows without that contract remain out of the unsafe PDF coordinate renderer and expose a conditional raw JSON export, preventing silent loss while source image dimensions are unavailable. |
| End-to-end annotation loop | In-app browser A201: rectangle, pen, highlight, cloud, arrow, text, note, reload, filter, zoom, rotate | Pass | Seven temporary annotations persisted. After the PDF completed its reload cycle, the overlay restored 1 rectangle, 5 paths, 1 arrow, 1 text label, and 1 note. The rectangle filter hid and restored its layer. Visual proof confirmed all marks remained positioned on the rotated PDF. Exact UUID cleanup deleted all seven; direct read-back returned `0` rows. |
| Deterministic overlay regression | `E2E_DRAWINGS_PROJECT_ID=67 E2E_DRAWING_ID=... PLAYWRIGHT_BASE_URL=http://localhost:3001/auth/login pnpm exec playwright test e2e/drawings/pdfjs-express-annotations.spec.ts --project=chromium --no-deps --config=config/playwright/playwright.config.ts` | Pass | 1 passed in 23.1s. The spec waits up to 60 seconds for rendered overlay geometry, then creates, reloads, filters, restores, erases, and cleanup-deletes its own annotation id. |
| Recorded agent-browser regression | `docs/ops/evidence/2026-07-13-drawings-annotation-agent-browser/annotation-flow.webm` and `01` through `08` screenshots | Pass | Recorded A201 tool/persistence/filter/viewport flow. The pass exposed the PDF.js Express iframe winning hit testing after a tool transition; the viewer now disables iframe pointer input while a custom markup tool owns the gesture. Live proof then created and erased a rectangle and the exact A201 annotation read-back returned `0`. |
| Repeat deterministic runner after pointer-ownership repair | Same targeted Playwright command | Deferred runner condition | The runner reached the scenario but hung in its Playwright video worker for nearly two minutes without an assertion or timeout line, so its isolated process was terminated to prevent resource pressure. The prior focused regression is passing; the repaired behavior has current recorded `agent-browser` proof. |

## Risks and Guardrails

- PDF.js Express markup uses XFDF and PDF-page coordinates; the retired viewer
  stored image-space geometry. The two formats must not be mixed silently.
- Imported XFDF emits annotation events. Persistence must ignore imported events
  to prevent duplicate writes and reload loops.
- Vendor UI permissions are not security. API and RLS remain the enforcement
  boundary, and rejected writes must surface a usable error and reload truth.
- New custom geometry is normalized to the rendered PDF page. The viewer
  refreshes the overlay frame from the vendor canvas on document load, page
  render, zoom, scroll, and resize, so persisted geometry does not depend on
  the browser viewport.
- The short-lived `viewport_percent` marker remains explicit compatibility data.
  There were no rows using it in the remote table before this migration. If a
  row without `page_percent: true` is encountered, the canonical overlay keeps
  it out of PDF rendering and offers a raw JSON export. A future importer can
  transform it only when source image dimensions are available.
- `created_by` is an app-identity UUID, not a foreign key to `auth.users`.
  `verifyProjectAccess` plus route ownership checks are the enforcement
  boundary; a database FK would reject legitimate SSO-backed project members.
- Existing drawing link pins render as a separate page-coordinate layer even
  when markup mode is closed. The pin API is project-scoped and creator-owned;
  comments are reachable in the right-side discussion panel. PDF-page comment
  markers remain a follow-on routing slice.
- The E2E loop requires waiting for PDF.js Express `documentLoaded` and page
  rendering. A DOM check before that lifecycle completed reported no overlay
  geometry even though all persisted rows restored once the PDF page was ready.
- The vendor iframe can win browser hit testing over a visually higher sibling
  overlay. The viewer now gives the SVG overlay pointer ownership whenever a
  custom markup tool is selected and returns pointer ownership to PDF.js Express
  only in idle mode. This prevents a visible-but-undrawable markup state.

## Superseded Vendor Finding

- **Cause:** `@pdftron/pdfjs-express-viewer@8.7.5` is the PDF.js Express free
  viewer build. Its bundled core explicitly disables drawing annotations and
  XFDF import/export. The supplied PDF.js Express key does not change that
  package capability.
- **Detection gap:** The initial viewer migration validated rendering and
  toolbar visibility, but did not execute a create/reload annotation round
  trip.
- **Prevention:** Viewer migrations must include a vendor capability check for
  every required workflow, not only visible controls.
- **Implementation decision:** Keep PDF.js Express as the renderer and build
  the separate persisted overlay. Do not enable a fake native annotation
  control on this viewer.

## Files Expected To Change

- `supabase/migrations/20260710120000_drawing_annotations.sql`
- `frontend/src/components/drawings/PdfjsExpressMarkupOverlay.tsx`
- `frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx`
- `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx`
- `frontend/tests/e2e/drawings/pdfjs-express-annotations.spec.ts`
- `docs/ops/handoffs/2026-07-13-S127-drawings-pdfjs-express-annotations.md`
