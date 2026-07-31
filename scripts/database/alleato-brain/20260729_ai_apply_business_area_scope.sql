BEGIN;

WITH candidates AS (
  SELECT id, project_id, coalesce(source_metadata, '{}'::jsonb) AS source_metadata
  FROM public.rag_document_metadata
  WHERE project_id IN (60, 89, 90, 756, 767)
  ORDER BY id
  LIMIT 500
),
snapshotted AS (
INSERT INTO public.alleato_brain_scope_snapshot_20260729_documents (
  id,
  project_id,
  source_metadata
)
SELECT
  id,
  project_id,
  coalesce(source_metadata, '{}'::jsonb)
FROM candidates
ON CONFLICT (id) DO NOTHING
RETURNING id
)
UPDATE public.rag_document_metadata AS document
SET
  source_metadata = (
    candidates.source_metadata - 'project_id'
  ) || jsonb_build_object(
    'business_area_id',
    CASE candidates.project_id
      WHEN 756 THEN 1
      WHEN 767 THEN 2
      WHEN 60 THEN 3
      WHEN 90 THEN 4
      WHEN 89 THEN 5
    END
  ),
  project_id = NULL,
  updated_at = now()
FROM candidates
WHERE document.id = candidates.id;

WITH candidates AS (
  SELECT chunk_id, coalesce(metadata, '{}'::jsonb) AS metadata
  FROM public.document_chunks
  WHERE metadata->>'project_id' IN ('60', '89', '90', '756', '767')
  ORDER BY chunk_id
  LIMIT 750
),
snapshotted AS (
INSERT INTO public.alleato_brain_scope_snapshot_20260729_chunks (
  chunk_id,
  metadata
)
SELECT
  chunk_id,
  coalesce(metadata, '{}'::jsonb)
FROM candidates
ON CONFLICT (chunk_id) DO NOTHING
RETURNING chunk_id
)
UPDATE public.document_chunks AS chunk
SET
  metadata = (
    candidates.metadata - 'project_id'
  ) || jsonb_build_object(
    'business_area_id',
    CASE candidates.metadata->>'project_id'
      WHEN '756' THEN 1
      WHEN '767' THEN 2
      WHEN '60' THEN 3
      WHEN '90' THEN 4
      WHEN '89' THEN 5
    END
  ),
  updated_at = now()
FROM candidates
WHERE chunk.chunk_id = candidates.chunk_id;

COMMIT;
