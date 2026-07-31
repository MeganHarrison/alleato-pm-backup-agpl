# Submittals Feature Parity Gap Analysis
## Alleato PM vs. Procore

**Date:** 2026-03-08
**Methodology:** Static codebase analysis using Procore crawl spec data + Alleato implementation files
**Scope:** Create/edit forms, list view, detail view, commands, filters

---

## Executive Summary

The Alleato submittals implementation has a significant parity gap relative to Procore. The backend schema and API layer are well-prepared, but the **create/edit form UI is missing 11 of Procore's fields**, has 4 incorrect widget types, and is absent the "Update & Send Emails" secondary action. Feature-level operations (create revision, duplicate, redistribute, file export, bulk actions) are entirely unimplemented.

| Category | Procore | Alleato | Status |
|----------|---------|---------|--------|
| Form fields (total) | 24 | 13 | CRITICAL GAP |
| Form fields (missing) | — | 11 missing | CRITICAL |
| Form fields (wrong widget) | — | 4 wrong | HIGH |
| Required fields missing | — | 1 (submittal_manager_id) | CRITICAL |
| List filters | 11 | 3 | HIGH |
| List columns | 12 | 12 defined | OK (data gap) |
| Detail view tabs | 4 | 4 (wrong set) | MEDIUM |
| Domain commands | 24 | 4 | HIGH |
| File export options | 3 (PDF/CSV/Excel) | 0 | HIGH |

---

## Section 1: Create / Edit Form Field Parity

### 1.1 General Information Section

| Field | Procore | Alleato | Status | Notes |
|-------|---------|---------|--------|-------|
| title | Required, text input | text input | PASS | Required in both |
| number / submittal_number | Required, text input | text input | PASS | Field renamed `submittal_number` in Alleato |
| revision | Required, default "0" | number input, default 0 | PASS | |
| specification_section | Searchable dropdown (CSI spec) | Plain `<Input>` text field | WIDGET MISMATCH | Should be searchable dropdown linked to spec sections |
| submittal_type | Dropdown (e.g., "Product Information") | Plain `<Input>` text field | WIDGET MISMATCH | Should be predefined-option dropdown |
| status | Dropdown (Draft/Open/Distributed/Closed) | `<Select>` dropdown | PASS | Correct widget, correct options |
| submittal_package_id | Dropdown (FK to packages) | NOT PRESENT | MISSING | |
| responsible_contractor_id | Searchable dropdown (company) | NOT PRESENT | MISSING | |
| received_from_id | Searchable dropdown (contact) | NOT PRESENT | MISSING | |
| submittal_manager_id | Required, searchable dropdown (contact) | NOT PRESENT | CRITICAL MISSING | Marked required in Procore |
| final_due_date | Date display (read-only on form) | Date input | PARTIAL | Alleato makes it editable; Procore shows read-only on form |
| cost_code_id | Searchable dropdown | NOT PRESENT | MISSING | |
| location_id | Searchable dropdown | NOT PRESENT | MISSING | |
| linked_drawings | Multi-select (links to drawings) | NOT PRESENT | MISSING | |
| division | NOT in Procore's edit form | text input present | EXTRA | Extra field in Alleato not shown in Procore form |

### 1.2 Distribution & Scheduling Section

| Field | Procore | Alleato | Status | Notes |
|-------|---------|---------|--------|-------|
| distribution_list | Multi-select contacts (tag chips) | NOT PRESENT | MISSING | Shown as "Distribution History" display only in detail view |
| ball_in_court | Display/computed field | Editable text input | WIDGET MISMATCH | Should show current responsible party (computed), not be user-editable |
| lead_time | Number input + "day(s)" suffix | Number input | PARTIAL | Missing "day(s)" unit label |
| required_on_site_date | Date picker (Month/Day/Year) | Date input | PASS | |

### 1.3 Content Section

| Field | Procore | Alleato | Status | Notes |
|-------|---------|---------|--------|-------|
| is_private | Checkbox | Checkbox | PASS | |
| description | Rich text editor (Bold, Italic, Underline, Strikethrough, alignment, lists, indent, tables, font size, colors, undo/redo) | Basic `<Textarea>` | WIDGET MISMATCH | No formatting toolbar; required field in Procore |
| attachments | File upload area (drag-and-drop, "Attach Files" button) | NOT PRESENT | MISSING | |

### 1.4 Workflow Section

| Field | Procore | Alleato | Status | Notes |
|-------|---------|---------|--------|-------|
| workflow_template | Dropdown (pre-defined templates) | NOT PRESENT | MISSING | |
| workflow_steps | Step builder ("Add Step" button) | NOT PRESENT | MISSING | Detail view shows responses but no step builder |

### 1.5 Form Action Buttons

| Button | Procore | Alleato | Status |
|--------|---------|---------|--------|
| Cancel | Present | Present | PASS |
| Update / Submit | Primary orange button | Primary button | PASS |
| Update & Send Emails | Secondary button (saves + sends emails) | NOT PRESENT | MISSING |
| Delete | Trash icon, top-right corner | Present (in detail view actions menu) | PARTIAL |

