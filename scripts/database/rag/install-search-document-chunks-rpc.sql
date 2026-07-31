-- Compatibility wrapper for manually reinstalling the RAG search RPC.
--
-- The canonical definition now lives in the hybrid-ranking RAG migration so the
-- RPC, telemetry table, aggregate stats view, and rollback plan stay together.
-- Run this from the repository root with:
--
--   psql "$RAG_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/database/rag/install-search-document-chunks-rpc.sql

\i scripts/database/rag/migrations/20260619223000_hybrid_rag_ranking.sql
