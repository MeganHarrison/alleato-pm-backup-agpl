# Transmittals Tool — Procore Audit & Gap Analysis

**Audit Date:** 2026-03-08
**Procore Squad:** Submittals
**Crawl Source:** `procore-crawls/procore-crawl-outputs/transmittals/crawl-transmittals/`
**Crawl Date:** 2026-01-11

---

## Executive Summary

Procore's Transmittals tool is a correspondence tracking system for construction projects. It provides a structured log of all project-related communications sent between parties, with support for file attachments, cross-tool linking, email forwarding, privacy controls, and full export capabilities.

Alleato currently has **zero implementation** beyond a placeholder route. The route exists, navigation is registered, but there is no database schema, no API, no hooks, and no UI. Everything must be built from scratch.

---

## What Procore Has

### Tool Definition

A transmittal in Procore is "a documented record of any project-related correspondence." The tool functions as a formal correspondence log, distinct from RFIs, submittals, or direct messages. Each transmittal captures who sent what to whom, when, with what attachments, and maintains a trail of related project items.

### Pages Inventory

| Page | URL Pattern | Status |
|------|-------------|--------|
| List (log view) | `/project/transmittals/list` | Crawled (empty state) |
| Create | `/project/transmittals/new` | 404 during crawl — form fields inferred |
| Recycle Bin | `/transmittals/recycle_bin?project_id=...` | Endpoint confirmed, not crawled |
| Export | `/transmittals/export?project_id=...` | Endpoint confirmed, not crawled |
| Configure Settings | `/project/transmittals/configure_tab` | Crawled |

#### List Page Details

- Default sort: by `number` (ascending)
- Default per-page: 150 records
- Default view mode: list
- Toolbar actions: Export (dropdown with PDF and CSV), Create
- Tabs: Items, Recycle Bin, More
- Column features: customizable display (show/hide), resizable widths, sortable columns
- Empty state message: "No Transmittals Found - Transmittals is where you keep documented records of any correspondence."
- Search: available to Read Only, Standard, and Admin users

#### Configure Settings Page Details

**Transmittal Settings tab** has two settings:

1. **Transmittals Private By Default** (checkbox)
   - When checked: all new transmittals default to Private
   - Private transmittals visible only to Admin users, the creator, To/CC recipients, and Default Distribution members
   - Default: unchecked (not private by default)

2. **Default Distribution** (people picker from Project Directory)
   - One or more people automatically added to all new transmittals
   - Person must exist in Project Directory first
   - Distinct from per-transmittal distribution lists

**Additional tabs** on the configure page (not transmittals-specific):
- Permissions Table
- Project Dates
- Project Home Settings

---

### Create Form Fields (Inferred)

The create transmittal form returned 404 during crawl. Fields were inferred from the permissions matrix, FAQ content, tutorial names, and configure settings documentation.

| Field | Type | Required | Source of Inference |
|-------|------|----------|---------------------|
| Number | Auto-generated or manual integer | No | `sort=number` URL param; industry standard |
| Title / Subject | Text | No | Industry standard |
| To | Multi-select people picker | Yes | Explicitly named in permissions docs |
| CC | Multi-select people picker | No | Explicitly named in permissions docs |
| Date | Date picker | No | Industry standard |
| Description / Body | Rich text / textarea | No | Content of the correspondence |
| Attachments / Items | File upload (multi-file) | No | FAQ: "How do I attach multiple files at once?" + tutorial "Add Items to a Transmittal" |
| Related Items | Item picker (cross-tool linking) | No | Tutorial "Add a Related Item to a Transmittal" + FAQ "What are related items in Procore?" |
| Private | Checkbox | No | Per-transmittal override; defaults from project setting |
| Distribution | Multi-select people picker | No | Per-transmittal distribution list |
| Location | Tiered location picker | No | FAQ: "How do I filter items by multi-tiered locations?" |

**Note:** "Items" (attachments) and "Related Items" are distinct concepts:
- **Items:** Files/documents attached directly to the transmittal
- **Related Items:** Links to other Procore items (RFIs, submittals, drawings, etc.) via cross-tool references

---

### Log View Columns (Inferred)