---

## Section 2: Missing Form Fields Summary

The following **11 fields** are present in Procore's create/edit form but entirely absent from Alleato's `SubmittalFormDialog`:

1. `submittal_package_id` — Submittal Package (dropdown, FK)
2. `responsible_contractor_id` — Responsible Contractor (searchable company dropdown, FK)
3. `received_from_id` — Received From (searchable contact dropdown, FK)
4. `submittal_manager_id` — Submittal Manager **(REQUIRED in Procore)** (searchable contact dropdown, FK)
5. `cost_code_id` — Cost Code (searchable dropdown, FK)
6. `location_id` — Location (searchable dropdown, FK)
7. `linked_drawings` — Linked Drawings (multi-select)
8. `distribution_list` — Distribution List (multi-select contacts with tag chips)
9. `attachments` — File attachments (drag-and-drop upload zone)
10. `workflow_template` — Workflow Template (dropdown)
11. `workflow_steps` — Workflow Steps (step builder UI)

**Backend readiness note:** The Supabase database schema, API route (`/api/projects/[projectId]/submittals/`), and React Query hook types (`use-submittals.ts`) already support FK fields (items 1–7). The gap is purely in the frontend form UI. Items 8–11 require additional UI and potentially backend work.

---

## Section 3: Widget Type Mismatches

The following **4 fields** exist in both implementations but use the wrong widget type in Alleato:

| Field | Procore Widget | Alleato Widget | Required Change |
|-------|---------------|----------------|-----------------|
| `specification_section` | Searchable dropdown (type-ahead, CSI spec codes) | Plain `<Input>` text field | Replace with searchable `<Combobox>` linked to spec sections data |
| `submittal_type` | Dropdown with predefined options (e.g., "Product Information") | Plain `<Input>` text field | Replace with `<Select>` with predefined type options |
| `description` | Rich text editor (full formatting toolbar) | Basic `<Textarea>` | Replace with rich text editor (e.g., Tiptap, Quill, or similar) |
| `ball_in_court` | Computed display field (read-only, shows current responsible party) | Editable `<Input>` text field | Convert to read-only display; value should be computed from workflow state |

---

## Section 4: List View Parity

### 4.1 Table Columns

| Column | Procore | Alleato | Status |
|--------|---------|---------|--------|
| Spec (specification_section) | Present | Present | PASS |
| # (submittal_number) | Present | Present | PASS |
| Rev. (revision) | Present | Present | PASS |
| Title | Present | Present | PASS |
| Type (submittal_type) | Present | Present | PASS |
| Status | Present | Present | PASS |
| Responsible C. | Present | Present (always null) | DATA GAP |
| Received From | Present | Present (always null) | DATA GAP |
| Ball In Court | Present | Present | PASS |
| Approvers | Present | Present | PASS |
| Response | Present | Present | PASS |
| Sent Date | Present | Present | PASS |

**Data gap note:** `responsible_contractor` and `received_from` columns are defined in `submittals-table-config.tsx` but always render `null` in list results because the list API query does not join or resolve the FK values from the companies/contacts tables.

### 4.2 Filters

| Filter | Procore | Alleato | Status |
|--------|---------|---------|--------|
| Approver | Present | NOT PRESENT | MISSING |
| Ball In Court | Present | NOT PRESENT | MISSING |
| Created By | Present | NOT PRESENT | MISSING |
| Current Revision | Present | NOT PRESENT | MISSING |
| Division | Present | Present | PASS |
| Location | Present | NOT PRESENT | MISSING |
| Number | Present | NOT PRESENT | MISSING |
| Private | Present | NOT PRESENT | MISSING |
| Received From | Present | NOT PRESENT | MISSING |
| Response | Present | Present | PASS |
| Responsible Contractor | Present | NOT PRESENT | MISSING |
| Status | NOT in Procore filter list | Present | EXTRA |

**Summary:** Alleato has 3 filters (status, response, division) vs Procore's 11 filters. 8 filters are missing.

---

## Section 5: List View Tabs

| Tab | Procore | Alleato | Status |
|-----|---------|---------|--------|
| Items (default) | Present | Present | PASS |
| Packages | Present | Present (Coming Soon) | PARTIAL |
| Spec Sections | Present | Present (Coming Soon) | PARTIAL |
| Ball In Court | Present | Present | PASS |
| Recycle Bin | Present | Present | PASS |

---

## Section 6: Detail View Parity

### 6.1 Detail View Tabs

| Tab | Procore | Alleato | Status |
|-----|---------|---------|--------|
| General | Present (distribution summary, description, workflow responses) | Present | PASS |
| Workflow | NOT a separate tab (part of General) | Separate "Workflow" tab | EXTRA/DIFFERENT |
| Related Items | Present | Present | PASS |
| Emails | Present | NOT PRESENT | MISSING |
| Change History | Present (23 entries shown) | Present | PASS |

