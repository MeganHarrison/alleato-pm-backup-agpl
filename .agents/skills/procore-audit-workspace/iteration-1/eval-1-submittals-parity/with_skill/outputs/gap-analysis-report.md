# Submittals — Procore vs. Alleato Gap Analysis

**Generated:** 2026-03-08
**Procore crawl:** procore-crawls/submittals/spec/
**Alleato path:** frontend/src/app/(main)/[projectId]/submittals/
**Form component:** frontend/src/features/submittals/submittal-form-dialog.tsx
**Table config:** frontend/src/features/submittals/submittals-table-config.tsx

---

## Executive Summary

| Category | Status | Details |
|----------|--------|---------|
| **Pages** | ⚠️ | 2/3 pages implemented (67%) — create/edit is a dialog, detail exists, list exists; no standalone edit page |
| **List Table Columns** | ⚠️ | 12/12 columns defined (100%) but 4 return null data (no join in list query) |
| **Form Fields** | ❌ | 13/24 fields implemented (54%) — 11 FK/reference fields entirely absent from form |
| **Status Workflow** | ⚠️ | 4/4 statuses correct in API (Draft, Open, Distributed, Closed); legacy client uses wrong statuses |
| **CRUD Operations** | ⚠️ | Create/Read/Update/Delete exist; Revision, Duplicate, Redistribute, Email absent |
| **Database Schema** | ✅ | All 8 tables confirmed in generated types |
| **Filters** | ❌ | 3/11 filters implemented (27%) |
| **Validations** | ⚠️ | Required fields partially enforced (title, number, revision); submittal_manager_id (required in Procore) not validated |

**Overall Verdict: NEEDS SIGNIFICANT WORK — approximately 55% complete**

The API and database layers are well-built. The primary gaps are in the form UI (missing 11 reference/FK fields), the list query (4 columns return null), and workflow actions (create revision, duplicate, redistribute, email). Fixing the form dialog is the highest-priority work before release.

---

## Page-by-Page Comparison

| Procore Page | Alleato Route | Status | Notes |
|-------------|---------------|--------|-------|
| List view (Items tab) | /[projectId]/submittals | ✅ | Implemented with UnifiedTablePage |
| Packages tab | /[projectId]/submittals?tab=packages | ✅ | Tab exists, UI shows placeholder |
| Spec Sections tab | /[projectId]/submittals?tab=spec_sections | ✅ | Tab exists |
| Ball In Court tab | /[projectId]/submittals?tab=ball_in_court | ✅ | Tab exists |
| Recycle Bin tab | /[projectId]/submittals?tab=recycle_bin | ✅ | API supports deleted_at soft-delete filter |
| Detail view | /[projectId]/submittals/[submittalId] | ⚠️ | Exists but missing Emails tab; Workflow tab not in Procore |
| Create form | Dialog (no dedicated route) | ⚠️ | Exists but missing 11 fields |
| Edit form | Dialog (no dedicated route) | ⚠️ | Same dialog as create; same field gaps |

---

## Form Field Comparison (Create / Edit Submittal)

Source: `frontend/src/features/submittals/submittal-form-dialog.tsx`
Reference: `procore-crawls/submittals/spec/FORMS.md`

### General Information Section

| Procore Field | Type | Required | Alleato Field | Widget | Status | Impact |
|--------------|------|----------|--------------|--------|--------|--------|
| title | text | Yes | title | text input | ✅ | — |
| number | text | Yes | submittal_number | text input | ✅ | — |
| revision | integer | Yes | revision | number input | ✅ | — |
| specification_section | text (searchable dropdown) | No | specification_section | plain text Input | ⚠️ | MEDIUM — wrong widget, no autocomplete |
| submittal_type | dropdown | No | submittal_type | plain text Input | ⚠️ | MEDIUM — should use submittal_types table |
| submittal_package_id | reference (dropdown) | No | — | — | ❌ | HIGH — packages feature incomplete without this |
| responsible_contractor_id | reference (searchable, company) | No | — | — | ❌ | HIGH — key workflow field missing from form |
| received_from_id | reference (searchable, contact) | No | — | — | ❌ | HIGH — key workflow field missing from form |
| submittal_manager_id | reference (searchable, contact) | Yes* | — | — | ❌ | HIGH — REQUIRED in Procore, absent from form |
| status | dropdown | No | status | dropdown | ✅ | — |
| final_due_date | date (read-only display) | No | final_due_date | date input | ✅ | — |
| cost_code_id | reference (searchable) | No | — | — | ❌ | MEDIUM — financial classification missing |
| location_id | reference (searchable) | No | — | — | ❌ | MEDIUM — location context missing |
| linked_drawings | reference[] (multi-select) | No | — | — | ❌ | LOW — drawings integration not built |

