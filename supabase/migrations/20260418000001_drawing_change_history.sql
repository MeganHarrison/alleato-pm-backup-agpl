-- Create drawing_change_history table for audit trail
CREATE TABLE IF NOT EXISTS drawing_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'publish', 'unpublish', 'obsolete', 'restore', 'delete', 'revision_added'))
);
CREATE INDEX IF NOT EXISTS idx_drawing_change_history_drawing_id ON drawing_change_history(drawing_id);
CREATE INDEX IF NOT EXISTS idx_drawing_change_history_project_id ON drawing_change_history(project_id);
CREATE INDEX IF NOT EXISTS idx_drawing_change_history_changed_at ON drawing_change_history(changed_at DESC);
-- Enable RLS
ALTER TABLE drawing_change_history ENABLE ROW LEVEL SECURITY;
-- Project members can read change history
CREATE POLICY "Project members can read drawing change history"
  ON drawing_change_history FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- Authenticated users can insert change history records (server-side routes insert on behalf of user)
CREATE POLICY "Authenticated users can insert drawing change history"
  ON drawing_change_history FOR INSERT
  WITH CHECK (auth.uid() = changed_by);