The list was empty at crawl time, so column headers were not captured. Columns inferred from URL params, permissions matrix, and industry standards.

| Column | Sortable | Notes |
|--------|----------|-------|
| Number | Yes | Default sort field |
| Title / Subject | Yes | Main identifier |
| Creator | Yes | User who created the transmittal |
| To | No | Primary recipient(s) |
| Date | Yes | Transmittal date |
| Status | Yes | Draft, Sent, Received, Closed (inferred) |
| Private | No | Boolean indicator |
| Attachments | No | Count or indicator |

Column display is user-customizable (show/hide). Column widths are resizable per user preference.

---

### Statuses

Statuses were not confirmed from crawl data. Industry-standard values for construction transmittals:

- Draft
- Sent
- Received
- Closed

**Action required:** Confirm actual Procore status values before implementing.

---

### Permissions Matrix

Permission levels: **None, Read Only, Standard, Admin**

| Action | None | Read Only | Standard | Admin |
|--------|------|-----------|----------|-------|
| Add Items to a Transmittal | — | — | Yes | Yes |
| Add Related Items to a Transmittal | — | — | Yes | Yes |
| Configure Advanced Settings: Transmittals | — | — | — | Yes |
| Create a Transmittal | — | — | Yes | Yes |
| Customize Column Display | — | — | Yes | Yes |
| Delete a Transmittal | — | — | — | Yes |
| Edit a Transmittal You Created | — | — | Yes | Yes |
| Edit Any Transmittal | — | — | — | Yes |
| Export Transmittal Letter to PDF | — | — | Yes | Yes |
| Export Transmittal Log to CSV | — | — | Yes | Yes |
| Export Transmittal Log to PDF | — | — | Yes | Yes |
| Forward a Transmittal by Email | — | — | Yes | Yes |
| Resize Column Width in Log | — | — | Yes | Yes |
| Retrieve from Recycle Bin | — | — | — | Yes |
| Search Transmittals | — | Yes | Yes | Yes |
| View a Transmittal (Not Private) | — | Yes | Yes | Yes |
| View a Transmittal (Private) | — | Conditional | Conditional | Yes |
| View Private Transmittals (Same Company) | — | Granular | Granular | Granular |
| View Email Correspondence | — | — | Yes | Yes |

**Conditional access for private transmittals (Read Only / Standard):**
User must also be the transmittal's Creator, or listed in the To or CC field.

**Granular permission:** "View Private Transmittals Associated to Users within Same Company"
Requires user or someone at their company to be the Creator, or listed in To or CC.

---

### Export Formats

| Format | Scope | Notes |
|--------|-------|-------|
| PDF Letter | Single transmittal | "letter size" format — individual transmittal document |
| PDF Log | All transmittals | The full transmittals log as a PDF |
| CSV Log | All transmittals | The full transmittals log as a CSV |

Export is triggered from the Export dropdown on the list toolbar.

---

### Email Functionality

- **Forward by Email:** Any transmittal can be forwarded via email to external parties
- **Email Correspondence View:** A dedicated view shows the email correspondence history for each transmittal
- **Download Link Expiry:** Procore email download links expire (duration not specified in crawl data)
- **Email client:** Uses the user's browser default email client for `mailto:` links (FAQ topic confirmed)

---

### Recycle Bin

- Soft delete pattern — deleted transmittals go to Recycle Bin, not permanently removed
- **Restore permission:** Admin only
- Accessed via "Recycle Bin" tab in the main transmittals navigation

---

### Related Items

- Transmittals support cross-tool linking to any Procore item
- This is a general Procore concept (FAQ: "What are related items in Procore?")
- Tutorial exists: "Add a Related Item to a Transmittal"

---

### Tutorials Inventory (17 total)

These represent the complete feature surface Procore supports for Transmittals:

1. Add a Related Item to a Transmittal
2. Add Items to a Transmittal
3. Configure Advanced Settings: Transmittals
4. Create a Transmittal
5. Customize the Column Display in the Transmittals Tool
6. Delete a Transmittal
7. Edit a Transmittal
8. Export a Transmittal Letter to PDF
9. Export the Transmittals Log to CSV
10. Export the Transmittals Log to PDF
11. Forward a Transmittal by Email
12. Navigate Procore's Tools
13. Resize Column Width in the Transmittals Log
14. Retrieve a Transmittal from the Recycle Bin
15. Search for Transmittals
16. View a Transmittal
17. View the Email Correspondence for a Transmittal

