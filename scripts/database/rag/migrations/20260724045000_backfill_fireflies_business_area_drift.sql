-- Repair AI Database Business Area labels from the canonical legacy-container
-- mapping. This is a metadata-only update; embeddings and source content are
-- unchanged.

BEGIN;

WITH mapping(project_id, business_area_id) AS (
  VALUES
    (756::bigint, 1::bigint),
    (767::bigint, 2::bigint),
    (60::bigint, 3::bigint),
    (90::bigint, 4::bigint),
    (89::bigint, 5::bigint)
)
UPDATE public.rag_document_metadata AS document
SET
  source_metadata = jsonb_set(
    coalesce(document.source_metadata, '{}'::jsonb),
    '{business_area_id}',
    to_jsonb(mapping.business_area_id),
    true
  ),
  updated_at = now()
FROM mapping
WHERE document.project_id = mapping.project_id
  AND document.source_metadata->>'business_area_id'
      IS DISTINCT FROM mapping.business_area_id::text;

WITH mapping(project_id, business_area_id) AS (
  VALUES
    (756::bigint, 1::bigint),
    (767::bigint, 2::bigint),
    (60::bigint, 3::bigint),
    (90::bigint, 4::bigint),
    (89::bigint, 5::bigint)
)
UPDATE public.document_chunks AS chunk
SET metadata = jsonb_set(
  coalesce(chunk.metadata, '{}'::jsonb),
  '{business_area_id}',
  to_jsonb(mapping.business_area_id),
  true
)
FROM public.rag_document_metadata AS document
JOIN mapping ON document.project_id = mapping.project_id
WHERE chunk.document_id = document.id
  AND chunk.metadata->>'business_area_id'
      IS DISTINCT FROM mapping.business_area_id::text;

COMMIT;
