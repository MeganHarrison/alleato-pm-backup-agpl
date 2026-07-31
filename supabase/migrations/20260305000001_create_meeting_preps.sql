-- Meeting preps: AI-generated or manually written meeting preparation documents
CREATE TABLE public.meeting_preps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id TEXT NOT NULL REFERENCES document_metadata(id) ON DELETE CASCADE,
    project_id BIGINT REFERENCES projects(id),
    content TEXT NOT NULL DEFAULT '',
    generated_by TEXT NOT NULL DEFAULT 'manual',
    model_used TEXT,
    generation_time_ms INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(meeting_id)
);
CREATE INDEX idx_meeting_preps_project ON meeting_preps(project_id);
-- RLS: allow all roles (internal tool)
ALTER TABLE public.meeting_preps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to meeting_preps"
    ON public.meeting_preps FOR ALL
    USING (true)
    WITH CHECK (true);
GRANT ALL ON TABLE public.meeting_preps TO anon;
GRANT ALL ON TABLE public.meeting_preps TO authenticated;
GRANT ALL ON TABLE public.meeting_preps TO service_role;
