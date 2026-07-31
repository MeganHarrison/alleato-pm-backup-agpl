-- Notes metadata + highlight anchors
-- Keep notes as the canonical content object and store source anchors separately.

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_metadata_id TEXT,
  ADD COLUMN IF NOT EXISTS source_chunk_id UUID,
  ADD COLUMN IF NOT EXISTS source_context JSONB NOT NULL DEFAULT '{}'::jsonb;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notes'
      AND column_name = 'source_chunk_id'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.notes
      ALTER COLUMN source_chunk_id TYPE UUID
      USING NULLIF(source_chunk_id, '')::uuid;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notes_note_type_check'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_note_type_check
      CHECK (note_type IN ('manual', 'highlight'));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notes_source_type_check'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_source_type_check
      CHECK (
        source_type IS NULL
        OR source_type IN ('meeting_transcript', 'knowledge_base', 'team_chat', 'ai_conversation')
      );
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notes_source_metadata_id_fkey'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_source_metadata_id_fkey
      FOREIGN KEY (source_metadata_id)
      REFERENCES public.document_metadata(id)
      ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notes_source_chunk_id_fkey'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_source_chunk_id_fkey
      FOREIGN KEY (source_chunk_id)
      REFERENCES public.documents(id)
      ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_notes_note_type ON public.notes(note_type);
CREATE INDEX IF NOT EXISTS idx_notes_source_type ON public.notes(source_type);
CREATE INDEX IF NOT EXISTS idx_notes_source_metadata_id ON public.notes(source_metadata_id);
CREATE TABLE IF NOT EXISTS public.note_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id BIGINT NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('meeting_transcript', 'knowledge_base', 'team_chat', 'ai_conversation')
  ),
  source_metadata_id TEXT REFERENCES public.document_metadata(id) ON DELETE SET NULL,
  source_chunk_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  exact_text TEXT NOT NULL,
  prefix_text TEXT,
  suffix_text TEXT,
  start_offset INTEGER,
  end_offset INTEGER,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT note_highlights_offsets_valid CHECK (
    (start_offset IS NULL AND end_offset IS NULL)
    OR (
      start_offset IS NOT NULL
      AND end_offset IS NOT NULL
      AND start_offset >= 0
      AND end_offset > start_offset
    )
  )
);
CREATE INDEX IF NOT EXISTS idx_note_highlights_note_id ON public.note_highlights(note_id);
CREATE INDEX IF NOT EXISTS idx_note_highlights_project_id ON public.note_highlights(project_id);
CREATE INDEX IF NOT EXISTS idx_note_highlights_source_metadata_id ON public.note_highlights(source_metadata_id);
CREATE INDEX IF NOT EXISTS idx_note_highlights_source_type ON public.note_highlights(source_type);
ALTER TABLE public.note_highlights ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'note_highlights'
      AND policyname = 'Allow all access to note_highlights'
  ) THEN
    CREATE POLICY "Allow all access to note_highlights"
      ON public.note_highlights
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
GRANT ALL ON TABLE public.note_highlights TO anon;
GRANT ALL ON TABLE public.note_highlights TO authenticated;
GRANT ALL ON TABLE public.note_highlights TO service_role;
