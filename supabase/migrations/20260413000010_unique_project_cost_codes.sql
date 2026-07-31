-- Prevent duplicate budget codes per project.
-- First, remove any existing duplicates (keep the oldest row).
DELETE FROM project_cost_codes
WHERE id NOT IN (
  SELECT DISTINCT ON (project_id, cost_code_id, cost_type_id) id
  FROM project_cost_codes
  ORDER BY project_id, cost_code_id, cost_type_id, created_at ASC
);
-- Now add the unique constraint
ALTER TABLE project_cost_codes
  ADD CONSTRAINT uq_project_cost_code_type
  UNIQUE (project_id, cost_code_id, cost_type_id);
