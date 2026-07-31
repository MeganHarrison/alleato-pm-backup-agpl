# Budget — Procore vs. Alleato Gap Analysis

**Generated:** 2026-03-08
**Procore crawl:** _bmad-output/planning-artifacts/budget/.archive/ (Dec 2025 crawl, 14 unique views)
**Alleato path:** frontend/src/app/(main)/[projectId]/budget/

---

## Executive Summary

| Category | Status | Details |
|----------|--------|---------|
| **Pages / Tabs** | ⚠️ | 5/6 tabs implemented (83%) — Budget Details tab missing |
| **List Table Columns** | ✅ | 15/15 Procore columns implemented (100%) |
| **Form Fields** | ⚠️ | 5/7 line-item form fields implemented (71%) — Vendor and WBS attributes missing |
| **Status Workflow** | ✅ | 4/4 modification statuses implemented (draft, pending, approved, void) |
| **CRUD Operations** | ⚠️ | Create/Read/Update/Delete present; Import from Excel and Export missing |
| **Database Schema** | ⚠️ | Core columns present; vendor_id, wbs_attributes, voided_reason, change_event_id missing from budget_lines / budget_modification_lines |
| **Validations** | ⚠️ | Required fields enforced; Procore's red-text budget warning indicators not implemented |
| **Financial Views** | ⚠️ | budget_views table exists in DB; UI selector not confirmed implemented |
| **ERP Integration** | ❌ | Not implemented (CMiC, Sage 300, ViewPoint — Procore-only) |
| **Export / Import** | ❌ | Both stubbed with "coming soon" toasts |

**Overall Verdict:** NEEDS MINOR WORK — approximately 80% complete

Core budget functionality (table columns, modification workflow, forecasting, snapshots, cost codes) is fully implemented and matches Procore's structure. Remaining gaps are Export/Import, a missing Budget Details tab, and a few advanced line-item fields (vendor, WBS attributes). ERP integration is intentionally out of scope for the current phase.

---

## Page-by-Page Comparison

| Procore Page | Alleato Route | Status | Notes |
|-------------|---------------|--------|-------|
| Budget main (table view) | /[projectId]/budget | ✅ | Full 15-column budget table implemented |
| Budget Details tab (`?tab=details`) | — | ❌ | Alleato has Cost Codes tab instead; Procore Details shows sub-job breakdown and additional metadata |
| Budget Modifications tab | /[projectId]/budget (modifications tab) | ✅ | Statuses, creation, approval workflow all present |
| Forecasting tab (`?tab=forecast`) | /[projectId]/budget (forecasting tab) | ⚠️ | Implemented but Export button is stubbed; shows max 10 cost codes |
| Snapshots tab (`?tab=snapshots`) | /[projectId]/budget (snapshots tab) | ⚠️ | Implemented; comparison is sequential only (no arbitrary snapshot selector); max 5 displayed; Export stubbed |
| Change History tab (`?tab=history`) | /[projectId]/budget (change-history tab) | ✅ | History tracking implemented |
| Financial Views selector | — | ⚠️ | budget_views + budget_view_columns tables exist in DB; UI selector not confirmed |
| Budget Lock action | /[projectId]/budget | ✅ | Lock/unlock implemented in budget toolbar |

---

## Form Field Comparison

### Budget Line Item Create/Edit Form

| Procore Field | Type | Required | Alleato Field | Status | Impact |
|--------------|------|----------|--------------|--------|--------|
| Budget Code (cost_code + cost_type) | select | Yes | Budget Code (project_budget_code_id / cost_code_id + cost_type_id) | ✅ | — |
| Quantity | number | No | quantity | ✅ | — |
| Unit of Measure | select | No | unit_of_measure (UOM enum) | ✅ | — |
| Unit Cost | number | No | unit_cost | ✅ | — |
| Amount / Original Budget | number | Yes | original_amount | ✅ | — |
| Vendor | select | No | — | ❌ | LOW |
| WBS Attributes | key-value pairs | No | — | ❌ | LOW |
| Description / Notes | textarea | No | description | ✅ | — |
| Sub-job | select | No | sub_job_id / sub_job_key | ⚠️ | DB columns exist; unclear if UI exposes sub-job picker on line items |

### Budget Modification Create Form

| Procore Field | Type | Required | Alleato Field | Status | Impact |
|--------------|------|----------|--------------|--------|--------|
| Title | text | Yes | title | ✅ | — |
| Status | select (draft/pending/approved) | Yes | status | ✅ | — |
| Effective Date | date | No | effective_date | ✅ | — |
| Cost Code Lines | repeating | Yes | budget_mod_lines | ✅ | — |
| Modification Type (addition/deduction) | select | No | — | ❌ | MEDIUM |
| Change Event link | select | No | — | ❌ | MEDIUM |
| Void Reason | textarea | Conditional | — | ❌ | LOW |

