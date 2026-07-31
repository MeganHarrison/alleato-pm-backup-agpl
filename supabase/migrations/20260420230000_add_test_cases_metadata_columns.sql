-- Add metadata/traceability columns to test_cases that the admin test-cases
-- table page references but were never included in the original migration.

ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS gap_type         TEXT,
  ADD COLUMN IF NOT EXISTS tool             INTEGER REFERENCES public.procore_tools(id),
  ADD COLUMN IF NOT EXISTS source_url       TEXT,
  ADD COLUMN IF NOT EXISTS source_manifest_path TEXT,
  ADD COLUMN IF NOT EXISTS source_article_id    INTEGER,
  ADD COLUMN IF NOT EXISTS source_chunk_id      INTEGER,
  ADD COLUMN IF NOT EXISTS procore_feature_id   TEXT;
COMMENT ON COLUMN public.test_cases.gap_type IS 'Parity gap classification (e.g. missing, partial, different).';
COMMENT ON COLUMN public.test_cases.tool IS 'FK to procore_tools — which Procore tool this case covers.';
COMMENT ON COLUMN public.test_cases.source_url IS 'URL of the source page this test case was generated from.';
COMMENT ON COLUMN public.test_cases.source_manifest_path IS 'Path to the Procore crawl manifest that produced this case.';
COMMENT ON COLUMN public.test_cases.source_article_id IS 'FK to support_articles used as source material.';
COMMENT ON COLUMN public.test_cases.source_chunk_id IS 'FK to document_chunks used as source material.';
COMMENT ON COLUMN public.test_cases.procore_feature_id IS 'Procore feature identifier for parity tracking.';
