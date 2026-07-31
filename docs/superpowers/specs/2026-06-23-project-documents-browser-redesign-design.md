# Project Documents Browser Redesign — Design

Date: 2026-06-23
Status: Approved (design) — pending implementation plan
Surface: `frontend/src/app/(main)/[projectId]/documents`

## Problem

The current per-project documents experience is a flat `UnifiedTablePage` with:
- "Folders" that are just a free-text string column (`project_documents.folder`) — drift-prone, not navigable.
- Preview limited to PDF and images, rendered in a bare `<iframe>` / `<img>` with no controls. Office files show an ugly "preview not available" empty box.
- No thumbnails, no drag organization, no large reading view.

It feels dated and clunky. Goal: a modern, fast file browser with real previews and zero-maintenance organization.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Target surface | Project documents (`[projectId]/documents`) first |
| Organization model | Smart auto-folders (saved filters) + user saved views. No manual folder tree. |
| Drag-drop semantics | Drag doc(s) onto a group = re-classify (`document_type`/`category`), not physical move |
| Preview priorities | Office files, real PDF.js viewer, side-by-side preview |
| Layout | Left rail · grid · preview, side by side. Grid and preview EQUAL width by default. |
| Divider | Draggable splitter between grid and preview; each side has a min width; chosen width persisted per user. No separate full-screen reading mode — drag preview wider instead. |
| Default browse view | Grid (thumbnails); list toggle retained |
| Office-on-Supabase | Phase 1 download-fallback (clean state); Phase 2 conversion |
| Dedup | Deferred to Phase 2 |

## Architecture

### Views & layout
- **3-zone shell, all visible at once:**
  - Left rail: smart groups (live counts) + saved views.
  - Grid pane: thumbnail cards (default) ⇄ list view (existing `UnifiedTablePage`, kept as a toggle).
  - Preview pane: live preview of the selected doc with viewer toolbar (zoom, search, download, info) and page nav.
- **Equal width by default** for grid and preview panes.
- **Draggable divider** between grid and preview:
  - Drag to widen either side; each pane enforces a minimum width.
  - The chosen ratio is persisted per user (localStorage or user-prefs) and restored on return.
  - Widening the preview to near-full serves the "read the whole document" need — no separate reading mode.
- Selecting a card updates the preview pane in place (no navigation). Metadata sits behind the info toggle so it never crowds the document.

### Smart auto-folders
- No schema change. Each group is a saved filter over `project_documents` (by `document_type`, `category`, `source`/`source_system`, recency).
- Counts via a single grouped query (one round-trip), surfaced per group.
- "Saved views" = user-defined filter combinations, persisted per user (new lightweight table or user-prefs JSON — to be decided in plan).
- The legacy `project_documents.folder` text column is hidden in the UI (left in DB; not written by the new UI).

### Drag-to-reclassify
- Drag a card or multi-selection onto a left-rail group.
- Optimistic UI update + `PATCH /api/documents/bulk-update` setting `document_type`/`category` to match the target group.
- Toast confirmation; rollback on failure (no silent failure).

### Preview engine
- **PDF (all sources):** `pdf.js` (via `react-pdf` or pdf.js viewer) with page nav, zoom, search, thumbnails. Bytes streamed from the existing download routes.
- **Office (Word/Excel/PPT):**
  - OneDrive/SharePoint-sourced (most docs): Microsoft Graph preview endpoint (`getPreview` / embeddable URL) rendered via Office Online embed — no conversion.
  - Supabase-Storage-only Office files: Phase 1 clean download-fallback state (not the ugly empty box). Phase 2: server-side convert-to-PDF (e.g. Gotenberg/LibreOffice) then PDF.js.
- **Images:** proper contained viewer with zoom.
- **Email/messages:** retain current handling; not a Phase 1 focus.

### Thumbnails
- Graph-sourced docs: Microsoft Graph thumbnail API (free, instant).
- Supabase-stored docs: generate first-page render / downscaled image lazily, cached into a dedicated storage bucket.
- Type-icon fallback while a thumbnail loads or when none is available.

## Reuse & guardrails
- `PageShell variant="detail"`.
- Design-system tokens only; components from `@/components/ds` and `@/components/layout`.
- `apiFetch` from `@/lib/api-client`; reuse `PATCH /api/documents/bulk-update`.
- List view stays on `UnifiedTablePage` + `useUnifiedTableState`.
- New components: left rail, grid view, reading-mode shell + filmstrip, pdf.js viewer wrapper, Graph-preview embed, thumbnail service/hook.

## Scope

### Phase 1 (this round)
3-zone browse shell, smart groups + saved views, grid/list toggle, drag-to-reclassify, pdf.js viewer, Graph Office preview, thumbnails, large reading mode.

### Phase 2 (later)
Cross-source dedup (group by `content_hash`, pick canonical), Office-on-Supabase conversion, document versioning UI.

## Key files to touch
- `frontend/src/app/(main)/[projectId]/documents/documents-client.tsx`
- `frontend/src/features/documents/project-document-preview.tsx` (replace)
- `frontend/src/features/documents/project-documents-table-config.tsx`
- `frontend/src/app/api/projects/[projectId]/documents/[documentId]/download/route.ts`
- `frontend/src/hooks/use-documents.ts`
- New: grid view, left rail, reading-mode shell, pdf.js viewer, thumbnail hook/route.

## Open questions for the plan
- Persistence mechanism for saved views (dedicated table vs. user-prefs JSON).
- Exact Graph preview endpoint + caching/expiry of embed URLs.
- Thumbnail generation trigger for Supabase docs (on upload vs. lazy-on-first-view).
