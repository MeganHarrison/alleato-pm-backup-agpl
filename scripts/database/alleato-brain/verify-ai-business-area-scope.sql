SELECT jsonb_build_object(
  'checked_at', now(),
  'legacy_rag_documents', (
    SELECT count(*)
    FROM public.rag_document_metadata
    WHERE project_id IN (60, 89, 90, 756, 767)
  ),
  'legacy_chunks', (
    SELECT count(*)
    FROM public.document_chunks
    WHERE metadata->>'project_id' IN ('60', '89', '90', '756', '767')
  ),
  'migrated_rag_documents', (
    SELECT count(*)
    FROM public.alleato_brain_scope_snapshot_20260729_documents AS snapshot
    JOIN public.rag_document_metadata AS document
      ON document.id = snapshot.id
    WHERE document.project_id IS NULL
      AND document.source_metadata ? 'business_area_id'
  ),
  'migrated_chunks', (
    SELECT count(*)
    FROM public.alleato_brain_scope_snapshot_20260729_chunks AS snapshot
    JOIN public.document_chunks AS chunk
      ON chunk.chunk_id = snapshot.chunk_id
    WHERE NOT chunk.metadata ? 'project_id'
      AND chunk.metadata ? 'business_area_id'
  ),
  'snapshot_rag_documents', (
    SELECT count(*)
    FROM public.alleato_brain_scope_snapshot_20260729_documents
  ),
  'snapshot_chunks', (
    SELECT count(*)
    FROM public.alleato_brain_scope_snapshot_20260729_chunks
  )
) AS verification;
