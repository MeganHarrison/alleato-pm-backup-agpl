-- Fix: budget_code_id FK was pointing to project_budget_codes,
-- but the budget-codes API returns IDs from project_cost_codes.
-- Change the FK to reference project_cost_codes instead.

ALTER TABLE contract_line_items
  DROP CONSTRAINT IF EXISTS contract_line_items_budget_code_id_fkey;
ALTER TABLE contract_line_items
  ADD CONSTRAINT contract_line_items_budget_code_id_fkey
  FOREIGN KEY (budget_code_id) REFERENCES project_cost_codes(id) ON DELETE SET NULL;