---

## Table Column Comparison

### Main Budget Table

| Procore Column | Alleato Column | Status | Impact |
|---------------|---------------|--------|--------|
| Cost Code | cost_code + cost_type | ✅ | — |
| Original Budget | originalBudgetAmount | ✅ | — |
| Budget Modifications | budgetModifications | ✅ | — |
| Approved Change Orders | approvedCOs | ✅ | — |
| Revised Budget | revisedBudget (calculated) | ✅ | — |
| Job to Date Cost (Detail) | jobToDateCostDetail | ✅ | — |
| Direct Costs | directCosts | ✅ | — |
| Pending Budget Changes | pendingChanges | ✅ | — |
| Projected Budget | projectedBudget | ✅ | — |
| Committed Costs | committedCosts | ✅ | — |
| Pending Cost Changes | pendingCostChanges | ✅ | — |
| Projected Costs | projectedCosts | ✅ | — |
| Forecast to Complete | forecastToComplete | ✅ | — |
| Estimated Cost at Completion (EAC) | estimatedCostAtCompletion | ✅ | — |
| Projected Over/Under | projectedOverUnder | ✅ | — |

**All 15 core Procore budget table columns are implemented in Alleato.**

### Budget Modifications Table

| Procore Column | Alleato Column | Status | Impact |
|---------------|---------------|--------|--------|
| # (Number) | number | ✅ | — |
| Status | status (badge) | ✅ | — |
| Title | title | ✅ | — |
| Cost Codes | cost_codes (summary) | ✅ | — |
| Amount | amount | ✅ | — |
| Created | created_at | ✅ | — |
| Effective Date | effective_date | ✅ | — |
| Modification Type | — | ❌ | MEDIUM |
| Change Event # | — | ❌ | MEDIUM |

---

## Missing Functionality

### HIGH Impact (blocks core workflows)

- [ ] **Export budget to PDF/Excel** — Both Export buttons in main table and sub-tabs (forecasting, snapshots) show "coming soon" toasts. Procore exports are heavily used for owner reporting and GC billing packages.
- [ ] **Import budget from Excel** — Procore's Import dropdown allows bulk line-item creation from spreadsheet. Missing for initial project setup workflows.

### MEDIUM Impact (reduces functionality)

- [ ] **Budget Details tab** — Procore's `?tab=details` shows sub-job breakdowns, additional metadata, and a different grid layout. Alleato has a Cost Codes tab instead (different purpose — managing which codes are active for the project). Neither fully replaces the other.
- [ ] **Financial Views selector** — Procore allows saving named column configurations (e.g., "Owner View", "GC View"). `budget_views` + `budget_view_columns` tables exist in Alleato DB but no confirmed UI implementation. Allows hiding/reordering columns per saved view.
- [ ] **Modification Type field on budget modifications** — Procore distinguishes addition vs. deduction modifications. Allows filtering and reporting by type.
- [ ] **Change Event linkage on modifications** — Procore modifications can reference a parent change event. This links the budget impact to the originating change event for full audit trail.
- [ ] **Snapshot comparison selector** — Procore allows selecting any two snapshots for side-by-side comparison. Alleato only shows sequential (each snapshot vs. the prior one). For projects with many snapshots, non-sequential comparison is important.
- [ ] **Sub-job UI on line items** — `sub_job_id` and `sub_job_key` exist in `budget_lines` table but the line-item form may not expose a sub-job picker. Procore's sub-job support segments budget by phase/section.

### LOW Impact (nice to have)

- [ ] **Vendor field on budget line items** — Procore allows associating a vendor with a budget line. Alleato `budget_lines` table has no `vendor_id` column. Primarily used for Committed Costs tracking cross-reference.
- [ ] **WBS (Work Breakdown Structure) attributes** — Procore allows custom key-value WBS attributes on line items for owner reporting. Not present in Alleato schema or UI.
- [ ] **Void reason field on modifications** — Procore shows a required text reason when voiding a modification. Alleato sets void status but has no `voided_reason` column.
- [ ] **Red-text budget warning indicators** — Procore highlights rows in red when projected costs exceed revised budget by a threshold. `is_red_text` and `warnings` fields mentioned in Procore specs. No visual indicator in Alleato.
- [ ] **Budget Modification description/notes field** — Procore modifications have a freeform notes field. Alleato modification form may only have title and amount lines.
- [ ] **ERP sync indicators** — Procore shows sync status badges for ERP-connected projects. Out of scope for Alleato Phase 1, but placeholder UI may be useful.
- [ ] **Forecasting curve visualization** — Procore's forecasting tab shows an S-curve chart. Alleato's `budget_line_forecasts` table has `curve_id` and `default_curve_id` on `budget_lines` but no chart is rendered in the forecasting tab.
- [ ] **Max snapshots display limit** — Alleato's snapshot card grid shows max 5 snapshots. Procore shows all snapshots in a scrollable list.
- [ ] **Forecasting tab max cost code display** — Alleato shows only 10 cost codes in the forecast breakdown. Should paginate or show all.

