CREATE TABLE IF NOT EXISTS budget_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id integer NOT NULL REFERENCES projects(id),
  number text,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'Draft',
  description text,
  change_event_id uuid REFERENCES change_events(id),
  amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS budget_changes_project_id_idx ON budget_changes(project_id);
CREATE INDEX IF NOT EXISTS budget_changes_change_event_id_idx ON budget_changes(change_event_id);
