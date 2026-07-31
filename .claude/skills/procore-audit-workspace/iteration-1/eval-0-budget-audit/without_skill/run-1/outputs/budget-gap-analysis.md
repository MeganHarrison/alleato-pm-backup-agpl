# Budget Tool Gap Analysis: Alleato PM vs. Procore
**Date:** 2026-03-08
**Procore Data Source:** `_bmad-output/planning-artifacts/budget/.archive/comprehensive-budget-crawl-report.md` (crawled 2025-12-29)
**Alleato Implementation Analyzed:** `frontend/src/app/(main)/[projectId]/budget/` + `frontend/src/components/budget/`

---

## Executive Summary

The Alleato budget tool has strong foundational parity with Procore across financial columns, tab navigation, and budget lifecycle management. However, several significant gaps exist in column visibility/grouping in the main table view, the Details tab, the forecasting system, and a critical architectural difference in how Unit Qty / UOM / Unit Cost / Calculation Method are surfaced in the UI.

**Overall Parity Score: 72 / 100**

| Category | Procore | Alleato | Gap |
|----------|---------|---------|-----|
| Main Table Financial Columns | 14 | 14 | None |
| Main Table Structural Columns | 4 (Calc Method, Unit Qty, UOM, Unit Cost) | 0 visible in table | HIGH |
| Tab Navigation | 5 tabs | 5 tabs + Cost Codes | Minor |
| Header Actions | 7 actions | 8 actions | Minimal |
| Export/Import | 5 formats + Field Sets | 3 formats, no Field Sets | MEDIUM |
| Financial Views | Named views, configurable columns | Budget Views Manager (500 errors) | HIGH |
| Details Tab | Granular line-item details per code | Functional but missing sub-types | MEDIUM |
| Forecast Tab | Forecasting curves + manual input | Summary-only, no curve selection | HIGH |
| Snapshots Tab | Date-range comparison, restore | Create-only, no compare/restore | HIGH |
| History Tab | Field-level change log with filters | Field-level log, limited filters | MEDIUM |
| Analyze Variance | Fullscreen comparison mode | Icon present, no implementation | HIGH |
| Reports | 4 named reports | 4 named reports (wired up) | Low |
| Lock/Unlock | Full with role control | Full with confirmation dialog | Minimal |
| Budget Modifications | Dedicated locked-state flow | Full modal + tab | None |
| Unit Qty / UOM / Unit Cost | Visible main table columns | Only in create/edit form | HIGH |

---

## 1. Procore Budget Tool: Reference Feature Inventory

Based on the 2025-12-29 crawl of all 14 budget views, Procore exposes the following:

### 1.1 Main View Columns (in order, left to right)

| # | Column Name | Procore Label |
|---|-------------|---------------|
| 1 | Budget Code | "Budget Code" |
| 2 | Description | "Description" |
| 3 | Calculation Method | "Calc Method" |
| 4 | Unit Quantity | "Unit Qty" |
| 5 | Unit of Measure | "UOM" |
| 6 | Unit Cost | "Unit Cost" |
| 7 | Original Budget | "Original Budget" |
| 8 | Budget Modifications | "Budget Modifications" |
| 9 | Approved COs | "Approved COs" |
| 10 | Revised Budget | "Revised Budget" |
| 11 | JTD Cost Detail | "JTD Cost Detail" |
| 12 | Direct Costs | "Direct Costs" |
| 13 | Pending Budget Changes | "Pending Budget Changes" |
| 14 | Projected Budget | "Projected Budget" |
| 15 | Committed Costs | "Committed Costs" |
| 16 | Pending Cost Changes | "Pending Cost Changes" |
| 17 | Projected Costs | "Projected Costs" |
| 18 | Forecast to Complete | "Forecast to Complete" |
| 19 | Est. Cost at Completion | "Est. Cost at Completion" |
| 20 | Projected Over/Under | "Projected Over/Under" |

**Total: 20 columns (6 structural + 14 financial)**

### 1.2 Main View Actions (Header)

1. **Create** - dropdown: Budget Line Item, Snapshot
2. **Import** - dropdown: CSV template, Excel template, Sage import
3. **Export** - dropdown: PDF, Excel, CSV, Field Set (custom export)
4. **Financial Views** - named view switcher with column configurability
5. **Resend to ERP** - sync button
6. **Lock Budget / Unlock Budget** - toggle
7. **Analyze Variance** - opens a fullscreen variance comparison tool

### 1.3 Filter / View Controls (Above table)

