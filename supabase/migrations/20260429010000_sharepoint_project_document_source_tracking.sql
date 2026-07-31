-- Add durable source tracking for SharePoint/OneDrive project document imports.
-- A synced file should remain visible in Alleato even if the source folder is
-- later renamed, moved, or deleted.

ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS source_drive_id TEXT,
  ADD COLUMN IF NOT EXISTS source_item_id TEXT,
  ADD COLUMN IF NOT EXISTS source_site_id TEXT,
  ADD COLUMN IF NOT EXISTS source_path TEXT,
  ADD COLUMN IF NOT EXISTS source_web_url TEXT,
  ADD COLUMN IF NOT EXISTS source_etag TEXT,
  ADD COLUMN IF NOT EXISTS source_last_modified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_size BIGINT,
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS workflow_target TEXT,
  ADD COLUMN IF NOT EXISTS division TEXT,
  ADD COLUMN IF NOT EXISTS trade TEXT,
  ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.document_metadata
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS source_drive_id TEXT,
  ADD COLUMN IF NOT EXISTS source_item_id TEXT,
  ADD COLUMN IF NOT EXISTS source_site_id TEXT,
  ADD COLUMN IF NOT EXISTS source_path TEXT,
  ADD COLUMN IF NOT EXISTS source_web_url TEXT,
  ADD COLUMN IF NOT EXISTS source_etag TEXT,
  ADD COLUMN IF NOT EXISTS source_last_modified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_size BIGINT,
  ADD COLUMN IF NOT EXISTS workflow_target TEXT,
  ADD COLUMN IF NOT EXISTS division TEXT,
  ADD COLUMN IF NOT EXISTS trade TEXT,
  ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_documents_sync_status_check'
      AND conrelid = 'public.project_documents'::regclass
  ) THEN
    ALTER TABLE public.project_documents
      ADD CONSTRAINT project_documents_sync_status_check
      CHECK (sync_status IN ('manual', 'synced', 'source_deleted', 'sync_error', 'archived'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_documents_source_item
  ON public.project_documents (project_id, source_system, source_drive_id, source_item_id)
  WHERE source_item_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_documents_source_path
  ON public.project_documents (project_id, source_system, source_path)
  WHERE source_path IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_documents_workflow_target
  ON public.project_documents (project_id, workflow_target)
  WHERE workflow_target IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_document_metadata_source_item
  ON public.document_metadata (source_system, source_drive_id, source_item_id)
  WHERE source_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_metadata_source_path
  ON public.document_metadata (project_id, source_system, source_path)
  WHERE source_path IS NOT NULL;
COMMENT ON COLUMN public.project_documents.source_system IS 'External source system for synced files, e.g. sharepoint or onedrive.';
COMMENT ON COLUMN public.project_documents.source_item_id IS 'Microsoft Graph driveItem id for idempotent re-sync.';
COMMENT ON COLUMN public.project_documents.source_path IS 'Original source folder path plus filename at sync time.';
COMMENT ON COLUMN public.project_documents.storage_path IS 'Supabase Storage object path for Alleato-owned durable file copy.';
COMMENT ON COLUMN public.project_documents.sync_status IS 'Sync state for source-backed documents; source deletes should archive rather than silently remove.';
