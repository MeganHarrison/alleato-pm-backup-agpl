-- Support budget_code-based lookups on SOV tables.
-- NOT making budget_code a hard FK: ~89% of existing subcontract_sov_items
-- rows have text values that don't resolve to cost_codes.id, so a strict FK
-- would reject legitimate historical data. FK integrity is enforced at the
-- UI layer via the cost code dropdown instead.

CREATE INDEX IF NOT EXISTS idx_subcontract_sov_items_budget_code
  ON public.subcontract_sov_items (budget_code);
CREATE INDEX IF NOT EXISTS idx_purchase_order_sov_items_budget_code
  ON public.purchase_order_sov_items (budget_code);