- Snapshot selector (compare to historical snapshot)
- Grouping selector (by cost code division, sub-job, cost type)
- Quick filter: All, Over Budget, Under Budget, No Activity
- Column sort (by code A-Z, by variance)
- Fullscreen toggle

### 1.4 Tab Navigation

| Tab | URL Parameter | Purpose |
|-----|--------------|---------|
| Main | (default) | Primary financial table |
| Details | `?tab=details` | Granular per-line-item sub-types |
| Forecast | `?tab=forecast` | Forecasting curves + EAC inputs |
| Snapshots | `?tab=snapshots` | Snapshot list with comparison |
| History | `?tab=history` | Audit log of all field changes |

### 1.5 Details Tab (Procore)

Shows each budget code broken into sub-line items by:
- **Contract Type**: Prime Contract, Subcontract, Purchase Order
- **Cost Type**: Labor, Material, Equipment, Subcontractor, Other
- Columns: Description, Amount, % Complete, Billed to Date, Balance to Bill

### 1.6 Forecast Tab (Procore)

- **Forecasting Method**: Fixed at Revised Budget / Variable / Custom Curve
- **Forecasting Curves**: S-Curve, Linear, Front-loaded, Back-loaded
- **Manual Override**: Per-line FTC (Forecast to Complete) direct entry
- Shows EAC (Estimated Cost at Completion) = Committed + Projected + FTC

### 1.7 Snapshots Tab (Procore)

- List of named snapshots with date
- **Compare**: side-by-side column showing delta vs. current
- **Restore**: revert to a snapshot
- Auto-snapshots on budget lock

### 1.8 History Tab (Procore)

- Per-field change log: timestamp, user, old value, new value
- Filter by: date range, user, field type (budget amount, cost code, etc.)
- Export to CSV

---

## 2. Alleato Budget Tool: Actual Implementation State

### 2.1 Main Table Columns Rendered

**Source:** `frontend/src/components/budget/budget-table.tsx`

| Column | Key | Rendered in Table | Notes |
|--------|-----|------------------|-------|
| Select | `select` | Yes (checkbox) | Leaf nodes only |
| Expander | `expander` | Yes | Chevron for groups |
| Description | `description` | Yes | With cost code for groups |
| Original Budget | `originalBudgetAmount` | Yes | Editable cell |
| Budget Modifications | `budgetModifications` | Yes | Click opens modal |
| Approved COs | `approvedCOs` | Yes | Click opens modal |
| Revised Budget | `revisedBudget` | Yes | Computed |
| JTD Cost Detail | `jobToDateCostDetail` | Yes | Click opens modal |
| Direct Costs | `directCosts` | Yes | Click opens modal |
| Pending Budget Changes | `pendingChanges` | Yes | Click opens modal |
| Projected Budget | `projectedBudget` | Yes | Computed |
| Committed Costs | `committedCosts` | Yes | Click opens modal |
| Pending Cost Changes | `pendingCostChanges` | Yes | Click opens modal |
| Projected Costs | `projectedCosts` | Yes | Computed |
| Forecast to Complete | `forecastToComplete` | Yes | Click opens modal |
| Est. Cost at Completion | `estimatedCostAtCompletion` | Yes | Computed |
| Projected Over/Under | `projectedOverUnder` | Yes | Computed |

**Missing from main table view (present in form only):**
- Calculation Method (`calculation_method`) — field in DB, not a table column
- Unit Quantity (`unit_qty`) — field in DB, not a table column
- Unit of Measure (`uom`) — field in DB (has `UomSelect` component), not shown in table
- Unit Cost (`unit_cost`) — field in DB, not a table column

### 2.2 Header Actions Implemented

**Source:** `frontend/src/components/budget/budget-page-header.tsx`

| Action | Procore | Alleato | Notes |
|--------|---------|---------|-------|
| Create (Budget Line Item) | Yes | Yes | Dropdown |
| Create Snapshot | Yes | Yes | In Create dropdown |
| Import | Yes | Yes | Opens ImportBudgetModal |
| Budget Modification | Locked only | Locked only | Correct behavior |
| Export PDF | Yes | Yes | Handler wired |
| Export Excel | Yes | Yes | Handler wired |
| Export CSV | Yes | Yes | Handler wired |
| Export Field Set | Yes | **NO** | Procore-specific custom export |
| Financial Views | Yes | Partial (500 errors) | BudgetViewsManager broken |
| Resend to ERP | Yes | Yes | "Sync to ERP" icon button |
| Lock Budget | Yes | Yes | With confirmation dialog |
| Unlock Budget | Yes | Yes | Direct button when locked |
| Analyze Variance | Yes | Partial | Icon present, `onAnalyzeVariance` prop wired but no implementation behind it |
| AI Assistant | No | Yes (unique) | Alleato-only feature |
| Budget Reports | No | Yes (4 reports) | Alleato-unique, good addition |
| Configure Budget Views | No | Yes | Via BudgetViewsManager |

