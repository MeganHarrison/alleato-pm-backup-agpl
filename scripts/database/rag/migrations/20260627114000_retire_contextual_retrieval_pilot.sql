-- Retire the dormant contextual retrieval pilot.
--
-- The production RAG path uses public.search_document_chunks. The contextual
-- variant was a manual pilot with no Render/package owner and no automatic
-- ingestion integration.

drop function if exists public.search_document_chunks_contextual(
  extensions.halfvec,
  text[],
  bigint,
  integer,
  double precision
);

drop function if exists public.search_document_chunks_contextual(
  halfvec,
  text[],
  bigint,
  integer,
  double precision
);

drop index if exists public.document_chunks_embedding_contextual_hnsw;

alter table public.document_chunks
  drop column if exists chunk_context,
  drop column if exists embedding_contextual,
  drop column if exists contextualized_at;
