# Financial Table FK Inventory

Last reviewed: 2026-07-06

This document inventories the financial database tables in `alleato-pm`, what
each table controls, and the FK / FX fields that define ownership and rollup
relationships.

Assumption: "FX fields" means foreign-key fields. This inventory uses `FK / FX`
to preserve that wording while documenting actual foreign keys.

## Sources Checked

- `frontend/src/types/database.types.ts` for generated table and FK truth.
- linked live database catalog queries for schema and constraint context.
- `frontend/src/components/dev-tools/db-inventory.generated.json` for generated table purpose and usage notes. This inventory was generated at `2026-07-01T22:10:03.769Z`, so row counts and dormant/dead labels should be rechecked before destructive cleanup.
- `docs/architecture/FINANCIAL-TOOLS-DATA-MAP.md` for older financial tool ownership context.

## High-Risk Integrity Findings

| Finding | Impact | Recommended Direction |
| ------- | ------ | --------------------- |
| `subcontract_sov_items.budget_code` is text, not a FK. | Subcontract SOV rows can store arbitrary budget-code text and still drive commitment totals, invoice seed data, and budget rollups. | Add `project_budget_code_id` FK, backfill resolvable rows, require FK on new writes, and quarantine unresolved legacy rows. |
| `purchase_order_sov_items.budget_code` has the same text-backed gap. | Purchase order SOV rows have the same integrity risk as subcontract SOV rows. | Use the same FK migration path as subcontract SOV rows. |
| Some financial domains have active and dormant twins. | Product code can accidentally read or write the wrong table, especially around budget changes, SOVs, PCOs, and payments. | Pick one canonical table per workflow, mark old tables read-only/deprecated, then remove unused readers. |
| Some audit tables are trigger-backed while others are hand-written. | History coverage is inconsistent. Invoice and change-event audits can silently miss state changes if route code forgets to write audit rows. | Move critical audit trails to DB triggers or shared service-layer writers. |
| Migration history still references old `public.contracts` FKs, but generated current types do not expose a `contracts` table. | Historical migrations and stale docs can mislead agents into using the wrong contract owner. | Treat `prime_contracts` as the current owner unless live DB/type regeneration proves otherwise. |

## Canonical Budget-Code Ownership

| Concept | Table | Intended Meaning |
| ------- | ----- | ---------------- |
| Global code dictionary | `cost_codes` | The master list of valid cost codes across the system. |
| Cost type dictionary | `cost_code_types` | Labor/material/subcontract/etc. classification. |
| Project-enabled budget code | `project_budget_codes` | The project-scoped selectable budget code: project + optional sub-job + cost code + cost type. |
| Budget money row | `budget_lines` | The actual project budget amount row, tied to `project_budget_codes.id`. |
| Correct financial reference for new SOV rows | `project_budget_codes.id` | This should be the canonical FK for commitment SOV rows after repair. |

## Reference And Project Budget Controls

| Table | Controls | FK / FX Fields | Notes |
| ----- | -------- | -------------- | ----- |
| `cost_code_divisions` | Cost code division groupings. | No declared FK. | Reference table. |
| `cost_codes` | Global master cost code table. | `division_id -> cost_code_divisions(id)` | Global dictionary, not project-specific activation. |
| `cost_code_types` | Cost type classifications. | No declared FK. | Reference table. |
| `project_budget_codes` | Per-project budget code activation and selector source. | `project_id -> projects(id)`; `cost_code_id -> cost_codes(id)`; `cost_type_id -> cost_code_types(id)`; `sub_job_id -> sub_jobs(id)` | This is the project-scoped canonical budget-code key. |
| `project_budget_settings` | Per-project budget UI/settings configuration. | `project_id -> projects(id)` | Generated inventory says schema/API exist but no saved settings. |
| `budget_views` | Saved budget column-layout state. | `project_id -> projects(id)` | UI state, not financial truth. |
| `budget_view_columns` | Columns for saved budget views. | `view_id -> budget_views(id)` | UI state, not financial truth. |

## Budget Ledger And Forecasting