---

### FAQ Topics (12 total)

1. How can I troubleshoot an issue with the Procore Web Application?
2. How do I attach multiple files at once to a transmittal?
3. How do I change my web browser's default email client for mailto links?
4. How do I filter items by multi-tiered locations?
5. What are related items in Procore?
6. What granular permissions are available for the project's Transmittals tool?
7. What is a transmittal in Procore?
8. What is Procore's Recycle Bin?
9. What is the difference between a distribution group and distribution list in Procore?
10. When do the download links in emails sent from Procore expire?
11. Which Microsoft Excel file versions can be attached to items in Procore?
12. Which Procore tools support granular permissions?

---

## What Alleato Currently Has

| Layer | Status |
|-------|--------|
| Frontend route | Exists — placeholder "Coming soon" page |
| Database tables | None |
| Supabase migrations | None |
| API routes | None |
| React Query hooks | None |
| Services | None |
| Navigation registration | Complete (7 files) |
| Page header / layout | Correct pattern used (ProjectPageHeader + PageContainer) |

**Navigation files that register Transmittals:**
- `frontend/src/lib/menu-list.ts`
- `frontend/src/lib/navigation-config.ts`
- `frontend/src/components/misc/app-sidebar.tsx`
- `frontend/src/components/misc/simplified-header.tsx`
- `frontend/src/components/header/tools-dropdown-variants.tsx`
- `frontend/src/components/header/mega-menu-panel.tsx`
- `frontend/src/components/domain/users/UserPermissionsManager.tsx`

---

## Gap Analysis — What Needs to Be Built

### Database Schema

The following tables need to be created:

**`transmittals`** (core record)
- `id` (PK)
- `project_id` (FK → projects)
- `number` (integer, auto-incremented per project or manual)
- `title` / `subject` (text)
- `description` / `body` (rich text)
- `date` (date)
- `status` (enum: Draft, Sent, Received, Closed — confirm values)
- `is_private` (boolean, defaults from project setting)
- `creator_id` (FK → users)
- `location_id` (FK → locations, nullable)
- `created_at`, `updated_at`

**`transmittal_recipients`** (To / CC recipients)
- `id` (PK)
- `transmittal_id` (FK → transmittals)
- `user_id` (FK → users)
- `role` (enum: to, cc, distribution)

**`transmittal_items`** (file attachments)
- `id` (PK)
- `transmittal_id` (FK → transmittals)
- `file_name`, `file_url`, `file_size`, `content_type`
- `uploaded_by` (FK → users)
- `created_at`

**`transmittal_related_items`** (cross-tool links)
- `id` (PK)
- `transmittal_id` (FK → transmittals)
- `item_type` (e.g., 'rfi', 'submittal', 'drawing')
- `item_id` (FK to corresponding table)

**`transmittal_settings`** (per-project configuration)
- `project_id` (PK, FK → projects)
- `private_by_default` (boolean, default false)

**`transmittal_distribution_defaults`** (project-level default distribution)
- `project_id` (FK → projects)
- `user_id` (FK → users)

**`transmittal_email_log`** (email correspondence tracking)
- `id` (PK)
- `transmittal_id` (FK → transmittals)
- `sent_at`, `sent_by`, `recipients`, `subject`, `body`

### API Routes

All under `/api/projects/[projectId]/transmittals/`:

| Method | Path | Action |
|--------|------|--------|
| GET | `/` | List transmittals (with filters, sort, pagination) |
| POST | `/` | Create transmittal |
| GET | `/:transmittalId` | Get single transmittal |
| PUT | `/:transmittalId` | Update transmittal |
| DELETE | `/:transmittalId` | Soft-delete transmittal (Admin only) |
| POST | `/:transmittalId/restore` | Restore from recycle bin (Admin only) |
| GET | `/recycle-bin` | List deleted transmittals |
| GET | `/export` | Export log (PDF or CSV) |
| POST | `/:transmittalId/forward` | Forward by email |
| GET | `/:transmittalId/email-log` | View email correspondence |
| GET | `/settings` | Get project transmittal settings |
| PUT | `/settings` | Update project transmittal settings |

