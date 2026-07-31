# Alleato Group Billing — CSV Import Spec

*Column names, generated columns and percentage conventions verified against the live PM APP
database (`lgveqfnpkxvzbnnwuled`) and the invoicing calculation layer on 2026-07-30.*

Maps Form APP / CS / CO onto the Alleato PM platform tables. Column names below
are the real database columns, verified against `frontend/src/types/database.types.ts`.

**Load order matters.** Parents before children, always:

```
contracts  →  SOV lines  →  change orders  →  CO lines  →  pay app header  →  pay app lines
```

---

## 1. Which owner-side tables to use

There are two parallel prime-contract billing systems in the schema:

| | System A — "Payment Applications" | System B — "Owner Invoices" |
|---|---|---|
| Header | `prime_contract_payment_applications` (uuid PK) | `owner_invoices` (bigint PK) |
| Detail | `payment_application_line_items` (uuid PK) | `owner_invoice_line_items` (bigint PK) |
| SOV source | `prime_contract_sovs` | `contract_line_items` |
| Retainage split | **Full 5a / 5b** — separate work and materials retainage columns | Single `retainage_pct` / `retainage_amount` |
| API | `/api/projects/[projectId]/contracts/[contractId]/payment-applications/**` | `/api/projects/[projectId]/invoicing/owner/**` |

They are linked (`owner_invoices.payment_application_id → prime_contract_payment_applications.id`)
and kept in sync by `frontend/src/lib/invoicing/owner-payment-application-sync.ts`.

**Recommendation: import the continuation-sheet detail into System A (`payment_application_line_items`).**
It is the only owner-side table that can hold the 5a / 5b retainage split Form APP requires.
Then create the matching `owner_invoices` header so the invoicing UI shows it. Templates 02 and 03
are System A; 04 and 05 are System B, provided for the UI path.

> **Known schema gap.** `owner_invoice_line_items` has no `materials_retainage_pct` /
> `materials_retainage_amount`, so on that table the 5a / 5b split collapses into one
> `retainage_amount`. `subcontractor_invoice_line_items` *does* carry both. If the owner side needs
> line-level 5a / 5b parity with the sub side, those two columns should be added to
> `owner_invoice_line_items` — worth filing as a backlog item before this goes into production use.

---

## 2. Continuation-sheet column → database column

Verified against the live PM APP database (`lgveqfnpkxvzbnnwuled`) on 2026-07-30. The Schedule of
Values columns are ordered deliberately so a completed sheet maps straight across.

| Form CS<br>col | Workbook col | `payment_application_line_items`<br>(owner, System A) | `owner_invoice_line_items`<br>(owner, System B) | `subcontractor_invoice_line_items`<br>(sub) |
|---|---|---|---|---|
| A | A — Item No. | `item_number` | prefix into `description` | prefix into `description` |
| B | B — Description | `description` | `description` | `description` |
| — | C — Budget code | `budget_code` | — | `budget_code` |
| C | D — Scheduled Value | `scheduled_value` | `scheduled_value` | `scheduled_value` |
| D | E — From Previous Application | `work_completed_previous` | `work_completed_previous` | `work_completed_previous` |
| E | F — This Period | `work_completed_this_period` | `work_completed_period` | `work_completed_period` |
| F | G — Materials Presently Stored | `materials_stored` | `materials_stored` | `materials_stored` |
| G | H — Total Completed & Stored | 🚫 `total_completed` | 🚫 `total_completed_stored` | 🚫 `total_completed_stored` |
| % | I — % | 🚫 `percent_complete` | ✅ `work_completed_pct` | ✅ `work_completed_pct` |
| H | J — Balance to Finish | 🚫 `balance_to_finish` | 🚫 `balance_to_finish` | 🚫 `balance_to_finish` |
| I | K — Ret % work | `retainage_this_period_work_pct` | `retainage_pct` | `retainage_pct` |
| I | L — Ret $ work PRIOR | `retainage_previous_work` | — | `previous_work_retainage` |
| I | M — Ret $ work THIS PERIOD | `retainage_this_period_work` | part of `retainage_amount` | `retainage_amount` |
| I | N — Ret $ work RELEASED | `retainage_released_work` | `retainage_released` | `work_retainage_released` |
| I | O — Ret % materials | `retainage_this_period_materials_pct` | — | `materials_retainage_pct` |
| I | P — Ret $ materials PRIOR | `retainage_previous_materials` | — | `previous_materials_retainage` |
| I | Q — Ret $ materials THIS PERIOD | `retainage_this_period_materials` | part of `retainage_amount` | `materials_retainage_amount` |
| I | R — Ret $ materials RELEASED | `retainage_released_materials` | — | `materials_retainage_released` |
| I | S — Total Retainage Held | (L+M−N)+(P+Q−R) | — | — |

