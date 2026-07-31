# Task: Commitment SOV FK Path Map

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Map every code path that reads or writes the commitment SOV budget-code fields that are currently text-backed, so the eventual FK migration can stay tightly scoped.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before writing the path map.
- [x] Identify affected tables and non-affected relational tables.
- [x] Map write paths for `subcontract_sov_items` and `purchase_order_sov_items`.
- [x] Map read paths that derive budget/invoice/export behavior from SOV budget code text.
- [x] Map downstream `subcontractor_sov_items` and `subcontractor_invoice_line_items` impact.
- [x] Record evidence and next repair phases.

## Verification Checklist

- [x] Generated DB types reviewed for FK/non-FK fields.
- [x] Code references searched with `rg`.
- [x] Path map written to architecture docs.
- [x] Scope boundaries called out explicitly.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| Existing inventory | Pass | Started from `docs/architecture/FINANCIAL-TABLE-FK-INVENTORY.md`. |
| DB types baseline | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded and surfaced remote schema drift. |
| Type drift | Pass | Generated types added `daily_corpus_syntheses`, `subcontracts_with_invoice_stats`, and relationships to the new view; no canonical SOV budget FK exists yet. |
| Code search | Pass | Used `rg` across `frontend/src`, `backend/src`, `scripts`, and `supabase` for the four affected tables and the legacy budget-code column. |
| Deliverable | Pass | Created `docs/architecture/COMMITMENT-SOV-FK-PATH-MAP.md`. |

## Final Status

- [x] Path map created.
- [x] Scope boundaries recorded.
- [x] Next repair sequence recorded.
