-- Partial HNSW index for source_type='ai_memory' on document_chunks (AI DB).
-- The assistant's searchMemories tool (frontend ai-memory-service.ts) calls
-- search_document_chunks with filter_source_types=['ai_memory'], but ai_memory was
-- the only large source type WITHOUT a partial HNSW index (email/teams/meeting/onedrive
-- all have one). So the filtered memory search fell back to a full ivfflat scan over
-- ~146k chunks and timed out at the 8s statement_timeout -> the AI chat reported
-- "memory search failed on timeout". This partial index (25,206 ai_memory rows) drops
-- searchMemories to ~0.7s cold / ~0.24s warm. Matches the params of the existing
-- per-source partial indexes (m=8, ef_construction=32). 2026-06-24.
--
-- NOTE: the live index was built with CREATE INDEX CONCURRENTLY (no table lock). This
-- migration uses a plain CREATE INDEX IF NOT EXISTS so it is a no-op where the index
-- already exists and replays safely inside a migration transaction on a fresh DB.
CREATE INDEX IF NOT EXISTS idx_document_chunks_ai_memory_embedding
ON public.document_chunks
USING hnsw (embedding halfvec_cosine_ops)
WITH (m = 8, ef_construction = 32)
WHERE source_type = 'ai_memory';