### Frontend Pages

| Page | Route | Priority |
|------|-------|----------|
| Transmittals log (list) | `/[projectId]/transmittals` | P0 |
| Create transmittal (sheet/modal) | in-page overlay | P0 |
| View transmittal (detail) | `/[projectId]/transmittals/[transmittalId]` | P0 |
| Edit transmittal | in-page overlay or same as view | P1 |
| Recycle bin | `/[projectId]/transmittals/recycle-bin` | P2 |
| Configure settings | `/[projectId]/transmittals/settings` | P2 |

### React Query Hooks

- `useTransmittals(projectId, filters)` — list with pagination
- `useTransmittal(projectId, transmittalId)` — single record
- `useCreateTransmittal()` — mutation
- `useUpdateTransmittal()` — mutation
- `useDeleteTransmittal()` — mutation (Admin)
- `useRestoreTransmittal()` — mutation (Admin)
- `useTransmittalSettings(projectId)` — project settings
- `useUpdateTransmittalSettings()` — mutation (Admin)

### Permissions to Enforce

| Gate | Who | Notes |
|------|-----|-------|
| View (not private) | Read Only+ | No special condition |
| View (private) | Admin OR (Read Only/Standard if Creator or in To/CC) | Conditional |
| Create | Standard+ | |
| Edit own | Standard+ | Only transmittals they created |
| Edit any | Admin only | |
| Delete | Admin only | Soft delete |
| Restore from bin | Admin only | |
| Configure settings | Admin only | |
| Export | Standard+ | All three export formats |
| Forward by email | Standard+ | |
| View email log | Standard+ | |

### Features Requiring Special Implementation

1. **Privacy system:** Per-transmittal privacy flag + project-level default setting. Must filter list view based on user's role and relationship to the transmittal (creator, To, CC, or admin).

2. **Distribution groups vs. lists:** Project-level default distribution auto-populates new transmittals but is separate from the per-transmittal distribution list.

3. **Multi-file attachments:** The FAQ explicitly confirms multiple files can be attached at once.

4. **Multi-tiered location picker:** Locations with parent-child hierarchy for filtering.

5. **Cross-tool related items:** Linking transmittals to RFIs, submittals, drawings, etc.

6. **Email forwarding with expiring download links:** Transmittals can be forwarded by email; download links expire.

7. **Email correspondence view:** Track all emails sent/received for a transmittal.

8. **Column customization:** Users can show/hide and resize columns. This preference is likely per-user or per-project.

9. **Export:** Three distinct export formats — individual transmittal PDF (letter format), full log PDF, full log CSV.

10. **Soft delete + recycle bin:** Admin-only restore.

---

## Build Priority Recommendation

### Phase 1 — Core (MVP)
- Database schema: `transmittals`, `transmittal_recipients`, `transmittal_items`
- API: CRUD routes for transmittals
- UI: List page, create/view sheet, basic privacy flag
- Permissions: Create, view (public), edit own

### Phase 2 — Full Feature Parity
- Recycle bin + soft delete + restore
- Export: PDF letter, PDF log, CSV log
- Email forwarding
- Configure settings (private by default, default distribution)
- Column customization

### Phase 3 — Advanced
- Related items (cross-tool linking)
- Email correspondence tracking
- Multi-tiered location filtering
- Granular permissions (same-company private access)

---

## Open Questions

1. What are the confirmed status values for transmittals in Procore? (Draft, Sent, Received, Closed assumed — not confirmed from crawl.)
2. Does Alleato need email forwarding in Phase 1 or can it wait?
3. Should column preferences be stored per-user or per-project?
4. Is multi-tiered location filtering required for MVP or Phase 3?
5. Should the create form be a sheet/slideover or a full page?
6. What file storage solution will be used for transmittal attachments? (Supabase Storage assumed.)

---

*This report was generated from existing crawl data in `procore-crawls/procore-crawl-outputs/transmittals/`. The create form (404 during crawl) and several pages were not directly crawled — those sections are marked as inferred.*
