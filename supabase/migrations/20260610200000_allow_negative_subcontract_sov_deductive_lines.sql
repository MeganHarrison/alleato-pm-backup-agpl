-- Acumatica subcontracts carry negative detail lines (deductive change/credit
-- adjustments). These are legitimate and are required for the SOV line items to
-- reconcile to the subcontract total. The previous `amount >= 0` CHECK forced
-- the sync to clamp negative lines to 0, which silently corrupted SOV totals.
--
-- Drop the non-negative constraint on subcontract_sov_items.amount so deductive
-- lines can be stored as-is. (purchase_order_sov_items already has no such
-- constraint.) Retainage is modeled separately via retainage_percent and is no
-- longer baked into the line amount.

ALTER TABLE public.subcontract_sov_items
  DROP CONSTRAINT IF EXISTS subcontract_sov_items_amount_check;
