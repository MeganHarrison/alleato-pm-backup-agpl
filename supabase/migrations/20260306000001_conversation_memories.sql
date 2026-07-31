-- Migration: Evolve memories table for conversation memory RAG
-- The memories table exists but is orphaned (no user_id, session_id, or data).
-- This adds the columns needed to store user-scoped conversation summaries
-- and a search RPC for the AI assistant to recall past discussions.

-- 1. Add missing columns to the existing memories table
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'conversation_summary',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
-- 3. RLS: users can only read their own memories
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own memories"
  ON memories FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all memories"
  ON memories FOR ALL
  USING (true)
  WITH CHECK (true);
-- Grant the service role full access (used by the after() hook)
GRANT ALL ON memories TO service_role;
-- 4. Semantic search RPC — separate from search_all_knowledge
--    to keep conversation memories user-scoped (privacy).
CREATE OR REPLACE FUNCTION search_conversation_memories(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (id bigint, content text, metadata jsonb, similarity float)
AS $$
  SELECT m.id, m.content, m.metadata,
         1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE m.memory_type = 'conversation_summary'
    AND (filter_user_id IS NULL OR m.user_id = filter_user_id)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