| Table | Controls | FK / FX Fields | Notes |
| ----- | -------- | -------------- | ----- |
| `budget_lines` | Core project budget line items. | `project_id -> projects(id)`; `project_budget_code_id -> project_budget_codes(id)`; `cost_code_id -> cost_codes(id)`; `cost_type_id -> cost_code_types(id)`; `sub_job_id -> sub_jobs(id)`; `default_curve_id -> forecasting_curves(id)`; `source_contract_line_item_id -> contract_line_items(id)`; `estimate_id -> estimates(estimate_id)` | Core operational budget table. |
| `budget_line_history` | Immutable audit history for `budget_lines`. | `budget_line_id -> budget_lines(id)`; `project_id -> projects(id)` | Trigger-backed per generated inventory. |
| `budget_modifications` | Formal budget revision document header. | `project_id -> projects(id)` | Active budget change document owner. |
| `budget_mod_lines` | Line-level deltas for `budget_modifications`. | `budget_modification_id -> budget_modifications(id)`; `project_id -> projects(id)`; `cost_code_id -> cost_codes(id)`; `cost_type_id -> cost_code_types(id)`; `sub_job_id -> sub_jobs(id)`; `change_event_id -> change_events(id)` | Generated inventory identifies this as the live modification line table. |
| `budget_modification_lines` | Older/alternate budget modification line table. | `budget_modification_id -> budget_modifications(id)`; `budget_line_id -> budget_lines(id)` | Generated inventory says empty/drop candidate. |
| `budget_changes` | Older budget change mechanism. | `project_id -> projects(id)`; `change_event_id -> change_events(id)` | Generated inventory says effectively dead. |
| `budget_forecast_line_items` | Dormant budget forecasting detail. | `budget_line_id -> budget_lines(id)`; `project_id -> projects(id)` | Dormant per generated inventory. |
| `budget_line_forecasts` | Dormant budget-line forecast records. | `budget_line_id -> budget_lines(id)`; `curve_id -> forecasting_curves(id)` | Dormant per generated inventory. |
| `budget_line_item_history` | Older history table. | No declared FK. | Generated inventory says likely superseded by `budget_line_history`. |
| `budget_snapshots` | Budget snapshot mechanism. | `project_id -> projects(id)` | Generated inventory says dormant. |
| `forecasting` | Forecasting header/summary table. | No declared FK. | Generated inventory says dormant. |
| `forecasting_curves` | Forecast curve definitions. | `company_id -> companies(id)` | Generated inventory says dormant. |
| `cost_factors` | Cost factor reference table. | No declared FK. | Generated inventory says dormant. |
| `cost_forecasts` | Cost forecast table. | No declared FK. | Generated inventory says dormant. |
| `cost_code_division_updates_audit` | Cost-code division update audit. | No declared FK. | Generated inventory says dormant. |

## Prime Contract And Owner Billing