**Header Pattern:** `BudgetPageHeader` uses `PageHeader` from `@/components/layout/page-header-unified` — this is the correct unified component. Previously flagged violation appears to have been fixed.

### 2.3 Filter Controls

**Source:** `frontend/src/components/budget/budget-filters.tsx`

| Filter | Procore | Alleato | Status |
|--------|---------|---------|--------|
| Snapshot selector | Yes | Yes | Works |
| Grouping selector | Yes | Yes | Works |
| Quick filter (All/Over/Under/No Activity) | Yes | Yes | Works |
| Sort options | Yes | UI present | **"Coming soon" — disabled** |
| Fullscreen toggle | Yes | Yes | Works |
| Analyze Variance button | Yes | Yes (icon) | **No implementation** |

### 2.4 Tab Navigation

**Source:** `frontend/src/app/(main)/[projectId]/budget/page.tsx`, `frontend/src/components/budget/budget-tabs.tsx`

| Tab | Procore | Alleato | Status |
|-----|---------|---------|--------|
| Main (default) | Yes | Yes | Full |
| Details | Yes | Yes | Partial (see Section 3.2) |
| Forecast | Yes | Yes | Partial (see Section 3.3) |
| Snapshots | Yes | Yes | Partial (see Section 3.4) |
| History | Yes | Yes | Partial (see Section 3.5) |
| Cost Codes | No | Yes | Alleato-unique |
| Budget Modifications | No | Yes | Alleato-unique |

### 2.5 Create Form Fields

**Source:** `frontend/src/components/budget/budget-line-item-form.tsx`

| Field | Procore | Alleato Form | Notes |
|-------|---------|-------------|-------|
| Budget Code | Yes | Yes | With CSI grouping |
| Description | Yes | Yes | |
| Quantity (Unit Qty) | Yes | Yes (field: `qty`) | Present in form |
| UOM | Yes | Yes (`UomSelect`) | Present in form |
| Unit Cost | Yes | Yes | Present in form |
| Amount | Yes | Yes (computed) | Auto-calculated |
| Calculation Method | Yes | Yes (Select R/LS/etc) | Present in form |

**Form fields are complete. The gap is that Unit Qty, UOM, Unit Cost, and Calculation Method are NOT visible as columns in the main budget table — they are only in the edit/create modal.**

---

## 3. Detailed Gap Analysis by Feature Area

### 3.1 Main Table Column Gap (HIGH PRIORITY)

**Problem:** Procore exposes 4 structural columns in the main table view — Calculation Method, Unit Qty, UOM, and Unit Cost — alongside the financial columns. These are critical for unit-price-based budget lines.

**Alleato Current State:** These fields exist in the `budget_lines` database table and are captured in the create/edit form, but they are not rendered as visible columns in the `BudgetTable` component.

**Impact:** Users cannot see unit quantities or unit costs at a glance in the main view. Productivity loss for quantity-driven projects (labor, material tracking by unit).

**Recommended Fix:**
Add 4 optional columns to `BudgetTable`:
```
- calcMethod: "Calc Method" (text, e.g., "LS", "Unit")
- unitQty: "Unit Qty" (number, right-aligned)
- uom: "UOM" (text)
- unitCost: "Unit Cost" (currency)
```
These should be toggleable via the Budget Views Manager (column visibility). Default: hidden for cleaner initial view, shown when "Unit Price" view is active.

---

### 3.2 Details Tab Gap (MEDIUM PRIORITY)

**Procore:** The Details tab shows each budget line item broken down by contract type (Prime, Subcontract, PO) and cost type (Labor, Material, Equipment, Subcontractor, Other). Columns include Amount, % Complete, Billed to Date, Balance to Bill.

**Alleato Current State:** `frontend/src/components/budget/budget-details-table.tsx` exists and is wired to the `/api/projects/[projectId]/budget/details` route. The route aggregates from:
- `budget_lines` (Original Budget)
- `budget_modifications`
- `contract_change_orders`
- `commitments`
- `commitment_change_orders`
- `change_events`
- `direct_costs`

