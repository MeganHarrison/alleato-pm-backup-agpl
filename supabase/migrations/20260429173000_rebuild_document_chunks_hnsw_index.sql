-- Rebuild invalid document_chunks vector index.
--
-- The index existed but was not valid/ready, which forced vector retrieval RPCs
-- into sequential scans and statement timeouts. These statements must run
-- outside an explicit transaction; apply deliberately with psql or a migration
-- runner. The existing index is invalid/empty, so the rebuild needs to favor a
-- deterministic repair over a long concurrent build that can remain stuck.

set statement_timeout = 0;
set lock_timeout = '5min';
drop index if exists public.idx_document_chunks_embedding;

-- Use a single IVFFLAT list as the immediate stability repair. This avoids the
-- long k-means build that blocked HNSW and higher-list IVFFLAT attempts on the
-- current remote database. Rebuild with a higher list count during a planned
-- maintenance window once retrieval is no longer falling back to seq scans.
create index idx_document_chunks_embedding
  on public.document_chunks
  using ivfflat (embedding halfvec_cosine_ops)
  with (lists = 1);