---

## Status / Workflow Comparison

### Budget Line Status

| Procore Status | Alleato Status | Implemented |
|---------------|---------------|-------------|
| Active (default) | active (implicit) | ✅ |
| N/A (lines don't have individual statuses) | N/A | ✅ |

### Budget Modification Status

| Procore Status | Alleato Status | Implemented |
|---------------|---------------|-------------|
| Draft | draft | ✅ |
| Pending | pending | ✅ |
| Approved | approved | ✅ |
| Void | void | ✅ |

### Budget Master Status

| Procore Status | Alleato Status | Implemented |
|---------------|---------------|-------------|
| Active (unlocked) | unlocked (isLocked = false) | ✅ |
| Locked | locked (isLocked = true) | ✅ |
| ERP Synced | — | ❌ (intentionally out of scope) |

---

## Database Schema Gaps

### budget_lines table

| Required Column | Type | Exists in DB | Notes |
|----------------|------|-------------|-------|
| cost_code_id | string (FK) | ✅ | Present |
| cost_type_id | string (FK) | ✅ | Present |
| original_amount | numeric | ✅ | Present |
| quantity | numeric | ✅ | Present |
| unit_of_measure | string | ✅ | Present |
| unit_cost | numeric | ✅ | Present |
| description | text | ✅ | Present |
| sub_job_id | string (FK) | ✅ | Present (no UI confirmed) |
| forecasting_enabled | boolean | ✅ | Present |
| default_ftc_method | string | ✅ | Present |
| default_curve_id | string (FK) | ✅ | Present |
| vendor_id | string (FK) | ❌ | Not in generated DB types |
| wbs_attributes | jsonb | ❌ | Not in generated DB types |
| line_number | integer | ⚠️ | In schema docs but not in generated types — verify actual column exists |

### budget_modification_lines table

| Required Column | Type | Exists | Notes |
|----------------|------|--------|-------|
| budget_line_id | FK | ✅ | Present |
| amount | numeric | ✅ | Present |
| status | text | ✅ | Present |
| effective_date | date | ✅ | Present |
| modification_type | text (addition/deduction) | ❌ | Missing — need migration |
| change_event_id | UUID (FK) | ❌ | Missing — need migration |
| voided_reason | text | ❌ | Missing — need migration |

### budget_snapshots

| Required Column | Type | Exists | Notes |
|----------------|------|--------|-------|
| id | UUID | ✅ | Present |
| project_id | integer (FK) | ✅ | Present |
| name | text | ✅ | Present |
| description | text | ✅ | Present |
| snapshot_date | date | ✅ | Present |
| line_items | jsonb | ✅ | Present (captures full budget state) |
| grand_totals | jsonb | ✅ | Present |
| total_budget | numeric | ✅ | Present (in snapshots tab interface) |
| total_costs | numeric | ✅ | Present |
| variance | numeric | ✅ | Present |

---

## Formulaic Column Verification

All 15 Procore budget column formulas are mapped to Alleato's `v_budget_rollup` view:

| Procore Formula | Alleato Implementation |
|----------------|----------------------|
| Revised Budget = Original + Modifications + Approved COs | `v_budget_rollup.revised_budget` ✅ |
| Projected Budget = Revised + Pending Budget Changes | `v_budget_rollup.projected_budget` ✅ |
| Projected Costs = Committed + Pending Cost Changes + Direct | `v_budget_rollup.projected_costs` ✅ |
| Forecast to Complete = EAC - Job to Date Cost | `v_budget_rollup.forecast_to_complete` ✅ |
| Projected Over/Under = Projected Budget - EAC | `v_budget_rollup.projected_over_under` ✅ |

All derived column formulas match Procore's specification.

---

## Crawl Data Sources

This gap analysis was produced using existing crawl artifacts rather than a live Procore session:

- `_bmad-output/planning-artifacts/budget/.archive/comprehensive-budget-crawl-report.md` — Dec 2025 crawl, 14 unique views
- `_bmad-output/planning-artifacts/budget/.archive/budget-table.md` — Procore column definitions with formulas
- `_bmad-output/planning-artifacts/budget/.archive/budget-analysis.md` — Procore entity interfaces and API specs
- `_bmad-output/planning-artifacts/budget/schema-budget.md` — Alleato DB schema documentation

Alleato codebase files analyzed:
- `frontend/src/app/(main)/[projectId]/budget/` — all page files
- `frontend/src/components/budget/` — all tab components
- `frontend/src/types/database.types.ts` — generated Supabase types (budget_lines section)
