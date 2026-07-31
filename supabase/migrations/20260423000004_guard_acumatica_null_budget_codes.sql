-- Guard Acumatica direct-cost budget-code rows.
-- Acumatica transaction details carry a cost code but no cost type, so their
-- project_budget_codes rows must be unique within a project/sub-job/cost-code.

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY project_id, sub_job_key, cost_code_id
      ORDER BY is_active DESC, created_at ASC, id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, sub_job_key, cost_code_id
      ORDER BY is_active DESC, created_at ASC, id ASC
    ) AS rn
  FROM project_budget_codes
  WHERE cost_type_id IS NULL
),
duplicates AS (
  SELECT id, canonical_id
  FROM ranked
  WHERE rn > 1
)
UPDATE direct_cost_line_items dcli
SET budget_code_id = duplicates.canonical_id
FROM duplicates
WHERE dcli.budget_code_id = duplicates.id;
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY project_id, sub_job_key, cost_code_id
      ORDER BY is_active DESC, created_at ASC, id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, sub_job_key, cost_code_id
      ORDER BY is_active DESC, created_at ASC, id ASC
    ) AS rn
  FROM project_budget_codes
  WHERE cost_type_id IS NULL
),
duplicates AS (
  SELECT id, canonical_id
  FROM ranked
  WHERE rn > 1
)
UPDATE contract_line_items cli
SET budget_code_id = duplicates.canonical_id
FROM duplicates
WHERE cli.budget_code_id = duplicates.id;
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY project_id, sub_job_key, cost_code_id
      ORDER BY is_active DESC, created_at ASC, id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, sub_job_key, cost_code_id
      ORDER BY is_active DESC, created_at ASC, id ASC
    ) AS rn
  FROM project_budget_codes
  WHERE cost_type_id IS NULL
),
duplicates AS (
  SELECT id, canonical_id
  FROM ranked
  WHERE rn > 1
)
UPDATE budget_lines bl
SET project_budget_code_id = duplicates.canonical_id
FROM duplicates
WHERE bl.project_budget_code_id = duplicates.id;
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, sub_job_key, cost_code_id
      ORDER BY is_active DESC, created_at ASC, id ASC
    ) AS rn
  FROM project_budget_codes
  WHERE cost_type_id IS NULL
)
DELETE FROM project_budget_codes pbc
USING ranked
WHERE pbc.id = ranked.id
  AND ranked.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_budget_codes_acumatica_null_type
  ON project_budget_codes (project_id, sub_job_key, cost_code_id)
  WHERE cost_type_id IS NULL;
