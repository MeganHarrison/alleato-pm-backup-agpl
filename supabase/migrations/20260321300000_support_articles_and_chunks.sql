-- Migration: Support Articles & Chunks for Procore Documentation RAG
-- Purpose: Store crawled Procore support docs for both page display and vector search
-- Pattern: Matches existing halfvec(3072) + HNSW cosine pattern used by insights, document_chunks, etc.

-- Ensure pgvector extension is available (should already exist)
CREATE EXTENSION IF NOT EXISTS vector;
--------------------------------------------------------------------------------
-- Table 1: support_articles — full page content for display + metadata
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_articles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  slug TEXT GENERATED ALWAYS AS (
    regexp_replace(
      regexp_replace(url, '^https?://[^/]+/', ''),
      '[^a-z0-9/\-]', '', 'gi'
    )
  ) STORED,
  title TEXT NOT NULL,
  description TEXT,
  markdown_content TEXT NOT NULL,
  breadcrumb TEXT[] DEFAULT '{}',
  category TEXT,
  subcategory TEXT,
  tags TEXT[] DEFAULT '{}',
  content_hash TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  last_crawled_at TIMESTAMPTZ DEFAULT now(),
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Indexes for support_articles
CREATE INDEX IF NOT EXISTS idx_support_articles_category ON support_articles(category);
CREATE INDEX IF NOT EXISTS idx_support_articles_subcategory ON support_articles(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_support_articles_slug ON support_articles(slug);
CREATE INDEX IF NOT EXISTS idx_support_articles_updated ON support_articles(updated_at DESC);
-- Full-text search on title + markdown content
ALTER TABLE support_articles ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(markdown_content, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_support_articles_fts ON support_articles USING gin(fts);
--------------------------------------------------------------------------------
-- Table 2: support_article_chunks — chunked + embedded for RAG vector search
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_article_chunks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id BIGINT NOT NULL REFERENCES support_articles(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  heading TEXT,
  token_count INTEGER DEFAULT 0,
  embedding halfvec(3072),
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(article_id, chunk_index)
);
-- HNSW index for vector similarity search (matches existing project pattern)
CREATE INDEX IF NOT EXISTS idx_support_chunks_embedding
  ON support_article_chunks
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);
CREATE INDEX IF NOT EXISTS idx_support_chunks_article
  ON support_article_chunks(article_id);
--------------------------------------------------------------------------------
-- RPC: search_support_articles — semantic search across chunked docs
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_support_articles(
  query_embedding halfvec(3072),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id BIGINT,
  article_id BIGINT,
  title TEXT,
  url TEXT,
  slug TEXT,
  heading TEXT,
  chunk_text TEXT,
  category TEXT,
  subcategory TEXT,
  breadcrumb TEXT[],
  similarity FLOAT
) AS $$
  SELECT
    c.id AS chunk_id,
    a.id AS article_id,
    a.title,
    a.url,
    a.slug,
    c.heading,
    c.chunk_text,
    a.category,
    a.subcategory,
    a.breadcrumb,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM support_article_chunks c
  JOIN support_articles a ON a.id = c.article_id
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
--------------------------------------------------------------------------------
-- RPC: fulltext_search_support_articles — keyword search for browsing UI
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fulltext_search_support_articles(
  search_query TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id BIGINT,
  url TEXT,
  slug TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  breadcrumb TEXT[],
  rank FLOAT
) AS $$
  SELECT
    sa.id,
    sa.url,
    sa.slug,
    sa.title,
    sa.description,
    sa.category,
    sa.subcategory,
    sa.breadcrumb,
    ts_rank_cd(sa.fts, websearch_to_tsquery('english', search_query)) AS rank
  FROM support_articles sa
  WHERE sa.fts @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT result_limit;
$$ LANGUAGE sql STABLE;
--------------------------------------------------------------------------------
-- RLS: Enable but allow public read (support docs are not sensitive)
--------------------------------------------------------------------------------
ALTER TABLE support_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_article_chunks ENABLE ROW LEVEL SECURITY;
-- Authenticated users can read all support articles
CREATE POLICY "Authenticated users can read support articles"
  ON support_articles FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can read support article chunks"
  ON support_article_chunks FOR SELECT
  TO authenticated
  USING (true);
-- Service role can do everything (for crawl scripts)
CREATE POLICY "Service role full access on support articles"
  ON support_articles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Service role full access on support article chunks"
  ON support_article_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
--------------------------------------------------------------------------------
-- Updated_at trigger
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_support_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_support_articles_updated_at
  BEFORE UPDATE ON support_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_support_articles_updated_at();
