-- Fix a SET NULL → NOT NULL contradiction on direct_cost_line_items.budget_code_id.
--
-- The FK direct_cost_line_items.budget_code_id → project_budget_codes is ON DELETE
-- SET NULL, but the column was NOT NULL. So deleting a budget code (e.g. via a project
-- cascade) threw "null value in column budget_code_id violates not-null constraint" and
-- aborted the whole delete. Allowing NULL lets the line item survive as "uncategorized"
-- when its budget code is removed, which is the intended behavior of the SET NULL FK.

begin;

alter table public.direct_cost_line_items
  alter column budget_code_id drop not null;

commit;