### Distribution & Scheduling Section

| Procore Field | Type | Required | Alleato Field | Widget | Status | Impact |
|--------------|------|----------|--------------|--------|--------|--------|
| distribution_list | reference[] (tag chips) | No | — | — | ❌ | HIGH — core distribution workflow missing |
| ball_in_court | text (computed display) | No | ball_in_court | text input | ⚠️ | LOW — exists but editable (should be computed) |
| lead_time | integer (days) | No | lead_time | number input | ✅ | — |
| required_on_site_date | date | No | required_on_site_date | date input | ✅ | — |

### Content Section

| Procore Field | Type | Required | Alleato Field | Widget | Status | Impact |
|--------------|------|----------|--------------|--------|--------|--------|
| is_private | boolean (checkbox) | No | is_private | checkbox | ✅ | — |
| description | rich text editor | Yes* | description | plain Textarea | ⚠️ | MEDIUM — plain textarea vs rich text |
| attachments | file upload (drag-drop) | No | — | — | ❌ | HIGH — file attachment not in create/edit form |

### Workflow Section

| Procore Field | Type | Required | Alleato Field | Widget | Status | Impact |
|--------------|------|----------|--------------|--------|--------|--------|
| workflow_template | dropdown | No | — | — | ❌ | HIGH — cannot assign workflow on create |
| workflow_steps | step builder | No | — | — | ❌ | HIGH — workflow creation not in form |

### Form Action Buttons

| Procore Button | Alleato Button | Status | Notes |
|---------------|---------------|--------|-------|
| Cancel | Cancel | ✅ | — |
| Update | Save / Create Submittal | ✅ | Label differs but function correct |
| Update & Send Emails | — | ❌ | HIGH — distribution email trigger missing |
| Delete (trash icon, top-right) | Delete | ⚠️ | Exists in edit mode; not positioned the same |

### Extra Fields in Alleato (Not in Procore)

| Field | Notes |
|-------|-------|
| division | Extra field in Alleato form; Procore shows division as a filter only (derived from spec section) |
| priority | Present in API/types but not in the form dialog |

---

## Table Column Comparison (Items List)

Source: `frontend/src/features/submittals/submittals-table-config.tsx`
Reference: `procore-crawls/submittals/spec/COMMANDS.md`

| Procore Column | SQL Name | Alleato Column | Data Source | Status | Impact |
|---------------|----------|---------------|-------------|--------|--------|
| Spec | specification_section | specification_section | submittals.specification_section | ✅ | — |
| # | number | submittal_number | submittals.submittal_number | ✅ | — |
| Rev. | revision | revision | submittals.revision | ✅ | — |
| Title | title | title | submittals.title | ✅ | — |
| Type | submittal_type | submittal_type | submittals.submittal_type | ✅ | — |
| Status | status | status | submittals.status | ✅ | — |
| Responsible C. | responsible_contractor | responsible_contractor | null (FK not joined) | ⚠️ | HIGH — column defined but always empty |
| Received From | received_from | received_from | null (FK not joined) | ⚠️ | HIGH — column defined but always empty |
| Ball In Court | ball_in_court | ball_in_court | submittals.ball_in_court | ✅ | — |
| Approvers | approvers | approvers | null (M2M not joined) | ⚠️ | HIGH — column defined but always empty |
| Response | response / latest_response | latest_response | null (not joined) | ⚠️ | HIGH — column defined but always empty |
| Sent Date | sent_date | sent_date | submittals.sent_date | ✅ | — |

**Root cause for null columns:** The list API query (`GET /api/projects/[projectId]/submittals`) does not join people, companies, or submittal_responses tables. The `toTableRow()` function manually assigns `null` for these fields. The data exists in the database but is not fetched.

---

## Filter Comparison

Source: `frontend/src/app/(main)/[projectId]/submittals/page.tsx`
Reference: `procore-crawls/submittals/spec/COMMANDS.md`

| Procore Filter | Alleato Filter | Status | Notes |
|---------------|---------------|--------|-------|
| Approver | — | ❌ | Missing |
| Ball In Court | — | ❌ | Missing (field exists in DB) |
| Created By | — | ❌ | Missing |
| Current Revision | — | ❌ | Missing |
| Division | division | ✅ | Implemented |
| Location | — | ❌ | Missing |
| Number | — | ❌ | Missing (search exists but not a discrete filter) |
| Private | — | ❌ | Missing (field exists in DB) |
| Received From | — | ❌ | Missing |
| Response | latest_response | ✅ | Implemented |
| Responsible Contractor | — | ❌ | Missing |
| Status | status | ✅ | Implemented |

