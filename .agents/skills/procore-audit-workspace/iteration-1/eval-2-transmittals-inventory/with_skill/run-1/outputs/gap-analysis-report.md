# Transmittals — Procore vs. Alleato Gap Analysis

**Generated:** 2026-03-08
**Procore crawl:** `_bmad-output/planning-artifacts/transmittals/crawl/`
**Alleato path:** `frontend/src/app/(main)/[projectId]/transmittals/`

---

## Executive Summary

| Category | Status | Details |
|----------|--------|---------|
| **Pages** | ❌ | 1/6 pages exist (17%) — only stub placeholder |
| **List Table Columns** | ❌ | 0/8 columns implemented (0%) |
| **Form Fields** | ❌ | 0/20+ fields implemented (0%) |
| **Status Workflow** | ❌ | Not implemented |
| **CRUD Operations** | ❌ | 0/5 operations implemented |
| **Database Schema** | ❌ | No transmittals table exists |
| **Validations** | ❌ | Not implemented |
| **Settings/Config** | ❌ | Not implemented |
| **Recycle Bin** | ❌ | Not implemented |
| **Email/Distribution** | ❌ | Not implemented |
| **Related Items** | ❌ | Not implemented |
| **Export** | ❌ | Not implemented |

**Overall Verdict: NOT STARTED — approximately 2% complete**

Only a stub placeholder page exists. No database schema, API routes, hooks, services, or real components have been built.

---

## Page-by-Page Comparison

| Procore Page | Alleato Route | Status | Notes |
|-------------|---------------|--------|-------|
| List view (Items tab) | `/[projectId]/transmittals` | ⚠️ | Stub placeholder only — renders "Coming soon" |
| Recycle Bin tab | `/[projectId]/transmittals/recycle-bin` | ❌ | Not implemented |
| Create transmittal form | `/[projectId]/transmittals/new` | ❌ | Not implemented |
| Detail / view transmittal | `/[projectId]/transmittals/[transmittalId]` | ❌ | Not implemented |
| Edit transmittal | `/[projectId]/transmittals/[transmittalId]/edit` | ❌ | Not implemented |
| Settings (configure) | `/[projectId]/transmittals/settings` | ❌ | Not implemented |

---

## List View: Table Column Comparison

The Procore transmittals list supports customizable column display. The standard/default columns visible in the log are:

| Procore Column | Alleato Column | Status | Impact |
|---------------|---------------|--------|--------|
| Number (`#`) | — | ❌ | HIGH |
| Subject / Title | — | ❌ | HIGH |
| Status | — | ❌ | HIGH |
| From (sender) | — | ❌ | HIGH |
| To (recipient(s)) | — | ❌ | HIGH |
| Date Sent | — | ❌ | HIGH |
| Date Received | — | ❌ | MEDIUM |
| Private (flag) | — | ❌ | MEDIUM |

Additional columns available via column customization:
- Cc (carbon copy recipients)
- Method (delivery method)
- Received (confirmed receipt)
- Items (count of attached items)
- Related Items (count of linked items)

---

## Create / Edit Form Field Comparison

Based on Procore's documented transmittal creation workflow:

### Header / Identification Fields

| Procore Field | Type | Required | Alleato Field | Status | Impact |
|--------------|------|----------|--------------|--------|--------|
| Number | text (auto-generated) | Yes | — | ❌ | HIGH |
| Subject | text | Yes | — | ❌ | HIGH |
| From | contact picker | Yes | — | ❌ | HIGH |
| To | multi-contact picker | Yes | — | ❌ | HIGH |
| Cc | multi-contact picker | No | — | ❌ | MEDIUM |
| Date Sent | date | Yes | — | ❌ | HIGH |
| Date Received | date | No | — | ❌ | MEDIUM |
| Method | select (Courier, Email, Fax, Hand, Mail, Other) | No | — | ❌ | MEDIUM |
| Private | checkbox | No | — | ❌ | MEDIUM |
| Received | checkbox | No | — | ❌ | LOW |

### Content Fields

| Procore Field | Type | Required | Alleato Field | Status | Impact |
|--------------|------|----------|--------------|--------|--------|
| Description / Body | rich text / textarea | No | — | ❌ | HIGH |
| Attachments | file upload (multi) | No | — | ❌ | HIGH |

### Items Section

