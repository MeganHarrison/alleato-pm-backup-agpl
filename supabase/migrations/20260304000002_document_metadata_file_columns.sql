-- Add file storage columns to document_metadata for generic document ingestion
-- These columns support the document_parser.py pipeline (PDF/DOCX uploads)

ALTER TABLE document_metadata
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'documents',
  ADD COLUMN IF NOT EXISTS raw_text TEXT;
-- Add index for quick file_path lookups
CREATE INDEX IF NOT EXISTS idx_document_metadata_file_path
  ON document_metadata (file_path) WHERE file_path IS NOT NULL;
-- Add index for source filtering (upload vs fireflies vs etc)
CREATE INDEX IF NOT EXISTS idx_document_metadata_source
  ON document_metadata (source) WHERE source IS NOT NULL;
COMMENT ON COLUMN document_metadata.file_name IS 'Original filename of the uploaded document';
COMMENT ON COLUMN document_metadata.file_path IS 'Path within the Supabase storage bucket';
COMMENT ON COLUMN document_metadata.storage_bucket IS 'Supabase storage bucket name (defaults to documents)';
COMMENT ON COLUMN document_metadata.raw_text IS 'Extracted raw text from the document (capped at 500K chars)';