| Table | Controls | FK / FX Fields | Notes |
| ----- | -------- | -------------- | ----- |
| `prime_contracts` | Owner contract header. | `project_id -> projects(id)`; `contract_company_id -> companies(id)`; `client_id -> companies(id)`; `contractor_id -> companies(id)`; `architect_engineer_id -> companies(id)`; `vendor_id -> companies(id)`; `estimate_id -> estimates(estimate_id)` | Active owner-contract table. |
| `contract_line_items` | Prime contract SOV line items in current active routes. | `contract_id -> prime_contracts(id)`; `budget_code_id -> project_budget_codes(id)` | Despite inventory wording, this table is actively used for prime contract line items and has the right budget-code FK. |
| `prime_contract_sovs` | Alternate/dormant prime contract SOV table. | `contract_id -> prime_contracts(id)`; `budget_code_id -> project_budget_codes(id)`; `cost_code -> cost_codes(id)` | Generated inventory says dormant. |
| `prime_contract_change_orders` | Owner-side approved/executed change orders. | `project_id -> projects(id)`; `contract_id -> prime_contracts(id)`; `prime_contract_id -> prime_contracts(id)` | Projected from Acumatica change orders in current sync notes. |
| `prime_contract_pcos` | Prime contract PCO header table. | `project_id -> projects(id)`; `prime_contract_id -> prime_contracts(id)`; `promoted_to_co_id -> prime_contract_change_orders(id)` | Generated inventory says dormant. Verify before building on it. |
| `prime_contract_change_order_related_items` | Related item links for prime contract change orders. | `prime_co_id -> prime_contract_change_orders(id)`; `project_id -> projects(id)` | Lightly used. |
| `prime_contract_project_settings` | Per-project prime contract settings. | `project_id -> projects(id)` | Settings layer. |
| `prime_contract_payment_applications` | Owner pay application header. | `project_id -> projects(id)`; `contract_id -> prime_contracts(id)`; `billing_period_id -> billing_periods(id)` | Generated inventory says dormant. |
| `payment_application_line_items` | Pay application line items. | `payment_application_id -> prime_contract_payment_applications(id)`; `sov_item_id -> prime_contract_sovs(id)`; `change_order_id -> contract_change_orders(id)` | Dormant per generated inventory. |
| `prime_contract_payments` | Owner payment records. | `project_id -> projects(id)`; `contract_id -> prime_contracts(id)`; `payment_application_id -> prime_contract_payment_applications(id)` | Generated inventory says many owner payments are tracked through Acumatica mirrors instead. |
| `owner_invoices` | Owner invoices/pay applications sent to the owner. | `prime_contract_id -> prime_contracts(id)`; `billing_period_id -> billing_periods(id)`; `payment_application_id -> prime_contract_payment_applications(id)` | Active owner invoicing table. |
| `owner_invoice_line_items` | Line-item detail for owner invoices. | `invoice_id -> owner_invoices(id)` | Active; generated inventory shows line-item granularity in use. |
| `invoice_payments` | Invoice payment join table. | `project_id -> projects(id)`; `owner_invoice_id -> owner_invoices(id)`; `subcontractor_invoice_id -> subcontractor_invoices(id)` | Generated inventory says dormant. |
| `payment_transactions` | Generic payment transaction table. | `contract_id -> prime_contracts(id)`; `invoice_id -> owner_invoices(id)` | Generated inventory says dormant. |
| `billing_periods` | Project billing period definitions. | `project_id -> projects(id)` | Generated inventory says dormant, but several invoice/payment tables reference it. |
| `billing_invitations` | Billing invitation infrastructure. | `project_id -> projects(id)`; `billing_period_id -> billing_periods(id)` | Dormant per generated inventory. |
| `contract_billing_periods` | Older contract billing periods. | `contract_id -> prime_contracts(id)` | Dormant per generated inventory. |
| `contract_payments` | Older contract payment table. | `contract_id -> prime_contracts(id)`; `billing_period_id -> contract_billing_periods(id)` | Not the same as `prime_contract_payments`; dormant per inventory. |
| `contract_snapshots` | Contract snapshot records. | `contract_id -> prime_contracts(id)` | Dormant per inventory. |
| `contract_views` | Contract UI view state. | `company_id -> companies(id)` | Dormant per inventory. |

## Commitments, SOV, And Subcontractor Billing