| Procore Field | Type | Required | Alleato Field | Status | Impact |
|--------------|------|----------|--------------|--------|--------|
| Items | linked records (Submittals, RFIs, Drawings, etc.) | No | — | ❌ | HIGH |
| Related Items | linked records (cross-tool references) | No | — | ❌ | MEDIUM |

### Distribution

| Procore Field | Type | Required | Alleato Field | Status | Impact |
|--------------|------|----------|--------------|--------|--------|
| Distribution List | multi-contact picker | No | — | ❌ | MEDIUM |

---

## Missing Functionality

### HIGH Impact (blocks core workflows)

- [ ] **Database schema** — create `transmittals` table with all required columns
- [ ] **List view** — replace stub with real transmittals data table with standard columns (Number, Subject, Status, From, To, Date Sent)
- [ ] **Create transmittal form** — full form with all header fields (Number, Subject, From, To, Date Sent, Description, Attachments)
- [ ] **View transmittal detail page** — read-only view of transmittal with all sections
- [ ] **Edit transmittal** — edit form for transmittals the user created
- [ ] **Delete transmittal** — move to Recycle Bin (soft delete)
- [ ] **API routes** — CRUD endpoints at `api/projects/[projectId]/transmittals/`
- [ ] **React Query hooks** — `use-transmittals.ts` for list/create/update/delete
- [ ] **Auto-numbering** — transmittals are numbered sequentially within a project
- [ ] **Attachments / file upload** — multi-file attachments per transmittal
- [ ] **Items section** — link documents, submittals, RFIs, drawings to a transmittal
- [ ] **To / From contact pickers** — link to project directory contacts

### MEDIUM Impact (reduces functionality)

- [ ] **Recycle Bin tab** — soft-delete + recovery workflow
- [ ] **Private transmittals** — visibility flag (Private checkbox + permission-based filtering)
- [ ] **Distribution list** — Cc/distribution field with project contacts
- [ ] **Related Items** — cross-tool references (link to RFIs, submittals, etc.)
- [ ] **Export to CSV** — export transmittals log as CSV
- [ ] **Export to PDF (log)** — export full transmittals log as PDF
- [ ] **Export to PDF (letter)** — export individual transmittal as PDF letter
- [ ] **Forward by Email** — send transmittal via email to recipients
- [ ] **Email correspondence view** — view email thread for a transmittal
- [ ] **Date Received field** — track when transmittal was received
- [ ] **Method field** — delivery method (Courier, Email, Fax, Hand, Mail, Other)
- [ ] **Search** — full-text search across transmittals

### LOW Impact (nice to have)

- [ ] **Transmittals Settings page** — "Private by Default" toggle + Default Distribution list
- [ ] **Column customization** — allow users to show/hide columns in the list view
- [ ] **Column resizing** — drag to resize column widths
- [ ] **Received checkbox** — confirm receipt toggle
- [ ] **Sort by any column** — sort ascending/descending on all list columns

---

## Status / Workflow Comparison

Procore Transmittals does not use a traditional approval workflow with Approve/Reject statuses. Instead, the status typically tracks delivery confirmation:

| Procore Status | Alleato Status | Implemented |
|---------------|---------------|-------------|
| (No status field found — transmittals track delivery via "Received" checkbox and date fields) | — | ❌ |

Note: Procore transmittals use a simpler model than RFIs or Submittals — they are correspondence records rather than approval workflows. The "status" is primarily conveyed by whether the transmittal has been received (date received set + "Received" checkbox).

---

## CRUD Operations Comparison

| Operation | Procore | Alleato | Status |
|-----------|---------|---------|--------|
| Create | Yes (Admin + Standard) | No | ❌ |
| Read / View (public) | Yes (Read Only+) | No | ❌ |
| Read / View (private) | Yes (Admin only, or same company) | No | ❌ |
| Update / Edit (own) | Yes (Standard+, own records) | No | ❌ |
| Update / Edit (any) | Yes (Admin only) | No | ❌ |
| Delete (soft) | Yes (moves to Recycle Bin) | No | ❌ |
| Restore from Recycle Bin | Yes (Standard+) | No | ❌ |

---

## Permission Matrix (from Procore)

