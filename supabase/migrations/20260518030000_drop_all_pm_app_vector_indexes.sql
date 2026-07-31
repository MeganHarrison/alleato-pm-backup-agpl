-- COMPREHENSIVE: Drop every HNSW/vector index in PM APP and block all embedding writes.
--
-- Background: PM APP (lgveqfnpkxvzbnnwuled) is the app database. Vector embeddings
-- and their indexes belong exclusively in the AI Database (fqcvmfqldlewvbsuxdvz).
-- Every HNSW index with m=32, ef_construction=200 causes OOM crash loops under
-- concurrent inserts because updating the HNSW graph spikes memory per write.
--
-- Prior fixes (piecemeal, caused repeated crashes):
--   20260518013701: dropped idx_document_metadata_summary_embedding
--   20260518014446: blocked document_metadata.summary_embedding writes
--   20260518020000: dropped idx_ai_memories_embedding, blocked ai_memories.embedding
--
-- This migration finishes the job: drops ALL remaining vector indexes in PM APP
-- and adds write-block triggers so no code path can re-introduce this pattern.
--
-- Code fixes deployed alongside this migration (all embedding writes stripped):
--   - fireflies_pipeline.py: ai_memories insert
--   - ai-memory-service.ts: ai_memories insert/update
--   - workspace-artifact-service.ts: workspace_artifacts insert/update
--   - agent-learning-service.ts: agent_learnings upsert

-- =============================================================================
-- DROP ALL REMAINING VECTOR INDEXES
-- =============================================================================

-- agent_learnings (m=32, ef=200 — actively written by agent-learning-service.ts)
DROP INDEX IF EXISTS idx_agent_learnings_embedding;

-- workspace_artifacts (m=16, ef=64 — actively written by workspace-artifact-service.ts)
DROP INDEX IF EXISTS idx_workspace_artifacts_embedding;

-- insights (m=32, ef=200 — no active runtime writer, but still dangerous at startup)
DROP INDEX IF EXISTS idx_insights_embedding;

-- support_article_chunks (m=32, ef=200 — no active runtime writer)
DROP INDEX IF EXISTS idx_support_chunks_embedding;

-- meeting_segments (m=32, ef=200 — backfill script only, column may still have data)
DROP INDEX IF EXISTS meeting_segments_summary_embedding_idx;

-- decisions, risks, opportunities (m=32, ef=200 — tables superseded by insights)
DROP INDEX IF EXISTS decisions_embedding_idx;
DROP INDEX IF EXISTS risks_embedding_idx;
DROP INDEX IF EXISTS opportunities_embedding_idx;

-- company_knowledge (m=32, ef=200)
DROP INDEX IF EXISTS idx_company_knowledge_embedding_hnsw;
DROP INDEX IF EXISTS idx_company_knowledge_embedding;

-- document_chunks PM APP copies (document_chunks writes should go to AI Database)
-- These indexes exist on the legacy PM APP copy of document_chunks
DROP INDEX IF EXISTS idx_document_chunks_embedding_hnsw;
DROP INDEX IF EXISTS idx_document_chunks_teams_embedding;
DROP INDEX IF EXISTS idx_document_chunks_embedding;
DROP INDEX IF EXISTS idx_document_chunks_embedding_ivfflat;

-- Legacy / catch-all names from older migrations
DROP INDEX IF EXISTS idx_figures_embedding;

-- =============================================================================
-- WRITE-BLOCK TRIGGERS for active write paths
-- =============================================================================

-- workspace_artifacts.embedding
CREATE OR REPLACE FUNCTION public.block_workspace_artifact_embedding_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.embedding IS NOT NULL THEN
    RAISE EXCEPTION
      'WRONG DATABASE: workspace_artifacts.embedding must not be written in PM APP. '
      'The HNSW index on this column causes OOM crash loops. '
      'Remove embedding from the insert/update payload in workspace-artifact-service.ts.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS block_workspace_artifact_embedding_write ON public.workspace_artifacts;
CREATE TRIGGER block_workspace_artifact_embedding_write
  BEFORE INSERT OR UPDATE ON public.workspace_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.block_workspace_artifact_embedding_write();

-- agent_learnings.embedding
CREATE OR REPLACE FUNCTION public.block_agent_learning_embedding_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.embedding IS NOT NULL THEN
    RAISE EXCEPTION
      'WRONG DATABASE: agent_learnings.embedding must not be written in PM APP. '
      'The HNSW index (m=32, ef_construction=200) causes OOM crash loops. '
      'Remove embedding from the upsert payload in agent-learning-service.ts.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS block_agent_learning_embedding_write ON public.agent_learnings;
CREATE TRIGGER block_agent_learning_embedding_write
  BEFORE INSERT OR UPDATE ON public.agent_learnings
  FOR EACH ROW EXECUTE FUNCTION public.block_agent_learning_embedding_write();

-- insights.embedding (no active writer but guard anyway)
CREATE OR REPLACE FUNCTION public.block_insights_embedding_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.embedding IS NOT NULL THEN
    RAISE EXCEPTION
      'WRONG DATABASE: insights.embedding must not be written in PM APP. '
      'Vector data belongs in the AI Database (fqcvmfqldlewvbsuxdvz).';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS block_insights_embedding_write ON public.insights;
CREATE TRIGGER block_insights_embedding_write
  BEFORE INSERT OR UPDATE ON public.insights
  FOR EACH ROW EXECUTE FUNCTION public.block_insights_embedding_write();

-- =============================================================================
-- NULL OUT EXISTING EMBEDDING DATA in active tables
-- (Reduces memory pressure immediately; data belongs in AI Database)
-- =============================================================================
UPDATE public.workspace_artifacts SET embedding = NULL WHERE embedding IS NOT NULL;
UPDATE public.agent_learnings      SET embedding = NULL WHERE embedding IS NOT NULL;
UPDATE public.insights             SET embedding = NULL WHERE embedding IS NOT NULL;
UPDATE public.meeting_segments     SET summary_embedding = NULL WHERE summary_embedding IS NOT NULL;

COMMENT ON FUNCTION public.block_workspace_artifact_embedding_write IS
  'PM APP write guard added 2026-05-17. See also block_summary_embedding_write, block_ai_memories_embedding_write.';
COMMENT ON FUNCTION public.block_agent_learning_embedding_write IS
  'PM APP write guard added 2026-05-17. See also block_summary_embedding_write, block_ai_memories_embedding_write.';
COMMENT ON FUNCTION public.block_insights_embedding_write IS
  'PM APP write guard added 2026-05-17. See also block_summary_embedding_write, block_ai_memories_embedding_write.';