🚫 = **`GENERATED ALWAYS` in Postgres. Never send it.** The insert fails or the value is ignored.
✅ = not generated; you must supply it.

Confirmed generation expressions:

```sql
payment_application_line_items.total_completed     = work_completed_previous + work_completed_this_period + materials_stored
payment_application_line_items.balance_to_finish   = scheduled_value - (…same…)
payment_application_line_items.percent_complete    = round(total / scheduled_value * 100, 2)   -- 0 when scheduled_value = 0
owner_invoice_line_items.total_completed_stored    = work_completed_previous + work_completed_period + materials_stored
owner_invoice_line_items.balance_to_finish         = scheduled_value - (…same…)
owner_invoice_line_items.net_amount_this_period    = (work_completed_period + materials_stored) - retainage_amount
subcontractor_invoice_line_items.total_completed_stored = work_completed_previous + work_completed_period + materials_stored
subcontractor_invoice_line_items.balance_to_finish     = scheduled_value - (…same…)
subcontractor_invoice_line_items.net_amount_this_period =
    (work_completed_period + materials_stored)
  - (retainage_amount + materials_retainage_amount)
  + (work_retainage_released + materials_retainage_released)
```

### Retainage is stored per period, not cumulatively

This is the detail most likely to be gotten wrong. The platform computes
(`frontend/src/lib/invoicing/payment-application.ts`):

```
retainage_amount            = work_completed_period * retainage_pct / 100
materials_retainage_amount  = materials_stored      * materials_retainage_pct / 100
```

So `retainage_amount` is **this period's** retainage only. Retainage withheld on earlier
applications lives in `previous_work_retainage` / `previous_materials_retainage`. The cumulative
figure Lines 5a and 5b require is therefore:

```
Line 5a = Σ (previous_work_retainage      + retainage_amount           - work_retainage_released)
Line 5b = Σ (previous_materials_retainage + materials_retainage_amount - materials_retainage_released)
```

The workbook's Schedule of Values carries all three parts (columns L / M / N for work, P / Q / R for materials)
and column S is the held total, so the mapping is one-to-one in both directions. Column M and Q are
formulas; L, N, P and R are typed and rolled forward each month.

**`owner_invoice_line_items` is the exception.** It has a single `retainage_pct` /
`retainage_amount` and no materials or prior-period retainage columns, and its generated
`net_amount_this_period` subtracts `retainage_amount` outright. On that table,
`retainage_amount` must be **this period's work + materials retainage combined**, and the prior /
released detail cannot be stored at line level.

> **Backlog item worth filing.** Add `materials_retainage_pct`, `materials_retainage_amount`,
> `previous_work_retainage` and `previous_materials_retainage` to `owner_invoice_line_items` so the
> owner side reaches parity with `subcontractor_invoice_line_items`. Until then, import the owner
> continuation-sheet detail into `payment_application_line_items` (System A) where the full split is already modelled.

## 3. Form APP line → where the number lives

The Form APP face is a roll-up. Only a few of its lines are stored; the rest are derived from the
line items or from views.

