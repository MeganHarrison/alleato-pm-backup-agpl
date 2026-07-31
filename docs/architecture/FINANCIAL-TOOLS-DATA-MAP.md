# Financial Tools Data Map

> Reference: Which Supabase tables power each financial tool page, and what Acumatica data maps to them.

---

## Page-by-Page Breakdown

### 1. Budget
**Supabase tables:** `budget_lines`, `v_budget_lines` (view), `direct_cost_line_items`, `subcontract_sov_items`, `purchase_order_sov_items`, `pco_line_items`, `commitment_change_order_lines`
**Acumatica sync:** None active. Staging table `acumatica_project_budgets` exists for comparison (used by AI financial insights).

### 2. Prime Contracts
**Supabase tables:** `prime_contracts`, `contract_line_items`, `contract_change_orders`, `prime_contract_payment_applications`, `prime_contract_payments`
**Acumatica sync:** None active.
- `prime_contract_payment_applications` = billing draws submitted against the prime contract (AIA G702/G703 style — period, amount, retention, net)
- `prime_contract_payments` = actual cash received from the owner against those applications

### 3. Commitments
**Supabase tables:** `commitments_unified` (view), `subcontracts_with_totals` (view), `purchase_orders_with_totals` (view)
**Acumatica sync:** `erp_status` column exists. Staging tables `acumatica_subcontracts` and `acumatica_purchase_orders` exist but no active sync button.

### 4. Change Events
**Supabase tables:** `change_events`
**Acumatica sync:** None. Entirely native.

### 5. Change Orders
**Supabase tables:** `change_orders` (commitment COs), `prime_contract_change_orders` (PCCOs), `contract_change_orders`
**Acumatica sync:** `acumatica_external_key` columns exist. Staging table `acumatica_change_orders` exists. No active sync button.

### 6. Direct Costs
**Supabase tables:** `direct_costs`, `direct_cost_line_items`, `cost_codes`
**Acumatica sync:** **YES — Active sync button.** Pulls AP Bills from Acumatica into `direct_costs` via `POST /api/sync/acumatica/direct-costs`. Also mirrors raw data to `acumatica_ap_bills` + `acumatica_ap_bill_lines` staging tables.

### 7. Invoicing
**Supabase tables:** `owner_invoices`, `owner_invoice_line_items`, joined through `prime_contracts` for project scoping
**Acumatica sync:** None active. Staging tables `acumatica_ar_invoices` + `acumatica_ar_invoice_lines` exist.

---

## Two-Layer Architecture

### Layer 1: Direct sync into app tables (active, writes to production tables)

Only **two entities** are actively synced today:

| Acumatica Entity | Supabase App Table | Trigger |
|---|---|---|
| Vendors | `vendors` (upsert by `acumatica_vendor_id`) | Sync button on Vendors/Companies page |
| AP Bills | `direct_costs` (upsert by `acumatica_ref_nbr`) | Sync button on Direct Costs page |

### Layer 2: Raw ERP staging tables (schema exists, no active UI sync)

These `acumatica_*` tables were created by migrations but **no UI buttons trigger them yet**:

| Staging Table | Acumatica Source | Acumatica API Endpoint | Potential App Table Target |
|---|---|---|---|
| `acumatica_ar_invoices` + `_lines` | AR Invoices | `ARInvoice` | `owner_invoices` / `owner_invoice_line_items` |
| `acumatica_ap_bills` + `_lines` | AP Bills | `Bill` | `direct_costs` (already synced via Layer 1) |
| `acumatica_checks` | AP Checks/Payments | `Check` | `payment_transactions` or new |
| `acumatica_project_budgets` | Project Budget | `ProjectBudget` | `budget_lines` (comparison only today) |
| `acumatica_change_orders` | Change Orders | `ChangeOrder` | `change_orders` / `contract_change_orders` |
| `acumatica_subcontracts` | Subcontracts | `Subcontract` | subcontracts (via `commitments_unified`) |
| `acumatica_purchase_orders` | Purchase Orders | `PurchaseOrder` | purchase orders (via `commitments_unified`) |
| `acumatica_payments` | AR Payments | `Payment` | `prime_contract_payments` |

---

## Acumatica AR (Revenue Side) — What's Available

Acumatica provides **two distinct AR entities** that map to our Prime Contracts financial data:

### AR Invoices → `owner_invoices` / `prime_contract_payment_applications`

