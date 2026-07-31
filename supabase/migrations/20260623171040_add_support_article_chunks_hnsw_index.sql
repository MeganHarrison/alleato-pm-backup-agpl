-- Procore docs RAG performance fix.
--
-- The /api/procore-docs/chat assistant ("Documentation Assistant") calls the
-- search_support_articles RPC, which orders by cosine distance
-- (c.embedding <=> query_embedding) over support_article_chunks. That table has
-- ~4,900 halfvec(3072) embeddings (~48 MB) and had NO ANN index, so every search
-- was a full sequential scan (~7.4s per query). The chat fired several searches
-- per message, so the route blocked for ~30-40s and the browser reported
-- "Load failed". An HNSW index drops the search to ~200ms.
--
-- halfvec_cosine_ops matches the `<=>` cosine operator used by the RPC.
-- (Applied live via Supabase MCP on 2026-06-23; this file records it for repo
-- reproducibility.)
CREATE INDEX IF NOT EXISTS idx_support_article_chunks_embedding_hnsw
  ON public.support_article_chunks
  USING hnsw (embedding halfvec_cosine_ops);
