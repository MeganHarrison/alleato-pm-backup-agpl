-- Drop company_knowledge table and associated infrastructure.
-- All knowledge uploads now route through document_metadata (category='knowledge')
-- and the existing RAG pipeline (fireflies_ingestion_jobs → document_chunks).
--
-- This migration is safe to run multiple times (IF EXISTS guards throughout).
-- Drop order: function → indexes → table

-- 1. Drop the search RPC (references the table)
DROP FUNCTION IF EXISTS search_knowledge_base(vector, integer, float);
DROP FUNCTION IF EXISTS search_knowledge_base(text, integer, float);
DROP FUNCTION IF EXISTS search_knowledge_base(vector(1536), integer, float);
DROP FUNCTION IF EXISTS search_knowledge_base(vector(3072), integer, float);

-- 2. Drop the table (cascades to indexes and constraints)
DROP TABLE IF EXISTS company_knowledge CASCADE;
