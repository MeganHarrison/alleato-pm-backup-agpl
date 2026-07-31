-- Expand company_context table for AI Company Knowledge Base (Phase 1A)
-- Adds columns for mission/vision, competitive landscape, history,
-- key differentiators, and company-level documents/notes.

-- New text columns for structured knowledge
ALTER TABLE company_context
  ADD COLUMN IF NOT EXISTS mission TEXT,
  ADD COLUMN IF NOT EXISTS vision TEXT,
  ADD COLUMN IF NOT EXISTS company_history TEXT,
  ADD COLUMN IF NOT EXISTS key_differentiators JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS competitive_landscape JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_markets JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS core_values JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS annual_revenue_range TEXT,
  ADD COLUMN IF NOT EXISTS employee_count INTEGER,
  ADD COLUMN IF NOT EXISTS founded_year INTEGER,
  ADD COLUMN IF NOT EXISTS headquarters TEXT,
  ADD COLUMN IF NOT EXISTS service_areas JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS key_clients JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes TEXT;
-- Company knowledge entries — free-form knowledge articles
-- (for strategy decks, business plans, meeting notes, etc.)
CREATE TABLE IF NOT EXISTS company_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'strategy', 'policy', 'process', 'market_intel',
    'lessons_learned', 'best_practice', 'org_update', 'general'
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  source TEXT, -- e.g., "Q4 Strategy Deck", "Board Meeting 2026-01-15"
  author_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Index for searching knowledge articles
CREATE INDEX IF NOT EXISTS idx_company_knowledge_category ON company_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_company_knowledge_tags ON company_knowledge USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_company_knowledge_search ON company_knowledge USING GIN(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
);
-- RLS policies for company_knowledge
ALTER TABLE company_knowledge ENABLE ROW LEVEL SECURITY;
-- All authenticated users can read company knowledge
DROP POLICY IF EXISTS "Users can read company knowledge" ON company_knowledge;
CREATE POLICY "Users can read company knowledge"
  ON company_knowledge FOR SELECT
  TO authenticated
  USING (true);
-- Only authenticated users can insert knowledge
DROP POLICY IF EXISTS "Users can insert company knowledge" ON company_knowledge;
CREATE POLICY "Users can insert company knowledge"
  ON company_knowledge FOR INSERT
  TO authenticated
  WITH CHECK (true);
-- Users can update their own knowledge entries
DROP POLICY IF EXISTS "Users can update own company knowledge" ON company_knowledge;
CREATE POLICY "Users can update own company knowledge"
  ON company_knowledge FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid());
-- Updated_at trigger for company_knowledge
CREATE OR REPLACE FUNCTION update_company_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_company_knowledge_timestamp ON company_knowledge;
CREATE TRIGGER update_company_knowledge_timestamp
  BEFORE UPDATE ON company_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_company_knowledge_updated_at();
-- Comment documenting the expansion
COMMENT ON TABLE company_knowledge IS 'Free-form company knowledge articles for AI RAG. Strategy docs, policies, processes, lessons learned, etc.';
COMMENT ON COLUMN company_context.mission IS 'Company mission statement';
COMMENT ON COLUMN company_context.vision IS 'Company vision statement';
COMMENT ON COLUMN company_context.company_history IS 'Brief company history and founding story';
COMMENT ON COLUMN company_context.key_differentiators IS 'JSON array of competitive differentiators';
COMMENT ON COLUMN company_context.competitive_landscape IS 'JSON array of competitor profiles';
COMMENT ON COLUMN company_context.target_markets IS 'JSON array of target market segments';
COMMENT ON COLUMN company_context.core_values IS 'JSON array of company core values';
