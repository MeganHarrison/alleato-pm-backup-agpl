-- Add budget_code_id (UUID FK to project_budget_codes) to contract_line_items.
-- cost_code_id is TEXT and references cost_codes.id (also text).
-- budget_code_id gives us a clean UUID FK to project_budget_codes.

ALTER TABLE contract_line_items
  ADD COLUMN IF NOT EXISTS budget_code_id uuid REFERENCES project_budget_codes(id) ON DELETE SET NULL;
-- Index for lookups by budget code
CREATE INDEX IF NOT EXISTS idx_contract_line_items_budget_code_id
  ON contract_line_items(budget_code_id)
  WHERE budget_code_id IS NOT NULL;
-- Backfill: for existing rows that have a cost_code_id, match them
-- to a project_budget_code via cost_codes.id ↔ project_budget_codes.cost_code_id
UPDATE contract_line_items cli
SET budget_code_id = pbc.id
FROM prime_contracts pc
JOIN project_budget_codes pbc
  ON pbc.project_id = pc.project_id
WHERE cli.contract_id = pc.id
  AND cli.cost_code_id IS NOT NULL
  AND cli.budget_code_id IS NULL
  AND pbc.cost_code_id = cli.cost_code_id;
