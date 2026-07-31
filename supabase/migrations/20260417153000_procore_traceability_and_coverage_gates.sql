-- Procore parity traceability + coverage gates
-- Goal: fail loudly when Procore features are not mapped or high-priority tests
-- are missing authoritative traceability evidence.

-- 1) Extend test_cases with source traceability and explicit parity gap typing.
ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS procore_feature_id UUID REFERENCES public.procore_features(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_article_id BIGINT REFERENCES public.support_articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_chunk_id BIGINT REFERENCES public.support_article_chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_manifest_path TEXT,
  ADD COLUMN IF NOT EXISTS gap_type TEXT NOT NULL DEFAULT 'unknown';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'test_cases_gap_type_chk'
  ) THEN
    ALTER TABLE public.test_cases
      ADD CONSTRAINT test_cases_gap_type_chk
      CHECK (gap_type IN ('matched', 'missing', 'mismatch', 'custom', 'blocked', 'unknown'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_test_cases_procore_feature_id
  ON public.test_cases (procore_feature_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_source_article_id
  ON public.test_cases (source_article_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_source_chunk_id
  ON public.test_cases (source_chunk_id);
-- New high-priority test cases must include source traceability and a feature mapping.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'test_cases_high_priority_traceability_chk'
  ) THEN
    ALTER TABLE public.test_cases
      ADD CONSTRAINT test_cases_high_priority_traceability_chk
      CHECK (
        priority <> 'HIGH'
        OR (
          procore_feature_id IS NOT NULL
          AND (
            source_chunk_id IS NOT NULL
            OR source_article_id IS NOT NULL
            OR length(trim(coalesce(source_manifest_path, ''))) > 0
          )
          AND length(trim(coalesce(source_url, ''))) > 0
        )
      ) NOT VALID;
  END IF;
END $$;
-- 2) Canonical one-row-per-feature implementation mapping.
CREATE TABLE IF NOT EXISTS public.procore_feature_implementations (
  feature_id UUID PRIMARY KEY REFERENCES public.procore_features(id) ON DELETE CASCADE,
  tool_id INTEGER REFERENCES public.procore_tools(id) ON DELETE SET NULL,
  frontend_route TEXT,
  api_routes TEXT[] NOT NULL DEFAULT '{}',
  db_tables TEXT[] NOT NULL DEFAULT '{}',
  component_paths TEXT[] NOT NULL DEFAULT '{}',
  mapping_status TEXT NOT NULL DEFAULT 'unknown',
  owner TEXT,
  notes TEXT,
  linked_test_case_id UUID REFERENCES public.test_cases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'procore_feature_impl_status_chk'
  ) THEN
    ALTER TABLE public.procore_feature_implementations
      ADD CONSTRAINT procore_feature_impl_status_chk
      CHECK (mapping_status IN ('matched', 'missing', 'mismatch', 'custom', 'blocked', 'unknown'));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'procore_feature_impl_evidence_chk'
  ) THEN
    ALTER TABLE public.procore_feature_implementations
      ADD CONSTRAINT procore_feature_impl_evidence_chk
      CHECK (
        mapping_status IN ('missing', 'blocked', 'unknown')
        OR (
          length(trim(coalesce(frontend_route, ''))) > 0
          OR coalesce(array_length(api_routes, 1), 0) > 0
          OR coalesce(array_length(db_tables, 1), 0) > 0
          OR coalesce(array_length(component_paths, 1), 0) > 0
        )
      );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_procore_feature_impl_tool_id
  ON public.procore_feature_implementations (tool_id);
CREATE INDEX IF NOT EXISTS idx_procore_feature_impl_status
  ON public.procore_feature_implementations (mapping_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_procore_feature_impl_linked_test_case_id
  ON public.procore_feature_implementations (linked_test_case_id)
  WHERE linked_test_case_id IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_procore_feature_implementations_updated_at'
  ) THEN
    CREATE TRIGGER set_procore_feature_implementations_updated_at
      BEFORE UPDATE ON public.procore_feature_implementations
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
-- 3) Coverage + gap views for dashboarding and CI checks.
CREATE OR REPLACE VIEW public.procore_feature_mapping_gaps AS
SELECT
  f.id AS feature_id,
  f.name AS feature_name,
  f.slug AS feature_slug,
  f.priority AS feature_priority,
  f.status AS feature_status,
  f.include_in_rebuild,
  i.mapping_status,
  i.tool_id
FROM public.procore_features f
LEFT JOIN public.procore_feature_implementations i ON i.feature_id = f.id
WHERE coalesce(f.include_in_rebuild, true)
  AND (
    i.feature_id IS NULL
    OR i.mapping_status IN ('missing', 'mismatch', 'blocked', 'unknown')
  );
CREATE OR REPLACE VIEW public.procore_test_traceability_gaps AS
SELECT
  tc.id AS case_id,
  tc.suite_id,
  ts.tool_name,
  tc.test_number,
  tc.test_name,
  tc.priority,
  tc.test_type,
  tc.procore_feature_id,
  tc.source_article_id,
  tc.source_chunk_id,
  tc.source_url,
  tc.source_manifest_path,
  tc.gap_type
