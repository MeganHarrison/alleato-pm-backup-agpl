BEGIN;

UPDATE public.rag_document_metadata AS document
SET
  project_id = snapshot.project_id,
  source_metadata = snapshot.source_metadata,
  updated_at = now()
FROM public.alleato_brain_scope_snapshot_20260729_documents AS snapshot
WHERE document.id = snapshot.id;

UPDATE public.document_chunks AS chunk
SET
  metadata = snapshot.metadata,
  updated_at = now()
FROM public.alleato_brain_scope_snapshot_20260729_chunks AS snapshot
WHERE chunk.chunk_id = snapshot.chunk_id;

COMMIT;