| Form APP line | Where it lives |
|---|---|
| 1 — Original Contract Sum | `prime_contracts.original_contract_value` / `subcontracts` contract value |
| 2 — Net change by Change Orders | sum of approved `prime_contract_change_orders.total_amount` (owner) or `contract_change_orders.amount` (sub); also `prime_contract_financial_summary.approved_change_orders` |
| 3 — Contract Sum to Date | `prime_contracts.revised_contract_value` / view `prime_contract_financial_summary.revised_contract_amount` |
| 4 — Total Completed & Stored | sum of line-item `total_completed_stored` |
| 5a — Retainage on completed work | sum of `retainage_this_period_work` (+ prior) |
| 5b — Retainage on stored material | sum of `retainage_this_period_materials` (+ prior) |
| 5 — Total Retainage | header `prime_contract_payment_applications.retention_amount` |
| 6 — Total Earned Less Retainage | header `net_amount` (System A) / `owner_invoices.net_amount` |
| 7 — Less Previous Certificates | sum of `invoice_payments` / `prime_contract_payments` for prior applications |
| 8 — Current Payment Due | Line 6 − Line 7; `owner_invoices.gross_amount` less prior |
| 9 — Balance to Finish | Line 3 − Line 6; view `prime_contract_financial_summary.remaining_balance` |
| % Complete | header `percent_complete` |

`billing_period_id` on every header should point at the matching `billing_periods` row
(`project_id`, `period_number`, `start_date`, `end_date`) so applications group correctly by period.

---

## 4. File-by-file reference

### Owner side

| # | File | Table | Notes |
|---|---|---|---|
| 01 | `01-owner-sov__contract_line_items.csv` | `contract_line_items` | `total_cost` is the scheduled value. `line_number` and `description` are NOT NULL. |
| 02 | `02-owner-payapp-header__prime_contract_payment_applications.csv` | `prime_contract_payment_applications` | `contract_id`, `project_id`, `application_number` are NOT NULL. `status` defaults to `draft`. |
| 03 | `03-owner-payapp-lines__payment_application_line_items.csv` | `payment_application_line_items` | **Preferred owner detail table** — full 5a/5b split. `item_number` and `description` NOT NULL. |
| 04 | `04-owner-invoice-header__owner_invoices.csv` | `owner_invoices` | Set `payment_application_id` to link back to 02. |
| 05 | `05-owner-invoice-lines__owner_invoice_line_items.csv` | `owner_invoice_line_items` | Single retainage column: put **this period's** work + materials retainage in `retainage_amount`. Omit the three generated columns. |
| 06 | `06-owner-change-orders__prime_contract_change_orders.csv` | `prime_contract_change_orders` | `title` NOT NULL. Only `Approved` / `Executed` should count toward Line 2. |
| 07 | `07-owner-change-order-lines__pcco_line_items.csv` | `pcco_line_items` | `line_amount` is the dollar value; `cost_code` is a text code here. |

### Subcontractor side

| # | File | Table | Notes |
|---|---|---|---|
| 08 | `08-sub-sov__subcontract_sov_items.csv` | `subcontract_sov_items` | `amount` is the scheduled value. `retainage_percent` is per line — this is where a reduced rate lives. |
| 09 | `09-sub-invoice-header__subcontractor_invoices.csv` | `subcontractor_invoices` | `project_id` and `status` NOT NULL. **No dollar totals on the header** — all money is on the lines. Use `jobplanner_pay_app_number` for the sub's own application number. Set `is_retainage_release=TRUE` for a retainage-only billing. |
| 10 | `10-sub-invoice-lines__subcontractor_invoice_line_items.csv` | `subcontractor_invoice_line_items` | Richest retainage model — full 5a/5b plus prior and released, work and materials. `retainage_amount` and `materials_retainage_amount` are **this period only**. |
| 11 | `11-sub-change-orders__contract_change_orders.csv` | `contract_change_orders` | `contract_id`, `change_order_number`, `description`, `amount`, `status` NOT NULL. Link to the owner CO with `prime_change_order_id` when it passes through. |
| 12 | `12-sub-change-order-lines__commitment_change_order_lines.csv` | `commitment_change_order_lines` | FK column is `commitment_change_order_id`. |