FROM public.test_cases tc
JOIN public.test_suites ts ON ts.id = tc.suite_id
WHERE tc.priority = 'HIGH'
  AND (
    tc.procore_feature_id IS NULL
    OR length(trim(coalesce(tc.source_url, ''))) = 0
    OR (
      tc.source_chunk_id IS NULL
      AND tc.source_article_id IS NULL
      AND length(trim(coalesce(tc.source_manifest_path, ''))) = 0
    )
  );
CREATE OR REPLACE VIEW public.procore_coverage_summary AS
WITH high_tests AS (
  SELECT
    count(*)::INT AS total_high_tests,
    count(*) FILTER (
      WHERE
        procore_feature_id IS NOT NULL
        AND length(trim(coalesce(source_url, ''))) > 0
        AND (
          source_chunk_id IS NOT NULL
          OR source_article_id IS NOT NULL
          OR length(trim(coalesce(source_manifest_path, ''))) > 0
        )
    )::INT AS traced_high_tests
  FROM public.test_cases
  WHERE priority = 'HIGH'
),
feature_map AS (
  SELECT
    count(*) FILTER (WHERE coalesce(f.include_in_rebuild, true))::INT AS total_rebuild_features,
    count(*) FILTER (
      WHERE coalesce(f.include_in_rebuild, true)
      AND i.feature_id IS NOT NULL
      AND i.mapping_status = 'matched'
    )::INT AS matched_rebuild_features,
    count(*) FILTER (
      WHERE coalesce(f.include_in_rebuild, true)
      AND (
        i.feature_id IS NULL
        OR i.mapping_status IN ('missing', 'mismatch', 'blocked', 'unknown')
      )
    )::INT AS uncovered_rebuild_features
  FROM public.procore_features f
  LEFT JOIN public.procore_feature_implementations i ON i.feature_id = f.id
)
SELECT
  h.total_high_tests,
  h.traced_high_tests,
  CASE
    WHEN h.total_high_tests = 0 THEN 0
    ELSE round((h.traced_high_tests::numeric * 100.0) / h.total_high_tests, 2)
  END AS high_traceability_percent,
  f.total_rebuild_features,
  f.matched_rebuild_features,
  f.uncovered_rebuild_features,
  CASE
    WHEN f.total_rebuild_features = 0 THEN 0
    ELSE round((f.matched_rebuild_features::numeric * 100.0) / f.total_rebuild_features, 2)
  END AS feature_mapping_percent
FROM high_tests h
CROSS JOIN feature_map f;
-- 4) CI gate: fail loudly when coverage drifts below threshold.
CREATE OR REPLACE FUNCTION public.assert_procore_coverage_gate(
  min_high_traceability_percent NUMERIC DEFAULT 100.0,
  min_feature_mapping_percent NUMERIC DEFAULT 100.0,
  allowed_uncovered_features INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_high_tests INT;
  v_traced_high_tests INT;
  v_high_traceability_percent NUMERIC;
  v_total_rebuild_features INT;
  v_matched_rebuild_features INT;
  v_uncovered_rebuild_features INT;
  v_feature_mapping_percent NUMERIC;
BEGIN
  SELECT
    total_high_tests,
    traced_high_tests,
    high_traceability_percent,
    total_rebuild_features,
    matched_rebuild_features,
    uncovered_rebuild_features,
    feature_mapping_percent
  INTO
    v_total_high_tests,
    v_traced_high_tests,
    v_high_traceability_percent,
    v_total_rebuild_features,
    v_matched_rebuild_features,
    v_uncovered_rebuild_features,
    v_feature_mapping_percent
  FROM public.procore_coverage_summary;

  IF v_total_high_tests = 0 THEN
    RAISE EXCEPTION
      USING MESSAGE = 'Procore coverage gate failed: no HIGH-priority test cases exist.',
            DETAIL = 'Detection gap: release cannot prove parity for critical paths.',
            HINT = 'Generate/reseed HIGH test cases with /procore-test-matrix and rerun parity seeding.';
  END IF;

  IF v_high_traceability_percent < min_high_traceability_percent THEN
    RAISE EXCEPTION
      USING MESSAGE = format(
        'Procore coverage gate failed: HIGH traceability %.2f%% below threshold %.2f%%.',
        v_high_traceability_percent,
        min_high_traceability_percent
      ),
      DETAIL = format(
        'Cause: %s of %s HIGH tests are fully traced to Procore sources.',
        v_traced_high_tests,
        v_total_high_tests
      ),
      HINT = 'Prevention: fill procore_feature_id + source_url + source_article/chunk/manifest for all HIGH test cases.';
  END IF;

  IF v_feature_mapping_percent < min_feature_mapping_percent
     OR v_uncovered_rebuild_features > allowed_uncovered_features THEN
    RAISE EXCEPTION
      USING MESSAGE = format(
        'Procore coverage gate failed: feature mapping %.2f%% (threshold %.2f%%), uncovered features %s (allowed %s).',
        v_feature_mapping_percent,
        min_feature_mapping_percent,
        v_uncovered_rebuild_features,
        allowed_uncovered_features
      ),
      DETAIL = format(
        'Cause: %s of %s rebuild features are mapped as matched.',
        v_matched_rebuild_features,
        v_total_rebuild_features
      ),
      HINT = 'Prevention: add/repair rows in procore_feature_implementations and resolve procore_feature_mapping_gaps.';
  END IF;
END;
$$;