**Summary:** 3/11 Procore filters implemented (27%). Alleato has an additional `status` filter not in Procore's filter panel (though Procore has status tabs).

---

## Missing Functionality

### HIGH Impact (blocks core workflows)

- [ ] **`submittal_manager_id` field in create/edit form** — Required in Procore (asterisk), completely absent from Alleato form. Submittal cannot be properly attributed without this. Must be a searchable dropdown of project contacts.
- [ ] **`distribution_list` field in create/edit form** — The entire distribution workflow (who receives the submittal) is configured here. Currently no way to set it via the form.
- [ ] **`responsible_contractor_id` field in create/edit form** — Core workflow field showing which company is responsible.
- [ ] **`received_from_id` field in create/edit form** — Tracks who submitted the physical submittal. Core data field.
- [ ] **`attachments` field in create/edit form** — Cannot attach files when creating or editing. Files are viewable in the detail view but there is no upload mechanism in the form dialog.
- [ ] **`workflow_template` and `workflow_steps` in create/edit form** — Cannot set up the approval workflow on create. Workflow is view-only in the detail.
- [ ] **"Update & Send Emails" button** — Procore's primary distribution action. Submitting the form should trigger email notifications to the distribution list.
- [ ] **List table: responsible_contractor, received_from, approvers, latest_response columns return null** — All 4 columns are defined in the table config but the list API query does not join the necessary tables. These columns appear blank for every row.

### MEDIUM Impact (reduces functionality)

- [ ] **`submittal_package_id` field in form** — Cannot assign a submittal to a package on create/edit. Package grouping is a key Procore workflow.
- [ ] **`cost_code_id` field in form** — Financial classification missing. Required for budget integration.
- [ ] **`location_id` field in form** — Location context for the submittal not capturable.
- [ ] **`specification_section` widget** — Currently a plain text Input; Procore uses a searchable dropdown populated from CSI spec sections (e.g., "08-1113 - Doors, Frames, Hardware"). Should integrate with the specifications tool or a pre-loaded list.
- [ ] **`submittal_type` widget** — Currently plain text; should be a dropdown from the `submittal_types` table (which exists in the DB and is joined in the detail API).
- [ ] **`description` rich text editor** — Currently a plain Textarea; Procore uses a full rich text editor with Bold, Italic, Underline, Strikethrough, alignment, lists, tables, font size, colors. Minimum: support bold/italic/lists.
- [ ] **Create Revision action** — No way to create a new revision of an existing submittal. This is a core submittal workflow (Procore: actions menu on detail page).
- [ ] **Duplicate Submittal action** — Missing from detail view actions menu.
- [ ] **`linked_drawings` field in form** — Integration with drawings tool for linking.
- [ ] **8 missing filters** — Approver, Ball In Court, Created By, Current Revision, Location, Number, Private, Received From, Responsible Contractor. With 11 possible filters vs Procore's 11, current coverage is 27%.

### LOW Impact (nice to have)

- [ ] **Redistribute action** — Re-sends submittal to updated distribution list. Present in Procore's detail toolbar.
- [ ] **Email Submittal action** — Send submittal via email from actions menu.
- [ ] **Bulk actions** — Bulk status update, bulk delete for the list view.
- [ ] **Export (CSV, PDF, Excel)** — Export button exists in UnifiedTablePage but `enableExport: false` is set in page config.
- [ ] **Emails tab in detail view** — Alleato has "Workflow" tab instead of Procore's "Emails" tab. Email history for a submittal is not visible.
- [ ] **Workflow responses: show name + company** — Currently displays raw `responder_id` UUID instead of resolved person name and company.
- [ ] **Distribution summary format** — Detail view should show From/To/Message format matching Procore (submittal manager → distribution list with message).
- [ ] **`ball_in_court` computed from workflow** — Currently editable text field; Procore computes this automatically from the workflow step that is currently active.
- [ ] **Create Submittal Package dropdown** — Main "Add Submittal" button should be a dropdown with both "Create Submittal" and "Create Submittal Package" options.
- [ ] **Create New Report action** — Not implemented.
- [ ] **Submittal Approvers' Response Time report** — Canned report not implemented.
- [ ] **Legacy files cleanup** — `frontend/src/app/(tables)/submittals/submittals-client.tsx` and `submittals-data.ts` use different statuses and field names than the current implementation. They appear unused by the main project page and should be reviewed for removal or reconciliation.

