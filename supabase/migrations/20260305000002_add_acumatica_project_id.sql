-- Add acumatica_project_id to projects table for ERP cross-referencing.
-- This maps Alleato projects to their Acumatica ERP project codes (e.g., '25108').
-- Used by the Financial Insights scan engine to compare budgets across systems.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS acumatica_project_id TEXT;
COMMENT ON COLUMN projects.acumatica_project_id IS 'Maps to Acumatica ERP project code (e.g. 25108). Used for budget cross-referencing.';
-- Index for efficient lookups during cross-reference scans
CREATE INDEX IF NOT EXISTS idx_projects_acumatica_project_id
  ON projects (acumatica_project_id)
  WHERE acumatica_project_id IS NOT NULL;
