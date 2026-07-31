ALTER TABLE public.document_metadata
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_document_metadata_not_deleted
  ON public.document_metadata(type, project_id, date DESC)
  WHERE deleted_at IS NULL;
