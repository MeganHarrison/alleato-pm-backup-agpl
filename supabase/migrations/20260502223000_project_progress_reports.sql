-- Editable weekly progress reports for client-facing project updates.
-- Reports store the PM-edited output plus the source snapshot used to draft it.

CREATE TABLE IF NOT EXISTS project_progress_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Weekly Progress Report',
  report_type TEXT NOT NULL DEFAULT 'weekly'
    CHECK (report_type IN ('weekly')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'sent')),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  construction_start_date DATE,
  scheduled_completion_date DATE,
  past_week_highlights TEXT NOT NULL DEFAULT '',
  upcoming_week_activities TEXT NOT NULL DEFAULT '',
  open_items TEXT NOT NULL DEFAULT '',
  weather_days_lost INTEGER NOT NULL DEFAULT 0,
  contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_recipients TEXT[] NOT NULL DEFAULT '{}'::text[],
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, week_start, week_end)
);

CREATE INDEX IF NOT EXISTS idx_project_progress_reports_project_week
  ON project_progress_reports(project_id, week_end DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS project_progress_report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_report_id UUID NOT NULL REFERENCES project_progress_reports(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_photo_id BIGINT NOT NULL REFERENCES project_photos(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (progress_report_id, project_photo_id)
);

CREATE INDEX IF NOT EXISTS idx_project_progress_report_photos_report
  ON project_progress_report_photos(progress_report_id, sort_order, created_at);

ALTER TABLE project_progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_progress_report_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_progress_reports_select" ON project_progress_reports
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "project_progress_reports_insert" ON project_progress_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "project_progress_reports_update" ON project_progress_reports
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "project_progress_report_photos_select" ON project_progress_report_photos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "project_progress_report_photos_insert" ON project_progress_report_photos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "project_progress_report_photos_update" ON project_progress_report_photos
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "project_progress_report_photos_delete" ON project_progress_report_photos
  FOR DELETE USING (auth.uid() IS NOT NULL);