| Table | Controls | FK / FX Fields | Notes |
| ----- | -------- | -------------- | ----- |
| `subcontracts` | Subcontract commitment headers. | `project_id -> projects(id)`; `prime_contract_id -> prime_contracts(id)` | Active commitment table; audited through `commitment_audit_log`. |
| `purchase_orders` | Purchase order commitment headers. | `project_id -> projects(id)`; `prime_contract_id -> prime_contracts(id)`; `bill_to_company_id -> companies(id)`; `bill_to_contact_id -> people(id)`; `ship_to_company_id -> companies(id)`; `ship_to_contact_id -> people(id)` | Active commitment table; audited through `commitment_audit_log`. |
| `subcontract_sov_items` | Subcontract SOV line items. | `subcontract_id -> subcontracts(id)`; `project_budget_code_id -> project_budget_codes(id)` | Legacy budget-code text remains for transition/display; new rows still need API enforcement. |
| `purchase_order_sov_items` | Purchase order SOV line items. | `purchase_order_id -> purchase_orders(id)`; `project_budget_code_id -> project_budget_codes(id)` | Legacy budget-code text remains for transition/display; new rows still need API enforcement. |
| `subcontractor_sov_submissions` | Subcontractor-submitted SOV workflow header. | `commitment_id -> subcontracts(id)`; `project_id -> projects(id)`; `submitted_by -> people(id)`; `reviewed_by -> people(id)` | Generated inventory says dormant. |
| `subcontractor_sov_items` | Subcontractor-submitted SOV detail. | `submission_id -> subcontractor_sov_submissions(id)`; `source_sov_item_id -> subcontract_sov_items(id)` | Near-dead sibling of canonical subcontract SOV table. |
| `subcontractor_invoices` | Subcontractor pay application/invoice header. | `project_id -> projects(id)`; `subcontract_id -> subcontracts(id)`; `purchase_order_id -> purchase_orders(id)`; `billing_period_id -> billing_periods(id)`; `acumatica_ap_bill_id -> acumatica_ap_bills(id)` | Active full state-machine table. |
| `subcontractor_invoice_line_items` | Subcontractor invoice line detail. | `invoice_id -> subcontractor_invoices(id)` | Generated inventory says only a small subset of invoices have line rows. |
| `subcontractor_invoice_audit_log` | Audit log for subcontractor invoice state changes. | `invoice_id -> subcontractor_invoices(id)` | App-written audit, not trigger-backed. |
| `subcontractor_invoice_emails` | Subcontractor invoice email log. | `invoice_id -> subcontractor_invoices(id)` | Dormant per inventory. |
| `subcontractor_invoice_related_items` | Related items for subcontractor invoices. | `invoice_id -> subcontractor_invoices(id)` | Dormant per inventory. |
| `commitment_payments` | Payments issued against commitments, projected from Acumatica checks. | `project_id -> projects(id)`; `subcontract_id -> subcontracts(id)`; `purchase_order_id -> purchase_orders(id)`; `subcontractor_invoice_id -> subcontractor_invoices(id)`; `acumatica_ap_bill_id -> acumatica_ap_bills(id)`; `acumatica_check_id -> acumatica_checks(id)` | Backend sync writes this. |
| `commitment_audit_log` | Trigger-driven audit for subcontract and purchase-order mutations. | No declared FK. | Table stores IDs but generated types do not declare FK backstops. |
| `commitment_pcos` | Commitment PCO header table. | `project_id -> projects(id)`; `promoted_to_co_id -> contract_change_orders(id)` | Generated inventory says dormant. |
| `commitment_related_items` | Commitment related items. | `project_id -> projects(id)` | Dormant per inventory. |
| `commitment_change_order_lines` | Line items for commitment change orders. | `budget_line_id -> budget_lines(id)`; `cost_code_id -> cost_codes(id)`; `cost_type_id -> cost_code_types(id)` | Line table has stronger cost-code structure than commitment SOV tables. |
| `contract_change_orders` | Commitment-side change order header. | `project_id -> projects(id)` | Despite the name, generated inventory says these are commitment-side CCOs, not prime contract COs. |

## Change Management

