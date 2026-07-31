-- ROOT CAUSE FIX: Drop HNSW index that caused PM APP OOM crash loop (2026-05-17).
--
-- What happened:
--   20260320100000_consolidate_rag_schema.sql added summary_embedding halfvec(3072)
--   to document_metadata with an HNSW index (m=32, ef_construction=200 — max aggression).
--   After the SupabaseRagStore migration (2026-05-15) moved embeddings to the AI Database
--   (fqcvmfqldlewvbsuxdvz), PM APP's document_metadata still held 4,653 old vectors.
--   On startup PostgreSQL loads the HNSW graph into shared_buffers → OOM → crash → loop.
--   The DB was crashing within ~12 seconds of completing WAL recovery.
--
-- Fix: drop the index. The data (4,653 vectors) is cleared in the next migration.
-- The write-block trigger is added in the migration after that.
--
-- Target: PM APP (lgveqfnpkxvzbnnwuled) ONLY. AI Database has its own correct indexes.

DROP INDEX IF EXISTS idx_document_metadata_summary_embedding;