`subcontractor_invoices.status` is a Postgres enum — use exactly one of:
`draft`, `pending`, `approved`, `paid`, `void`, `under_review`, `revise_and_resubmit`,
`not_invited`, `invited`, `approved_as_noted`, `pending_owner_approval`.

---

## 5. Formatting rules for the CSV files

- **Encoding** UTF-8, no BOM. **Line endings** LF or CRLF both fine. **Quoting** standard RFC 4180.
- **Dates** `YYYY-MM-DD`. Timestamps `YYYY-MM-DDTHH:MM:SSZ`.
- **Money** plain decimal, no `$`, no thousands separators, no parentheses. Negatives use a
  leading minus: `-5000.00`.
- **Percentages are always out of 100, never fractions.** `retainage_pct`,
  `materials_retainage_pct`, `retainage_percent`, `default_retainage_percent`, `work_completed_pct`
  and `percent_complete` all store `10` for ten percent — never `0.10`. This is enforced in the
  calculation layer (`retainage_amount = work_completed_period * retainage_pct / 100`) and validated
  by the settings API, which rejects `default_retainage_percent` outside 0–100. The workbook uses
  the same convention and formats it with a trailing `%` so it reads correctly without being a
  true Excel percentage — copy the raw number straight across.
- **Booleans** `TRUE` / `FALSE`.
- **Empty vs zero** — leave a cell empty for "unknown / not applicable" (nullable columns); use
  `0.00` for a real zero dollar amount. Do not put `0` in a nullable FK.
- **IDs** — placeholders in the examples (`<owner_invoices.id>`, `00000000-…-0000000000pc`) must be
  replaced with real values. `projects.id` is an **INTEGER**, not a UUID. Prime contract, subcontract,
  and payment-application IDs are UUIDs (text). `owner_invoices.id` and
  `subcontractor_invoices.id` are **bigints**.
- **FK dropdown caution** — `budget_code_id` on `contract_line_items`, commitments, direct costs and
  the prime SOV targets `project_budget_codes.id`. There is no `project_cost_codes` table. There is
  no `vendors` table either — every `vendor_id` points at `companies.id`.

---

## 6. Validation checklist before importing

Run these against the completed workbook, not after loading:

1. **Scheduled Value grand total (col D) = Line 3.** The workbook prints OK / the variance below the
   grand total. Do not import an out-of-balance sheet.
2. **CO summary net = Line 2.** The workbook warns if it does not tie.
3. **Every line: col E + col F + col G = col H**, and **col D − col H = col J**. Non-negative.
4. **Retainage total (col S) = Lines 5a + 5b.** The workbook states this explicitly next
   to Line 5; do not import if it warns.
5. **This-period retainage only** in `retainage_amount` — prior retainage belongs in the
   `previous_*_retainage` columns. A cumulative figure here double-counts and inflates the
   generated `net_amount_this_period`.
6. **Line 7 equals the prior application's Line 6.** Check against `invoice_payments` /
   `prime_contract_payments` for what was actually certified.
7. **No line billed over its scheduled value** unless a change order raised it — col I ≤ 100%.
8. **Budget codes resolve.** Every `budget_code` / `budget_code_id` exists in
   `project_budget_codes` for that project.

---

## 7. Scope of these forms

Form APP, Form CS and Form CO are Alleato Group forms. They follow the standard
construction-industry application-for-payment structure — nine summary lines, the 5a / 5b retainage
split, and a continuation sheet with columns A through I — so any owner, lender or subcontractor
reads them without friction. Certification language is Alleato Group's own. Where a contract
specifies submission on a particular third-party form, obtain that form from its publisher and key
the figures across from the workbook.
