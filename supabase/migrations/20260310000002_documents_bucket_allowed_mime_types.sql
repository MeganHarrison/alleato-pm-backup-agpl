-- Ensure the RAG documents storage bucket has a stable, source-controlled
-- mime allowlist for document ingestion.

INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  ARRAY[
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/tab-separated-values',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET allowed_mime_types = EXCLUDED.allowed_mime_types;