| Table | Controls | FK / FX Fields | Notes |
| ----- | -------- | -------------- | ----- |
| `change_events` | Neutral upstream project change event. | `project_id -> projects(id)`; `prime_contract_id -> prime_contracts(id)`; `potential_change_order_id -> potential_change_orders(id)` | Active change-management source object. |
| `change_event_line_items` | Cost/revenue/vendor/contract detail for change events. | `change_event_id -> change_events(id)`; `budget_line_id -> budget_lines(id)`; `budget_code_id -> budget_lines(id)`; `contract_id -> prime_contracts(id)`; `vendor_id -> companies(id)` | `budget_code_id` is a legacy name pointing to `budget_lines(id)`. |
| `change_event_history` | Change event audit trail. | `change_event_id -> change_events(id)` | App-written audit. |
| `change_event_rfqs` | RFQs sent from change events to vendors. | `project_id -> projects(id)`; `change_event_id -> change_events(id)`; `assigned_company_id -> companies(id)`; `assigned_contact_id -> people(id)` | Active RFQ support table. |
| `change_event_rfq_responses` | Vendor RFQ response rows. | `rfq_id -> change_event_rfqs(id)`; `line_item_id -> change_event_line_items(id)`; `responder_company_id -> companies(id)` | Sparse but active support table. |
| `change_event_approvals` | Change event approval workflow. | `change_event_id -> change_events(id)` | Dormant per inventory. |
| `change_event_candidates` | AI/intelligence candidate records before formal change-event promotion. | `project_id -> projects(id)` | Staging/intelligence support. |
| `change_event_pco_links` | Change event to PCO links. | `change_event_id -> change_events(id)` | Dormant per inventory. |
| `change_event_related_items` | Related item links for change events. | `project_id -> projects(id)`; `change_event_id -> change_events(id)` | Dormant per inventory. |
| `potential_change_orders` | Numeric PCO header for grouping change events and converting to COs. | `project_id -> projects(id)` | Distinct from UUID `prime_contract_pcos` and `commitment_pcos`. |
| `potential_change_order_line_items` | Line items for numeric PCOs. | `pco_id -> potential_change_orders(id)`; `change_event_line_item_id -> change_event_line_items(id)` | Active/current PCO line model per generated inventory. |
| `pco_change_events` | PCO to change event join. | `pco_id -> potential_change_orders(id)`; `change_event_id -> change_events(id)` | Dormant per inventory. |
| `pco_line_items` | Older/dormant PCO line table. | `change_event_id -> change_events(id)`; `change_event_line_item_id -> change_event_line_items(id)` | Dormant per inventory. |
| `pco_versions` | PCO version history. | `pco_id -> potential_change_orders(id)` | Dormant per inventory. |
| `prime_potential_change_orders` | Older prime PCO table. | No declared FK in generated types. | Verify before use. |
| `pcco_line_items` | Older PCCO line table. | `pcco_id -> prime_contract_change_orders(id)` | Dormant per inventory. |
| `change_orders` | Generic change order table. | `project_id -> projects(id)` | Generated inventory says dead; real CO data lives in `contract_change_orders` and `prime_contract_change_orders`. |
| `change_order_lines` | Generic change order lines. | No declared FK in generated types. | Verify before use. |
| `change_order_costs` | Generic change order cost records. | No declared FK in generated types. | Verify before use. |
| `change_order_approvals` | Generic change order approvals. | No declared FK in generated types. | Verify before use. |

## Direct Costs And Vendor Links

| Table | Controls | FK / FX Fields | Notes |
| ----- | -------- | -------------- | ----- |
| `direct_costs` | Project-attributed AP/direct cost header. | `project_id -> projects(id)`; `vendor_id -> companies(id)`; `employee_id -> people(id)` | Domain projection of Acumatica AP bills. |
| `direct_cost_line_items` | Line items for direct costs. | `direct_cost_id -> direct_costs(id)`; `budget_code_id -> project_budget_codes(id)` | Correctly references canonical project budget code. |
| `project_vendors` | User-managed project-vendor associations. | `project_id -> projects(id)`; `vendor_id -> companies(id)`; `added_by -> people(id)` | Project vendor membership, not payment truth. |
| `vendor_contacts` | Vendor contact associations. | `company_id -> companies(id)`; `person_id -> people(id)` | Generated inventory says UI reads exist but no writer found. |
| `vendors` | Legacy/vendor table. | No declared FK in generated types. | Some older direct-cost docs reference `vendors`; newer paths often use `companies`. |

## Acumatica Sync And ERP Mirrors

