# Task: Migrate Canonical Drawings Viewer to PDF.js Express

Status: Complete - locally verified; not yet committed or pushed.
Owner: Codex
Created: 2026-07-13
Linear Issue: Blocked - Linear connector reauthentication required (`oauth_token_invalid_grant`) when attempting issue creation in-session.

## Objective

Replace the current custom canonical drawings viewer on
`/[projectId]/drawings/viewer/[drawingId]` with PDF.js Express, using the
existing drawings PDF source and one canonical viewer entry point.

## Done Checklist

- [x] PDF.js Express dependency installed in `frontend`.
- [x] Required static viewer assets copied into a public path served by Next.js.
- [x] License key wired without exposing it in logs or docs.
- [x] Canonical drawings viewer route uses PDF.js Express instead of the current custom viewer.
- [x] Core route behavior preserved: open drawing, next/previous drawing navigation, close back to drawings list, and download action.
- [x] Duplicate-path ownership reviewed and any fallback path explicitly documented.
- [x] Targeted verification run for the canonical route integration.
- [x] Remaining parity gaps called out explicitly instead of failing silently.
- [x] Browser proof: the canonical A201 route renders the full drawing using the sample-aligned viewer.

## Evidence

| Check | Artifact / Command | Result | Notes |
| --- | --- | --- | --- |
| Linear tracking | `mcp__codex_apps__linear._save_issue` | Blocked | Connector returned reauthentication-required `oauth_token_invalid_grant`. |
| Dependency install | `pnpm --dir frontend add @pdftron/pdfjs-express-viewer` | Pass | Installed `@pdftron/pdfjs-express-viewer@8.7.5`. |
| Static asset wiring | `pnpm --dir frontend run pdfjs-express:assets` | Pass | Copied viewer runtime assets into `frontend/public/webviewer/lib`, matching the vendor React sample. |
| Canonical route swap | `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx`; `frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx` | Pass | Canonical route now mounts PDF.js Express and keeps `viewer-v3` as explicit legacy fallback. |
| Targeted verification | `pnpm --dir frontend exec eslint 'src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx' 'src/components/drawings/PdfjsExpressDrawingViewer.tsx'`; `pnpm --dir frontend run typecheck:changed`; `pnpm --dir frontend exec tsx --tsconfig tsconfig.json -e "import('./src/components/drawings/PdfjsExpressDrawingViewer.tsx'); import('./src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx'); console.log('tsx-import-ok');"` | Pass | Lint clean, changed-file `any` guard clean, narrow import/transpile check exited `0`. |
| Loading-state regression | In-app browser: `http://localhost:3001/67/drawings/viewer/6b720f54-3376-4b94-a913-eb593698c2b2` | Pass | The route now transitions from `Loading drawing...` to the viewer; it no longer renders the false no-file state while the drawing query is pending. |
| PDF proxy availability | Frontend request logs for `GET /api/projects/67/drawings/6b720f54-3376-4b94-a913-eb593698c2b2/pdf-proxy` | Pass | Authenticated request returned `200`. |
| Wide-sheet layout diagnosis | In-app browser DOM geometry | Confirmed source-page behavior | The viewer page canvas fills the available viewport at `1095 x 782`; the drawing content occupies only a narrow band inside that PDF page. The extra whitespace is in the source PDF page bounds, not caused by viewer sizing. |
| Full TypeScript compile | `pnpm --dir frontend exec tsc --noEmit --pretty false` | Partial | No diagnostics surfaced before the run stalled; stopped without a complete repo-wide result. |
| Vendor sample alignment | PDF.js Express React guide and `pdfjs-express-viewer-react-sample` | Pass | Canonical component uses the documented one-time `WebViewer({ path: "/webviewer/lib", initialDoc }, element)` initialization. The package import remains client-only because it accesses `window` during module evaluation. |
| Static runtime access | `curl` checks for `/webviewer/lib/ui/index.html`, its UI bundle, PDF.js core files, CSS, and icon | Pass | All required runtime assets return `200` without a session after excluding only `/webviewer/*` from session middleware. |
| Browser loop | In-app browser, canonical A201 route | Pass | After a reload, the viewer iframe and its host both measured `953px` high; visual capture shows the complete A201 sheet at `37%` with no blank application canvas below it. |

## Risks / Gaps

- PDF.js Express may not provide feature parity with the current custom overlay
  stack on the first pass; any missing behavior must fail loudly and be called
  out.
- The project setup wizard still contains a stale drawings upload path that does
  not match the live drawings contract; this migration should not deepen that
  split.
- Browser verification is still required on the real drawings route before this
  should be treated as fully proven.
- Root cause fixed: the session middleware protected PDF.js Express's required
  `ui/index.html`, despite treating JavaScript and CSS as public assets. This
  was detected by a `307` redirect to `/auth/login`; the `/webviewer/*`
  matcher exclusion prevents recurrence for the vendor runtime.
- Root cause fixed: PDF.js Express writes `height="100%"` as an iframe HTML
  attribute, which resolves to the browser default `150px` without an explicit
  CSS height. The viewer mount now enforces `[&>iframe]:h-full`; browser
  geometry verifies the iframe matches its full-height host.
- The checkout contains unrelated dirty/untracked files; finalization must stay
  scoped to task-owned paths only.

## Files Expected To Change

- `frontend/package.json`
- `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx`
- `frontend/src/components/drawings/*` (new PDF.js Express viewer owner)
- `frontend/public/webviewer/**` or equivalent copied static assets
- `docs/ops/tasks/2026-07-13-drawings-pdfjs-express-migration.md`