### 6.2 General Tab Content

| Element | Procore | Alleato | Status |
|---------|---------|---------|--------|
| Distribution From/To/Message | Present | Present (read-only display) | PASS |
| Distribution attachments | Present | PARTIAL (no file attachments on distributions) | PARTIAL |
| Description (rich text rendered) | Present | Present (plain text) | PARTIAL |
| Workflow Responses section | Present (approver + response status + comments + attachments) | Present | PASS |

---

## Section 7: Domain Commands / Actions Parity

| Command | Procore | Alleato | Status |
|---------|---------|---------|--------|
| Create Submittal | Present | Present | PASS |
| Edit Submittal | Present | Present | PASS |
| Update Submittal | Present | Present | PASS |
| Update & Send Emails | Present | NOT PRESENT | MISSING |
| Delete Submittal (soft) | Present | Present | PASS |
| Create Revision | Present | NOT PRESENT | MISSING |
| Duplicate Submittal | Present | NOT PRESENT | MISSING |
| Redistribute | Present | NOT PRESENT | MISSING |
| Add Workflow Step | Present | NOT PRESENT | MISSING |
| Email Submittal | Present | NOT PRESENT | MISSING |
| Create Submittal Package | Present | NOT PRESENT | MISSING |
| Bulk Actions | Present | NOT PRESENT | MISSING |
| Export PDF | Present | NOT PRESENT | MISSING |
| Export CSV | Present | NOT PRESENT | MISSING |
| Export Excel | Present | NOT PRESENT | MISSING |
| Report: Approvers Response Time | Present | NOT PRESENT | MISSING |
| View Recycle Bin | Present | Present | PASS |

---

## Section 8: Prioritized Remediation Roadmap

### Priority 1 — CRITICAL (Blocks Release)

These gaps prevent the feature from being functionally equivalent to Procore for basic workflows:

1. **Add `submittal_manager_id` field to the create/edit form** (marked required in Procore; backend supports it)
2. **Add `distribution_list` field to the create/edit form** (multi-select contacts with tag chip UI)
3. **Add `responsible_contractor_id` field to form** (searchable company dropdown)
4. **Add `received_from_id` field to form** (searchable contact dropdown)
5. **Fix `specification_section` widget** — replace plain text input with searchable combobox
6. **Fix `description` widget** — replace basic textarea with rich text editor

### Priority 2 — HIGH (Significant Functional Gap)

7. **Add `submittal_package_id` field to form** (dropdown FK)
8. **Add `cost_code_id` field to form** (searchable dropdown FK)
9. **Add `location_id` field to form** (searchable dropdown FK)
10. **Fix `submittal_type` widget** — replace plain text with predefined options dropdown
11. **Fix `ball_in_court`** — make computed/read-only, remove editable input
12. **Add file attachments upload** to form (drag-and-drop zone)
13. **Add "Update & Send Emails" secondary action** button to form
14. **Fix responsible_contractor / received_from list columns** — resolve FK values from companies/contacts in list API query
15. **Add 8 missing filters** (Approver, Ball In Court, Created By, Current Revision, Location, Number, Private, Received From, Responsible Contractor)

### Priority 3 — MEDIUM (Feature Completeness)

16. **Add `linked_drawings` multi-select field** to form
17. **Add Emails tab** to detail view
18. **Implement Packages tab** (currently "Coming Soon")
19. **Implement Spec Sections tab** (currently "Coming Soon")
20. **Add workflow step builder** to form (workflow_template dropdown + Add Step UI)

### Priority 4 — LOW (Nice to Have)

21. **Implement Create Revision** command
22. **Implement Duplicate Submittal** command
23. **Implement Redistribute** command
24. **Implement file exports** (PDF, CSV, Excel)
25. **Implement Bulk Actions**
26. **Implement Email Submittal** action
27. **Add Approvers Response Time report**

---

## Source Files Referenced

| File | Purpose |
|------|---------|
| `/procore-crawls/submittals/spec/FORMS.md` | Procore form field spec (source of truth) |
| `/procore-crawls/submittals/spec/COMMANDS.md` | Procore domain commands |
| `/procore-crawls/submittals/spec/MUTATIONS.md` | Procore mutations and state machine |
| `/procore-crawls/submittals/spec/schema.sql` | Target database schema (8 tables) |
| `/frontend/src/features/submittals/submittal-form-dialog.tsx` | Alleato create/edit form |
| `/frontend/src/features/submittals/submittal-detail-client.tsx` | Alleato detail view |
| `/frontend/src/features/submittals/submittals-table-config.tsx` | Alleato list columns and filters |
| `/frontend/src/hooks/use-submittals.ts` | Alleato React Query hooks and type definitions |
| `/frontend/src/app/api/projects/[projectId]/submittals/route.ts` | Alleato API route (POST/GET) |
| `/frontend/src/app/(main)/[projectId]/submittals/page.tsx` | Alleato list page and tabs |