---

## Status / Workflow Comparison

### Submittal Status (main state machine)

| Procore Status | Alleato Status (API/hook) | Alleato Status (legacy client) | Status | Notes |
|---------------|--------------------------|-------------------------------|--------|-------|
| Draft | Draft | Draft | ✅ | Correct in API layer |
| Open | Open | — | ⚠️ | Correct in API; legacy client has "Submitted" instead |
| Distributed | Distributed | — | ⚠️ | Correct in API; missing from legacy client |
| Closed | Closed | — | ⚠️ | Correct in API; legacy client has "Approved", "Rejected", etc. |

**The main project page (`[projectId]/submittals`) uses the correct statuses via `use-submittals.ts` and the API.**
**The legacy client (`(tables)/submittals/submittals-client.tsx`) uses a completely different status set that does not match Procore.**

### Workflow Response Statuses (per approver)

| Procore Response | Alleato Response | Status | Notes |
|-----------------|-----------------|--------|-------|
| Submitted | Submitted | ✅ | In submittal_responses enum |
| Pending | Pending | ✅ | In submittal_responses enum |
| Approved | Approved | ✅ | In submittal_responses enum |
| Approved as Noted | Approved as Noted | ✅ | In submittal_responses enum |

---

## Database Schema Gaps

All 8 core tables from the Procore spec have been confirmed in `frontend/src/types/database.types.ts`. The database layer is largely complete.

| Table | Status | Notes |
|-------|--------|-------|
| submittals | ✅ | All core columns present |
| submittal_packages | ✅ | Confirmed in types |
| submittal_workflow_steps | ✅ | Confirmed in types |
| submittal_responses | ✅ | Confirmed in types |
| submittal_distributions | ✅ | Confirmed in types |
| submittal_distribution_recipients | ✅ | Confirmed in types |
| submittal_attachments | ✅ | Confirmed in types |
| submittal_linked_drawings | ✅ | Confirmed (referenced in API detail join) |
| submittal_types | ✅ | Extra table not in original spec; already integrated in API |
| submittal_history | ✅ | Referenced in detail view (Change History tab) |

### Potential Column Gaps

| Table | Column / Concern | Status | Notes |
|-------|-----------------|--------|-------|
| submittals | sent_date | ✅ | In schema |
| submittals | ball_in_court | ⚠️ | Stored as text; should be computed from active workflow step |
| submittal_workflow_steps | assignees[] | ⚠️ | Step builder requires assignee list per step — verify this M2M exists |
| submittal_responses | responded_at | ✅ | In schema per spec |
| submittals | submittal_number | ✅ | Maps to Procore "number" field |
| submittals | submittal_type vs submittal_type_id | ⚠️ | Both fields exist; `submittal_type` (text) may be a legacy denormalized field; prefer `submittal_type_id` FK to `submittal_types` |

---

## Implementation Priority Summary

### Phase 1 — Fix Form Dialog (1-2 days)

These are direct form additions that will unlock core workflows immediately:

1. Add `submittal_manager_id` — searchable contact dropdown (REQUIRED)
2. Add `responsible_contractor_id` — searchable company dropdown
3. Add `received_from_id` — searchable contact dropdown
4. Add `distribution_list[]` — multi-select contact tag chips
5. Add `submittal_package_id` — dropdown from submittal_packages
6. Add `cost_code_id` — searchable cost code dropdown
7. Add `location_id` — searchable location dropdown
8. Add `attachments` — file upload area with drag-and-drop
9. Add `workflow_template` + `workflow_steps` builder
10. Add "Update & Send Emails" button
11. Change `specification_section` from text Input to searchable dropdown
12. Change `submittal_type` from text Input to dropdown (uses `submittal_types` table)

### Phase 2 — Fix List Table (0.5 days)

Update the list API query to join people/companies and add missing filters:

1. Join company name for `responsible_contractor`
2. Join contact name for `received_from`
3. Join approver names from workflow steps
4. Join latest response status from submittal_responses
5. Add 8 missing filters

### Phase 3 — Add Missing Actions (1 day)

1. Create Revision action (detail page actions menu)
2. Duplicate Submittal action (detail page actions menu)
3. Update & Send Emails (already in Phase 1 form button)
4. Enable CSV/PDF/Excel export (`enableExport: true`)

### Phase 4 — Polish (0.5 days)

1. Upgrade description to rich text editor
2. Fix workflow responses to show name + company
3. Fix distribution summary display format
4. Make `ball_in_court` computed from workflow
5. Add Emails detail tab
6. Clean up or remove legacy `(tables)/submittals/` files