| Acumatica Field | Description | Maps To |
|---|---|---|
| `ReferenceNbr` | Invoice number | `owner_invoices.invoice_number` or `prime_contract_payment_applications.application_number` |
| `Type` | Invoice, Credit Memo, Debit Memo | Determines record type |
| `Status` | Open, Closed, Released | `status` field |
| `Amount` | Total invoice amount | `amount` |
| `Balance` | Outstanding balance | Derived field |
| `Date` | Invoice date | `created_at` / `period_from` |
| `DueDate` | Payment due date | Could add column |
| `Customer` | Customer/Owner reference | Linked via `contract_company_id` |
| `Project` | Project reference | `project_id` |
| `Details[].InventoryID` | Line item code | `owner_invoice_line_items.cost_code_id` |
| `Details[].Amount` | Line item amount | `owner_invoice_line_items.approved_amount` |
| `Details[].Description` | Line item description | `owner_invoice_line_items.description` |

**Staging table:** `acumatica_ar_invoices` + `acumatica_ar_invoice_lines`

### AR Payments → `prime_contract_payments`

| Acumatica Field | Description | Maps To |
|---|---|---|
| `ReferenceNbr` | Payment/check number | `prime_contract_payments.payment_number` |
| `Type` | Payment, Prepayment, Refund | `method` or new `payment_type` |
| `Status` | Open, Closed, Released, Voided | `status` (would need to add) |
| `CashAccount` | Bank account | Could add column |
| `PaymentAmount` | Amount paid | `prime_contract_payments.amount` |
| `ApplicationDate` | Date of payment | `prime_contract_payments.payment_date` |
| `PaymentRef` | External reference (check #) | `prime_contract_payments.reference_number` |
| `DocumentsToApply[].DocType` | Applied to Invoice type | Links payment to invoice |
| `DocumentsToApply[].RefNbr` | Applied to Invoice number | `prime_contract_payments.payment_application_id` |
| `DocumentsToApply[].AmountPaid` | Amount applied to this invoice | Partial payment tracking |

**Staging table:** `acumatica_payments`

---

## Acumatica AP (Cost Side) — What's Available

### AP Bills → `direct_costs` (ALREADY SYNCED)

| Acumatica Field | Description | Maps To |
|---|---|---|
| `ReferenceNbr` | Bill number | `direct_costs.acumatica_ref_nbr` |
| `VendorRef` | Vendor's invoice # | `direct_costs.invoice_number` |
| `Vendor` | Vendor reference | `direct_costs.vendor_id` |
| `Amount` | Total bill amount | `direct_costs.total_amount` |
| `Date` | Bill date | `direct_costs.cost_date` |
| `Status` | Open, Closed, Released | `direct_costs.erp_status` |
| `Details[].InventoryID` | Cost code | `direct_cost_line_items.budget_code_id` |
| `Details[].Amount` | Line amount | `direct_cost_line_items.line_total` |

### AP Checks → `acumatica_checks` (staging only)

| Acumatica Field | Description | Potential Maps To |
|---|---|---|
| `ReferenceNbr` | Check number | New payment tracking table |
| `Vendor` | Vendor paid | Links to `vendors` |
| `CashAccount` | Bank account | Informational |
| `PaymentAmount` | Amount paid | Payment amount |
| `PaymentDate` | Date issued | Payment date |
| `DocumentsToApply[].RefNbr` | Applied to Bill # | Links check → direct cost |

---

## Key Terminology Mapping

| Our App Term | Acumatica Term | Direction |
|---|---|---|
| Owner Invoice | AR Invoice | We bill the owner |
| Payment Application | AR Invoice (with Application) | Formal billing draw |
| Payment Received | AR Payment | Owner pays us |
| Direct Cost | AP Bill | Vendor bills us |
| Payment Issued | AP Check | We pay the vendor |
| Commitment (Subcontract) | Subcontract | Agreement with sub |
| Commitment (PO) | Purchase Order | Agreement with supplier |
| Change Order | Change Order | Scope/cost change |
| Budget Line | Project Budget | Cost breakdown |

---

## What's NOT in Acumatica

These are Alleato-native only (no ERP equivalent):

- **Change Events** — internal tracking of potential changes before they become COs
- **RFIs, Submittals, Specs** — document management tools
- **Schedule** — project scheduling
- **Directory** — people/company management (though vendors sync)
- **Meetings, Daily Logs** — field operations

---

*Last updated: 2026-03-17*