**Gaps identified:**
1. No `% Complete` column (requires % complete tracking, not currently modeled)
2. No `Billed to Date` column (requires invoice tracking vs. SOV)
3. No `Balance to Bill` = Revised Budget - Billed to Date
4. Missing sub-type breakdown by Labor / Material / Equipment (cost_type granularity)

**Recommended Fix:**
- Add `cost_type_id` grouping in the Details tab query
- Add % Complete field to `budget_lines` or pull from commitment SOV progress
- Compute Balance to Bill from SOV data

---

### 3.3 Forecasting Tab Gap (HIGH PRIORITY)

**Procore:**
- Forecasting method selection (Fixed, Variable, Custom Curve)
- Forecasting curve shapes: S-Curve, Linear, Front-loaded, Back-loaded
- Per-line manual override of Forecast to Complete
- Shows month-by-month cash flow projection

**Alleato Current State (`frontend/src/components/budget/forecasting-tab.tsx`):**
- Fetches from `/api/projects/[projectId]/budget/forecast`
- Returns `summary` (aggregate totals) and `forecastByCostCode` (per-code projected values)
- Shows total summary cards: Original Budget, Revised Budget, Projected Budget, Projected Costs, Projected Variance %
- Shows per-cost-code table: Projected Budget, Projected Costs, Projected Variance
- **No forecasting method selection**
- **No forecasting curves**
- **No month-by-month cash flow projection**
- **No manual FTC override per line**
- The schema doc mentions a `forecasting_curves` table and `forecasting_method` on `budget_lines` but the **migration was not deployed** (confirmed in plans-budget.md: "Phase 8: 40% complete, forecasting migration not deployed")

**Recommended Fix:**
1. Deploy the `forecasting_curves` table migration (high urgency — prerequisite for everything)
2. Add `forecasting_method` field to budget line items
3. Add curve selection UI to the ForecastingTab
4. Implement S-Curve / Linear distribution logic
5. Add monthly cash flow chart (Recharts line chart)
6. Add manual FTC override capability per budget line

---

### 3.4 Snapshots Tab Gap (HIGH PRIORITY)

**Procore:**
- Named snapshot list with creation date and total budget at time of snapshot
- **Compare**: side-by-side column showing delta ($ and %) vs. current budget
- **Restore**: revert entire project budget to a snapshot state
- Auto-snapshot triggered on budget lock
- Download snapshot as Excel

**Alleato Current State (`frontend/src/components/budget/snapshots-tab.tsx`):**
- Fetches from `/api/projects/[projectId]/budget/snapshots`
- Supports creating new snapshots (POST)
- Shows snapshot list with: name, description, snapshot_date, total_budget, total_costs, variance
- Shows "Current" summary at top
- **Missing: Snapshot comparison view** (no side-by-side delta)
- **Missing: Restore from snapshot** (UI exists to create only)
- **Missing: Auto-snapshot on lock** (not wired in lock handler)
- **Missing: Download snapshot as Excel/CSV**

**Recommended Fix:**
1. Add "Compare" button per snapshot row that fetches delta data
2. Add comparison column to main table (Procore pattern: column = delta vs. selected snapshot)
3. Wire auto-snapshot creation to the Lock Budget handler
4. Add snapshot download endpoint

---

### 3.5 History Tab Gap (MEDIUM PRIORITY)

**Procore:**
- Field-level audit log: timestamp, user, cost code, field changed, old value, new value
- Filters: date range, specific user, field type
- Export to CSV

**Alleato Current State (`frontend/src/components/budget/change-history-tab.tsx`):**
- Fetches from `/api/projects/[projectId]/budget/history`
- Schema: `{ id, timestamp, user, action, field, oldValue, newValue, costCode, description }`
- Shows statistics: totalChanges, changesThisMonth, activeUsers, lastChange
- Shows change log with action badges (Insert/Update/Delete)
- **Missing: Date range filter UI** (UI not shown in first 100 lines)
- **Missing: User filter** (statistics show activeUsers count but no filter)
- **Missing: Export to CSV**

**Recommended Fix:**
1. Add date range picker filter
2. Add user filter dropdown
3. Add "Export to CSV" button
4. Verify backend actually populates from database triggers (not mocked data)

---

### 3.6 Financial Views / Budget Views Gap (HIGH PRIORITY)

**Procore:**
- "Financial Views" dropdown in header
- Named views: "Standard Budget View", "Cost-to-Complete View", "Projected Budget View", etc.
- Each view is a saved set of visible columns in a specific order
- Users can create, rename, clone, and delete views
- Default view is project-level configurable

