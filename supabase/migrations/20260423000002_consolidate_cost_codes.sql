-- Consolidates project_cost_codes into project_budget_codes so that
-- budget lines and contract SOV items reference the same table.
-- Reverses the band-aid applied in migration 20260317000005.

-- 1. Make cost_type_id nullable on project_budget_codes.
--    Acumatica sync creates entries without a cost type.
ALTER TABLE project_budget_codes
  ALTER COLUMN cost_type_id DROP NOT NULL;
-- 2. Migrate project_cost_codes rows into project_budget_codes.
--    DISTINCT ON deduplicates pcc entries with the same (project_id, cost_code_id, cost_type_id).
--    Skip rows that already exist in project_budget_codes.
WITH deduped AS (
  SELECT DISTINCT ON (pcc.project_id, pcc.cost_code_id, pcc.cost_type_id)
    pcc.project_id,
    pcc.cost_code_id,
    pcc.cost_type_id,
    pcc.is_active,
    pcc.created_at
  FROM project_cost_codes pcc
  ORDER BY pcc.project_id, pcc.cost_code_id, pcc.cost_type_id, pcc.created_at
)
INSERT INTO project_budget_codes (
  project_id,
  cost_code_id,
  cost_type_id,
  description,
  is_active,
  created_at,
  updated_at
)
SELECT
  d.project_id,
  d.cost_code_id,
  d.cost_type_id,
  COALESCE(cc.title, d.cost_code_id, 'Unknown') AS description,
  COALESCE(d.is_active, true),
  COALESCE(d.created_at, NOW()),
  NOW()
FROM deduped d
LEFT JOIN cost_codes cc ON cc.id = d.cost_code_id
WHERE NOT EXISTS (
  SELECT 1
  FROM project_budget_codes pbc
  WHERE pbc.project_id   = d.project_id
    AND pbc.cost_code_id = d.cost_code_id
    AND (
      (pbc.cost_type_id = d.cost_type_id)
      OR (pbc.cost_type_id IS NULL AND d.cost_type_id IS NULL)
    )
);
-- 3. Build a temporary mapping: project_cost_codes.id -> project_budget_codes.id
CREATE TEMP TABLE _pcc_to_pbc AS
SELECT
  pcc.id  AS old_id,
  pbc.id  AS new_id
FROM project_cost_codes pcc
JOIN project_budget_codes pbc
  ON pbc.project_id   = pcc.project_id
 AND pbc.cost_code_id = pcc.cost_code_id
 AND (
   (pbc.cost_type_id = pcc.cost_type_id)
   OR (pbc.cost_type_id IS NULL AND pcc.cost_type_id IS NULL)
 );
-- 4. Drop the old FK BEFORE backfilling so the UPDATE isn't rejected
--    by the constraint pointing to project_cost_codes.
ALTER TABLE contract_line_items
  DROP CONSTRAINT IF EXISTS contract_line_items_budget_code_id_fkey;
-- 5. Backfill contract_line_items.budget_code_id
UPDATE contract_line_items cli
SET    budget_code_id = m.new_id
FROM   _pcc_to_pbc m
WHERE  cli.budget_code_id = m.old_id;
-- 6. Backfill direct_cost_line_items.budget_code_id
UPDATE direct_cost_line_items dcli
SET    budget_code_id = m.new_id
FROM   _pcc_to_pbc m
WHERE  dcli.budget_code_id = m.old_id;
DROP TABLE _pcc_to_pbc;
-- 7. Add new FK on contract_line_items pointing to project_budget_codes
ALTER TABLE contract_line_items
  ADD CONSTRAINT contract_line_items_budget_code_id_fkey
  FOREIGN KEY (budget_code_id) REFERENCES project_budget_codes(id) ON DELETE SET NULL;
-- 8. Add FK on direct_cost_line_items (previously unforced)
ALTER TABLE direct_cost_line_items
  DROP CONSTRAINT IF EXISTS direct_cost_line_items_budget_code_id_fkey;
ALTER TABLE direct_cost_line_items
  ADD CONSTRAINT direct_cost_line_items_budget_code_id_fkey
  FOREIGN KEY (budget_code_id) REFERENCES project_budget_codes(id) ON DELETE SET NULL;
-- 9. Drop project_cost_codes now that all references are migrated
DROP TABLE project_cost_codes;