| Action | None | Read Only | Standard | Admin |
|--------|------|-----------|----------|-------|
| Add Items to a Transmittal | No | No | Yes* | Yes |
| Add Related Items | No | No | Yes* | Yes |
| Configure Advanced Settings | No | No | No | Yes |
| Create a Transmittal | No | No | Yes | Yes |
| Customize Column Display | No | No | Yes | Yes |
| Delete a Transmittal | No | No | Yes* | Yes |
| Edit a Transmittal You Created | No | No | Yes | Yes |
| Edit Any Transmittal | No | No | No | Yes |
| Export Log to CSV | No | Yes* | Yes* | Yes |
| Export Log to PDF | No | Yes* | Yes* | Yes |
| Export Transmittal Letter to PDF | No | Yes* | Yes* | Yes |
| Forward a Transmittal by Email | No | No | Yes* | Yes |
| Resize Column Width | No | No | Yes | Yes |
| Retrieve from Recycle Bin | No | No | Yes | Yes |
| Search Transmittals | No | Yes* | Yes* | Yes |
| View a Transmittal (Not Private) | No | Yes* | Yes* | Yes |
| View a Transmittal (Private) | No | No | No | Yes |
| View Private (Same Company) | No | No | No | Yes |
| View Email Correspondence | No | No | Yes* | Yes |

*Read Only and Standard must also be the Creator or listed in To/Cc fields for some actions.

**Alleato Implementation of Permissions:** ❌ None — no permission model for transmittals exists.

---

## Database Schema Gaps

The following table and columns need to be created:

### `transmittals` table (does not exist)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint/uuid | Yes | Primary key |
| `project_id` | integer | Yes | FK to `projects.id` |
| `number` | integer | Yes | Auto-incremented within project |
| `subject` | text | Yes | Transmittal title/subject |
| `description` | text | No | Body/notes |
| `from_contact_id` | integer | No | FK to contacts/users |
| `to_contacts` | jsonb or relation | Yes | Array of contact references |
| `cc_contacts` | jsonb or relation | No | Carbon copy contacts |
| `distribution_contacts` | jsonb or relation | No | Distribution list |
| `date_sent` | date | Yes | Date transmittal was sent |
| `date_received` | date | No | Date transmittal was received |
| `method` | text | No | Enum: Courier, Email, Fax, Hand, Mail, Other |
| `is_private` | boolean | No | Default false (or project setting) |
| `received` | boolean | No | Confirmed receipt flag |
| `created_by` | uuid | Yes | FK to auth.users |
| `created_at` | timestamptz | Yes | |
| `updated_at` | timestamptz | Yes | |
| `deleted_at` | timestamptz | No | Soft delete for Recycle Bin |

### `transmittal_items` table (does not exist)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint | Yes | Primary key |
| `transmittal_id` | bigint | Yes | FK to `transmittals.id` |
| `item_type` | text | Yes | Type: submittal, rfi, drawing, document, etc. |
| `item_id` | bigint | No | FK to the referenced record |
| `description` | text | No | Item description |
| `revision` | text | No | Revision/version reference |
| `copies_sent` | integer | No | Number of copies |

### `transmittal_attachments` table (does not exist)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint | Yes | Primary key |
| `transmittal_id` | bigint | Yes | FK to `transmittals.id` |
| `file_name` | text | Yes | Original file name |
| `file_path` | text | Yes | Storage path |
| `file_size` | bigint | No | File size in bytes |
| `created_at` | timestamptz | Yes | |

---

## Settings Gap

| Procore Setting | Description | Alleato | Status |
|----------------|-------------|---------|--------|
| Transmittals Private by Default | Checkbox — makes all new transmittals private | — | ❌ |
| Default Distribution | Pre-populate distribution list for new transmittals | — | ❌ |

---

## Crawl Data Notes

The crawl captured the following pages relevant to transmittals:

| Page | URL | Data Quality |
|------|-----|-------------|
| List view | `/transmittals/list` | Empty state only — no column headers visible |
| Configure (Transmittal Settings tab) | `/transmittals/configure_tab` | Settings form found: 1 form, 9 inputs, 1 table |
| Configure Advanced Settings (support doc) | Procore support site | Settings documented: Private by Default, Default Distribution |
| Tutorials (support doc) | Procore support site | Full list of 17 features/operations |
| Permissions (support doc) | Procore support site | Complete permission matrix |
| FAQ (support doc) | Procore support site | Feature details: related items, multi-file, distribution groups |
| Create form | `/transmittals/new` | 404 — not captured |
| Detail/view page | Not visited | No individual transmittal records existed |

**Crawl limitation:** The test project had no existing transmittals, so the list was empty and no column headers, detail pages, or form pre-fills were visible. Form fields documented above are synthesized from Procore support documentation.