| Table | Controls | FK / FX Fields | Notes |
| ----- | -------- | -------------- | ----- |
| `acumatica_accounts` | Acumatica chart-of-accounts mirror. | No declared FK. | No active app reads per generated inventory. |
| `acumatica_ap_bills` | Acumatica AP bill mirror. | `project_id -> projects(id)`; `company_id -> companies(id)` | Source for direct-cost projection. |
| `acumatica_ap_bill_lines` | Acumatica AP bill line mirror. | `bill_id -> acumatica_ap_bills(id)` | Delete and reinsert per sync cycle. |
| `acumatica_ar_invoices` | Acumatica AR invoice mirror. | `project_id -> projects(id)`; `billing_period_id -> billing_periods(id)` | Read by accounting invoices/dashboard/WIP. |
| `acumatica_ar_invoice_lines` | Acumatica AR invoice line mirror. | `invoice_id -> acumatica_ar_invoices(id)` | ERP mirror line table. |
| `acumatica_change_orders` | Acumatica change-order mirror. | `project_id -> projects(id)`; `company_id -> companies(id)` | Projects into prime and commitment change orders. |
| `acumatica_checks` | Acumatica AP check/payment mirror. | `company_id -> companies(id)` | Projects into `commitment_payments`; also used to mark matching subcontractor invoices paid. |
| `acumatica_customers` | Acumatica customer mirror. | No declared FK. | Used for AR invoice customer-name enrichment. |
| `acumatica_payment_applications` | Acumatica payment application join/mirror. | No declared FK. | Mirror/support table. |
| `acumatica_payments` | Acumatica AR payment mirror. | `project_id -> projects(id)`; `company_id -> companies(id)` | Accounting/payment read path. |
| `acumatica_project_budgets` | Acumatica project budget mirror. | `project_id -> projects(id)`; `company_id -> companies(id)` | Comparison/WIP source, not canonical app budget. |
| `acumatica_projects` | Acumatica project mirror. | `local_project_id -> projects(id)` | Sync can upsert local `projects`. |
| `acumatica_project_tasks` | Acumatica project-task mirror. | No declared FK. | Accounting cross-reference support. |
| `acumatica_purchase_orders` | Acumatica purchase-order mirror. | `project_id -> projects(id)`; `company_id -> companies(id)` | Projects into `purchase_orders`. |
| `acumatica_subcontracts` | Acumatica subcontract mirror. | `project_id -> projects(id)`; `company_id -> companies(id)`; `vendor_uuid -> companies(id)` | Projects into `subcontracts` and `subcontract_sov_items`. |
| `acumatica_sync_state` | Sync cursor state. | No declared FK. | Determines incremental resume position. |
| `acumatica_sync_runs` | Acumatica sync run ledger. | No declared FK. | Generated inventory says writer exists but no rows recorded. |
| `acumatica_outbound_audit_logs` | Outbound Acumatica export audit. | `project_id -> projects(id)` | Generated inventory says writer exists but is not triggered in production. |
| `acumatica_dual_format_audit` | Acumatica dual-format audit. | No declared FK. | Usage requires owner verification. |
| `erp_sync_log` | Frontend-initiated ERP sync audit. | `project_id -> projects(id)` | Separate from backend Python `acumatica_sync_runs`. |

## Reconciliation And Legacy Financial Tables

| Table | Controls | FK / FX Fields | Notes |
| ----- | -------- | -------------- | ----- |
| `reconciliation_runs` | Job Planner to Acumatica reconciliation run ledger. | No declared FK. | Tracks finding counts, projects scanned, and dollars at risk. |
| `reconciliation_findings` | Reconciliation finding rows. | `last_run_id -> reconciliation_runs(id)` | Stores current/historical mismatches. |
| `financial_contracts` | Older financial contract table. | `company_id -> companies(id)`; `project_id -> projects(id)` | Dormant per inventory. |
| `schedule_of_values` | Generic SOV header. | `contract_id -> prime_contracts(id)` | Generated inventory says dead reads/never written. |
| `sov_line_items` | Generic SOV line items. | `sov_id -> schedule_of_values(id)` | Generated inventory says same dead family as `schedule_of_values`. |
| `fm_cost_factors` | FM cost factors. | No declared FK. | Dormant per inventory. |

## Financial Document Junctions

These are not the financial source of truth, but they attach documents to
financial records and affect auditability.

