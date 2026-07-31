# Retainage Billing Architecture

**Updated:** 2026-04-13

## Acceptance Checklist

- [x] Prime contract billing uses one source of truth for retainage (`prime_contract_payment_applications` + `payment_application_line_items`).
- [x] Owner invoice pages do not calculate retainage independently — when an owner invoice is linked to a payment application via `payment_application_id`, retainage figures come from the canonical line-item model.
- [x] Commitment-side billing stores retainage amounts explicitly in `subcontractor_invoices` and `subcontractor_invoice_line_items` (not derived SOV summaries).
- [x] Retainage release is only allowed on the most recent editable payment application in a billing period (enforced server-side in the line-items PATCH route).
- [x] Permission checks gate retainage writes: `contracts:write` for prime billing, `contracts:admin` for settings changes.

---

## Canonical Table Mapping

| Business concept | Canonical table / route |
|---|---|
| Prime / owner pay application | `prime_contract_payment_applications` |
| Prime / owner retainage line item state | `payment_application_line_items` |
| Contract retainage default (prime) | `prime_contracts.retention_percentage` |
| Project-level retainage settings | `prime_contract_project_settings` (`.enable_completed_work_retainage`, `.enable_stored_materials_retainage`, `.default_retainage_percent`) |
| Commitment retainage default | `subcontracts.default_retainage_percent`, `purchase_orders.default_retainage_percent` |
| Commitment pay application | `subcontractor_invoices` + `subcontractor_invoice_line_items` |
| Retainage release invoice (commitment) | `subcontractor_invoices.is_retainage_release = true` |
| Owner invoice ↔ prime pay application link | `owner_invoices.payment_application_id` (nullable FK) |

---

## Prime Contract Billing

- Payment applications are created under a prime contract via `POST /api/projects/[projectId]/contracts/[contractId]/payment-applications`.
- SOV is populated (with retainage defaults from `prime_contracts.retention_percentage`) via the `populate-sov` route.
- Line items are edited via the `PATCH /line-items` route, which:
  - Enforces retainage edits only on the most recent application in a billing period
  - Prevents retainage release on non-draft statuses
  - Prevents releasing more than currently retained
  - Recomputes parent application totals after every save
- The G703 UI (`InvoiceG703Detail.tsx`) exposes all retainage columns: work %, work $, materials %, materials $, released work, released materials.

## Retainage Settings

- Project-level defaults live in `prime_contract_project_settings`:
  - `enable_completed_work_retainage` (default: `false`)
  - `enable_stored_materials_retainage` (default: `false`)
  - `default_retainage_percent` (default: `0`)
- Procore model: **opt-in, 0% until explicitly set**. Never default to 10%.
- These are exposed via `GET/PUT /api/projects/[projectId]/contracts/settings`.

## Commitment Billing

- Commitment invoices are stored in `subcontractor_invoices` (same table as subcontractor pay apps).
- The `InvoicesTab` on the commitment detail page reads from `/api/projects/[projectId]/invoicing/subcontractor/invoices`.
- A dedicated "Create Retainage Release Invoice" button creates a `subcontractor_invoices` record with `is_retainage_release = true` — matches Procore's dedicated retainage release flow.

## Owner Invoicing Alignment

- `owner_invoices` is the existing owner-side billing table.
- `owner_invoices.payment_application_id` (nullable) links to `prime_contract_payment_applications`.
- When linked, the GET route uses the payment application's `amount`, `retention_amount`, `net_amount`, and `percent_complete` instead of computing from `owner_invoice_line_items`.
- New owner invoices can be created with a `payment_application_id` to establish the link at creation time.

## Retainage Release Rules (Server-Enforced)

In `PATCH /payment-applications/[applicationId]/line-items`:

1. `hasRetainageMutation` detects any retainage field in the update payload.
2. When true, fetches all sibling applications in the same billing period.
3. Sorts by application number (then billing date, then created_at).
4. Rejects with `409` if the current application is not the latest.
5. Rejects with `409` if the application status is not `draft` or `revise_and_resubmit`.
6. Rejects with `400` if release would exceed retained amount (per line item).

## Known Non-Goals (Phase 1)

- Sliding-scale retainage rules engine (schema hooks present for future use)
- Automatic subcontractor invoice approval when owner approves owner invoice
- Payment received tracking (payments table not yet implemented)