**Alleato Current State:**
- `BudgetViewsManager` component exists
- `budget_views` and `budget_view_columns` tables exist in DB
- API routes exist: `/budget/views` (GET/POST), `/budget/views/[viewId]` (GET/PUT/DELETE), `/budget/views/[viewId]/clone`
- **CRITICAL BLOCKER: Budget Views API returns 500 errors** (confirmed in plans-budget.md)
- The error in the views route handler reveals a Supabase authentication issue (auth guard may not have service role access to `budget_views`)
- Users cannot switch between views or create new ones until this is fixed

**Recommended Fix:**
1. Debug the 500 error on `/api/projects/[projectId]/budget/views` — check service role permissions on `budget_views` table
2. Add RLS policy `budget_views` to allow project members to read/write
3. Verify `budget_view_columns` has matching RLS policy
4. After fix: test column visibility toggling in `BudgetTable` based on selected view

---

### 3.7 Analyze Variance Gap (HIGH PRIORITY)

**Procore:**
- Dedicated full-page mode activated by "Analyze Variance" button
- Side-by-side: current budget vs. comparison period (snapshot, prior month, etc.)
- Shows delta columns: $ variance, % variance
- Color-coded rows: green (under budget), red (over budget)
- Can filter to show only over-budget items

**Alleato Current State:**
- `BudgetFilters` component has an `onAnalyzeVariance` prop and renders a `<Sigma>` icon button
- The page component passes `onAnalyzeVariance` down from the header
- **No implementation exists behind this callback** — it is a no-op
- The quick filters (Over Budget / Under Budget) exist but this is not the same as the full variance analysis mode

**Recommended Fix:**
1. Implement a fullscreen overlay/drawer that mounts when Analyze Variance is triggered
2. Add snapshot selector in the variance view
3. Add delta columns: Original Budget vs. Current, Projected vs. Budget
4. Add color-coded row highlighting
5. Add export for the variance report

---

### 3.8 Sort Functionality Gap (LOW-MEDIUM PRIORITY)

**Procore:** Budget table supports column-level sorting including "Largest variance first."

**Alleato Current State:** `BudgetFilters` has a Sort sub-menu with options (Budget code A-Z, Z-A, Largest variance first) but all are **disabled and marked "Coming soon"**. TanStack Table is used which natively supports sorting — it's not wired up.

**Recommended Fix:** Wire column sorting using TanStack Table's `getSortedRowModel()` and `onSortingChange` state.

---

### 3.9 Export Field Sets Gap (LOW PRIORITY)

**Procore:** Export dropdown includes "Field Set" option — allows exporting only selected columns from the current Financial View.

**Alleato Current State:** Export options are PDF / Excel / CSV only. No field-set scoped export.

**Recommended Fix:** Lower priority. After Budget Views are fixed, add an export option that uses the active view's columns to scope the export.

---

## 4. Schema / Data Architecture Gaps

### 4.1 Budget Lines Table

**Procore fields mapped to Alleato schema (`budget_lines` table):**

| Procore Field | Alleato Column | Status |
|---------------|---------------|--------|
| Budget Code | `cost_code_id` (FK) | Present |
| Description | `description` | Present |
| Calculation Method | `calculation_method` | Present (not displayed in table) |
| Unit Qty | `unit_qty` | Present (not displayed in table) |
| UOM | `uom` | Present (not displayed in table) |
| Unit Cost | `unit_cost` | Present (not displayed in table) |
| Original Budget | `original_amount` | Present |
| Line Number | `line_number` | Present |
| Forecasting Method | `forecasting_method` | **Migration not deployed** |
| Forecasting Curve | via `forecasting_curves` table | **Table not deployed** |

### 4.2 Calculation Discrepancy

The main budget API (`/route.ts`) performs JavaScript-based cost aggregation (computing JTD costs, committed costs, etc.) by making 10 parallel Supabase queries rather than using the materialized view `mv_budget_rollup`. This creates a risk:
- Performance degrades as data volume grows
- The materialized view may be out of sync with the API's calculation logic
- `v_budget_lines` (used by GET) and `mv_budget_rollup` may produce different values

**Recommended Fix:** Audit `v_budget_lines` and `mv_budget_rollup` against the JavaScript aggregation logic. Consolidate to use the materialized view for performance and consistency.

### 4.3 Missing % Complete and Billing Tracking