| Table | Controls | FK / FX Fields | Notes |
| ----- | -------- | -------------- | ----- |
| `prime_contract_documents` | Prime contract documents. | `prime_contract_id -> prime_contracts(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Pattern C junction. |
| `prime_contract_change_order_documents` | Prime contract change order documents. | `prime_contract_change_order_id -> prime_contract_change_orders(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Pattern C junction. |
| `prime_contract_pco_documents` | Prime contract PCO documents. | `pco_id -> prime_contract_pcos(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Tied to dormant `prime_contract_pcos`. |
| `contract_documents` | Older contract documents. | `contract_id -> prime_contracts(id)` | Generated inventory says effectively unused. |
| `subcontract_documents` | Subcontract documents. | `subcontract_id -> subcontracts(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Pattern C junction. |
| `purchase_order_documents` | Purchase order documents. | `purchase_order_id -> purchase_orders(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Pattern C junction. |
| `owner_invoice_documents` | Owner invoice documents. | `owner_invoice_id -> owner_invoices(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Pattern C junction. |
| `subcontractor_invoice_documents` | Subcontractor invoice documents. | `subcontractor_invoice_id -> subcontractor_invoices(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Pattern C junction. |
| `commitment_change_order_documents` | Commitment change order documents. | `commitment_change_order_id -> contract_change_orders(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Pattern C junction. |
| `change_order_documents` | Generic change order documents. | `change_order_id -> change_orders(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Tied to dead generic `change_orders`; verify before use. |
| `change_event_documents` | Change event documents. | `change_event_id -> change_events(id)`; `document_metadata_id -> document_metadata(id)`; `document_type -> document_type_taxonomy(type_key)` | Pattern C junction. |
| `change_events_documents_links` | Older change event document links. | `project_id -> projects(id)`; `change_event_id -> change_events(id)`; `project_document_id -> project_documents(id)` | Dormant per generated inventory. |

## Derived Views And Financial Read Models

These are not tables, but they are important read surfaces and can hide source
table confusion.

| View | Controls / Purpose | Base Truth To Verify |
| ---- | ------------------ | -------------------- |
| `v_budget_lines` | Budget line read model used by several FK joins in generated types. | `budget_lines` plus joined cost/project data. |
| `commitments_unified` | Unified read model for `subcontracts` and `purchase_orders`. | `subcontracts`, `purchase_orders`, and their SOV tables. |
| `subcontracts_with_totals` | Subcontract totals read model. | `subcontracts` plus `subcontract_sov_items`. |
| `purchase_orders_with_totals` | Purchase order totals read model. | `purchase_orders` plus `purchase_order_sov_items`. |
| `prime_contract_financial_summary` | Prime contract summary read model. | `prime_contracts`, contract line items, owner invoices/payments, and change orders. |
| `cost_by_category` | Cost category reporting view. | Verify against direct costs, commitments, and budget rollups before use. |
| `cost_codes_with_division_title` | Cost-code display view with division title. | `cost_codes` and `cost_code_divisions`. |
| `direct_costs_with_project` | Direct cost read model with project context. | `direct_costs`. |
| `sov_line_items_with_percentage` | Generic SOV line display view. | `sov_line_items`; likely part of dead generic SOV family. |

## Immediate Repair Priority

| Priority | Work | Reason |
| -------- | ---- | ------ |
| P0 | Add canonical `project_budget_code_id` to `subcontract_sov_items` and `purchase_order_sov_items`. | These are core financial rows and currently bypass the canonical project budget-code key. |
| P0 | Require canonical budget-code FK on all new commitment SOV writes. | Stops new bad data before legacy cleanup finishes. |
| P1 | Backfill resolvable SOV rows and produce an unresolved-row ledger. | Makes legacy ambiguity explicit instead of silently normalized. |
| P1 | Update budget rollups, invoice seeding, PDF/export, and scope lookup to prefer the FK. | Removes dependency on text normalization. |
| P2 | Decide owners for dormant/dead twins: `budget_changes`, `budget_modification_lines`, `schedule_of_values`, `prime_contract_sovs`, `change_orders`, old PCO tables, and payment twins. | Reduces the chance that future code writes to the wrong table. |
