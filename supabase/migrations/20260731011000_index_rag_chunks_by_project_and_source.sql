-- Keep project-scoped semantic retrieval inside the statement-timeout budget.
--
-- search_document_chunks filters project attribution from document_chunks.metadata
-- before ranking by vector distance. Without this expression index, even a
-- resolved project search scans the broader source corpus and can time out.
create index if not exists idx_document_chunks_source_project_embedding_ready
  on public.document_chunks (
    source_type,
    ((nullif(metadata ->> 'project_id', ''))::bigint)
  )
  where embedding is not null;

analyze public.document_chunks;