Procore's Details tab shows % Complete and Billed to Date per budget line. Alleato has no `percent_complete` field on `budget_lines`, and billing data would need to be derived from commitment SOV schedule of values. This is a larger modeling gap that requires a design decision on how progress will be tracked.

---

## 5. Gap Priority Matrix

| Gap | Priority | Effort | Impact |
|-----|----------|--------|--------|
| Budget Views API 500 error fix | P0 CRITICAL | Low (RLS fix) | Unlocks entire views system |
| Unit Qty / UOM / Unit Cost columns in table | P1 HIGH | Medium | Parity for unit-price projects |
| Analyze Variance implementation | P1 HIGH | High | Key PM workflow |
| Forecasting curves + methods | P1 HIGH | High | Core forecasting feature |
| Snapshot comparison view | P2 HIGH | Medium | Historical analysis |
| Snapshot auto-create on lock | P2 HIGH | Low | Correct workflow |
| Sort columns (TanStack wiring) | P2 MEDIUM | Low | Basic table UX |
| History tab filters + export | P2 MEDIUM | Medium | Audit compliance |
| Details tab: cost type grouping | P2 MEDIUM | Medium | Granular reporting |
| Details tab: % Complete / Billed | P3 LOW | High | Requires modeling work |
| Export Field Sets | P3 LOW | Medium | Power user feature |
| Forecasting migration deploy | P0 BLOCKER | Low (infra) | Prerequisite for forecasting |
| MV vs JS calculation audit | P1 HIGH | Medium | Data integrity |

---

## 6. What Alleato Has That Procore Does Not

These are Alleato-unique features that represent competitive differentiation:

1. **AI Assistant Chat** — `MessageSquare` button opens a conversational AI interface for budget analysis. Procore has no equivalent.
2. **Budget Reports submenu** — 4 named reports (Budget Modifications, Buyout Summary, Legacy Budget Detail, Monitored Resources) accessible directly from the header. Procore routes these through a separate Reports module.
3. **Cost Codes Tab** — A dedicated tab for managing the project's cost code structure inline with the budget. Procore manages this at the company/project settings level, not inline in the budget tool.
4. **Budget Modifications Tab** — Dedicated tab showing all budget modifications in chronological order. Procore shows this inline in the main table only.

---

## 7. Overall Feature Completion Checklist

### Phase Status (from plans-budget.md, updated with actual code review):

| Phase | Documented Completion | Actual Code State |
|-------|----------------------|------------------|
| Phase 1: DB Schema | 100% | ~90% (forecasting_curves not deployed) |
| Phase 2: Backend APIs | 95% | ~85% (views returns 500, history may be mocked) |
| Phase 3: Budget Views | 90% | ~50% (views API broken, column switching not testable) |
| Phase 4: Budget Filters | 100% | ~85% (sort is "coming soon") |
| Phase 5: Budget Table | 100% | ~80% (missing 4 structural columns) |
| Phase 6: Tab Navigation | 90% | ~85% (tabs work, content partial) |
| Phase 7: Testing | 65% | Unverified (500 errors block testing) |
| Phase 8: Advanced (Forecasting) | 40% | ~20% (migration not deployed, no curves) |

**Overall Actual Completion: ~62%** (vs. documented 65%, adjusted down for discovered implementation gaps)

---

## 8. Recommended Action Plan

### Immediate (P0 — This Sprint)
1. Fix the Budget Views API 500 error (add RLS policy to `budget_views` and `budget_view_columns`)
2. Deploy the forecasting migration (`forecasting_method` on `budget_lines`, `forecasting_curves` table)

### Short-Term (P1 — Next 2 Sprints)
3. Add Unit Qty, UOM, Unit Cost, Calculation Method as optional table columns (toggleable via Budget Views)
4. Wire TanStack Table sorting (remove "Coming soon" labels)
5. Auto-snapshot on budget lock
6. Add snapshot comparison (delta columns)

### Medium-Term (P2 — Next 4 Sprints)
7. Implement Analyze Variance fullscreen mode
8. Add forecasting curve selection + monthly cash flow projection
9. Add History tab date/user filters and CSV export
10. Audit and consolidate JS aggregation vs. `mv_budget_rollup`

### Longer-Term (P3 — Roadmap)
11. Add % Complete tracking to Details tab
12. Add Billed to Date from commitment SOV
13. Implement Export Field Sets

---

*Report generated from static code analysis. Procore data sourced from crawl captured 2025-12-29. Implementation data sourced from git HEAD as of 2026-03-08.*
