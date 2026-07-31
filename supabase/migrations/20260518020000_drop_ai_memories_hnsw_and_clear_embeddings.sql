-- ROOT CAUSE FIX #2: ai_memories HNSW index causing OOM crash loop (2026-05-17).
--
-- Same pattern as document_metadata.summary_embedding (fixed in 20260518013701):
-- ai_memories.embedding has an HNSW index (m=32, ef_construction=200) in PM APP.
-- The Fireflies pipeline and ai-memory-service.ts were both writing 3072-dim
-- vectors to this table. Concurrent inserts require HNSW graph updates which
-- spike memory and crash the database under load.
--
-- Code fixes (already committed):
--   - fireflies_pipeline.py: removed embedding from insert payload
--   - ai-memory-service.ts: removed embedding from all insert/update paths,
--     replaced vector dedup with exact-content dedup
--
-- DB fixes (this migration):
--   1. Drop the HNSW index immediately
--   2. Null out all existing embeddings
--   3. Block future writes with a trigger
--
-- Note: search_ai_memories RPC will return empty results until ai_memories
-- embeddings are properly moved to the AI Database (fqcvmfqldlewvbsuxdvz).
-- This is acceptable — a degraded search is better than a crashed database.

-- ─── 1. Drop the index ───────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_ai_memories_embedding;

-- ─── 2. Null existing embeddings ─────────────────────────────────────────────
-- Done in batches at runtime if table is large. This migration clears the rest.
UPDATE public.ai_memories SET embedding = NULL WHERE embedding IS NOT NULL;

-- ─── 3. Write-block trigger ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_ai_memories_embedding_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.embedding IS NOT NULL THEN
    RAISE EXCEPTION
      'WRONG DATABASE: ai_memories.embedding must not be written in PM APP. '
      'The HNSW index on this column caused OOM crash loops under concurrent inserts. '
      'Remove embedding from the write payload. Vector search for memories should '
      'use document_chunks in the AI Database (fqcvmfqldlewvbsuxdvz).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_ai_memories_embedding_write ON public.ai_memories;
CREATE TRIGGER block_ai_memories_embedding_write
  BEFORE INSERT OR UPDATE ON public.ai_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.block_ai_memories_embedding_write();

COMMENT ON FUNCTION public.block_ai_memories_embedding_write IS
  'Prevents embedding writes to ai_memories in PM APP. Added 2026-05-17 after '
  'concurrent HNSW index updates caused OOM crash loops. See also: '
  'block_summary_embedding_write on document_metadata.';
