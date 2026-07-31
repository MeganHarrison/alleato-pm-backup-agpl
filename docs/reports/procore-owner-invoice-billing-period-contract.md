# Procore Owner Invoice Billing Period Contract

Date: 2026-07-18
Task: AAI-1159

## Authoritative Procore Behavior

The modernized Procore owner-invoice workflow requires a billing period to exist before invoice creation. On the create surface, Procore selects the open period's date range. If no period is open, it selects the most recent period's date range.

The prefill options are a separate creation-time concern. Eligible cost, retainage, and backup records are matched to the selected billing period after the period is established. Prefill is not available after Create.

Official sources:

- https://v2.support.procore.com/product-manuals/prime-contracts-project/tutorials/create-owner-invoices
- https://v2.support.procore.com/faq-how-does-procore-automatically-complete-amounts-on-an-owner-invoice

## Alleato Before This Fix

- The owner-invoice form modeled Billing Period as arbitrary text.
- The client derived a date or month range from that text and sent no billing-period record ID.
- The atomic API independently selected one open record when the ID was absent.
- Because client dates were preserved, the API could attach an open record ID to dates that did not belong to that record.

This was not a canonical selection contract even though the database and list API already had the necessary record owner.

## Implemented Contract

- The existing project-scoped billing-period list hook feeds a shared RHF select.
- Default selection is the newest open record, or the most recent record when none is open.
- The form sends the selected ID to both records in the atomic payload and sends its start/end dates.
- Due Date adopts the selected period's default and follows a refreshed canonical default unless the user has deliberately overridden the field.
- The atomic route requires a valid UUID, rejects conflicting IDs, scopes the selected record to the route project, and overwrites period start/end fields with database values before the transaction.
- A missing, stale, or foreign-project selection fails before the RPC writes anything.
- If the list is loading, unavailable, or empty, the control and Create Invoice action fail closed with a recovery message.

## Research Notes

The five required Tier 1 Invoicing queries were run. Results were partial (roughly 47% to 59% matches) but surfaced the modern Create Owner Invoices and billing-period articles. The live official articles were then used as Tier 3 authority. Deep-crawl manifests were not used as field authority for this targeted contract repair because the existing capture was incomplete; the exact Alleato route and shared select primitive were inspected directly instead.

## Evidence

- `docs/ops/evidence/2026-07-18-owner-invoice-billing-period-contract/database-readback.json`
- `docs/ops/evidence/2026-07-18-owner-invoice-billing-period-contract/browser-action-log.json`
- `docs/ops/evidence/2026-07-18-owner-invoice-billing-period-contract/owner-invoice-period-default-desktop.png`
- `docs/ops/evidence/2026-07-18-owner-invoice-billing-period-contract/owner-invoice-period-options-desktop.png`
- `docs/ops/evidence/2026-07-18-owner-invoice-billing-period-contract/owner-invoice-no-period-desktop.png`
- `docs/ops/evidence/2026-07-18-owner-invoice-billing-period-contract/owner-invoice-period-default-mobile.png`
