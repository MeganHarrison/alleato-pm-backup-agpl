-- ─────────────────────────────────────────────────────────────────────────────
-- Submittals Phase 2: RLS + Workflow Templates
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- Task 0.1 — Enable RLS on submittals table
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE submittals ENABLE ROW LEVEL SECURITY;
-- Project members can read submittals
CREATE POLICY "Project members can read submittals"
  ON submittals FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- Project members can insert submittals
CREATE POLICY "Project members can create submittals"
  ON submittals FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- Project members can update submittals
CREATE POLICY "Project members can update submittals"
  ON submittals FOR UPDATE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- Project members can delete submittals (soft-delete is an update, hard-delete allowed)
CREATE POLICY "Project members can delete submittals"
  ON submittals FOR DELETE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- ═══════════════════════════════════════════════════════════════════════════
-- Task 0.2 — Enable RLS on submittal_history table
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE submittal_history ENABLE ROW LEVEL SECURITY;
-- Project members can read submittal history (join via submittal)
CREATE POLICY "Project members can read submittal history"
  ON submittal_history FOR SELECT
  TO authenticated
  USING (
    submittal_id IN (
      SELECT id FROM submittals
      WHERE public.current_is_app_admin()
        OR public.current_is_project_member(project_id)
    )
  );
-- Authenticated users can insert submittal history (server-side writes on behalf of user)
CREATE POLICY "Authenticated users can insert submittal history"
  ON submittal_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
-- ═══════════════════════════════════════════════════════════════════════════
-- Task 0.3 — Create submittal_workflow_templates table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS submittal_workflow_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  steps       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submittal_workflow_templates_project
  ON submittal_workflow_templates(project_id);
ALTER TABLE submittal_workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can read workflow templates"
  ON submittal_workflow_templates FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY "Project members can manage workflow templates"
  ON submittal_workflow_templates FOR ALL
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
