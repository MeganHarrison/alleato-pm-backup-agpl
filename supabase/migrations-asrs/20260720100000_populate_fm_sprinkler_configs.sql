-- Populate fm_sprinkler_configs from fm_global_tables.design_parameters->data_points.
-- TARGET: ASRS Supabase project (vqnnvpnoitqhijkztyhq) -- NOT the PM APP project.
--
-- WHY: fm_sprinkler_configs has been empty (0 rows) in both projects since inception.
-- find_sprinkler_requirements INNER JOINs it, so the public FM Global form has returned
-- essentially no matches for its entire production life (19 submissions 2025-09 -> 2026-05,
-- only 3 with any match, 0 with a selected configuration).
--
-- The data was never missing -- it was nested in the design_parameters JSONB blob:
--   data_points[] -> { ceiling_height_ft, ceiling_height_m,
--                      sprinkler_configurations: { <orientation>: { <response_type>: [
--                        { count, k_factor, k_metric, pressure_psi, pressure_bar } ] } } }
--
-- This migration flattens that structure into the relational table the RPCs expect.
-- Idempotent: derived rows are identified by notes='derived:design_parameters.data_points'
-- and replaced wholesale on re-run. Hand-authored rows (any other notes value) are preserved.

BEGIN;

DELETE FROM public.fm_sprinkler_configs
WHERE notes = 'derived:design_parameters.data_points';

INSERT INTO public.fm_sprinkler_configs (
  table_id,
  ceiling_height_ft,
  sprinkler_count,
  k_factor,
  k_factor_type,
  coverage_type,
  pressure_psi,
  pressure_bar,
  orientation,
  response_type,
  notes
)
SELECT
  t.table_id,
  (dp.value ->> 'ceiling_height_ft')::numeric,
  NULLIF(cfg.value ->> 'count', '')::integer,
  -- k_factor is usually numeric ("25.2") but may carry a coverage suffix ("25.2EC").
  -- Strip any trailing alpha suffix so the numeric column stays queryable; the suffix
  -- is preserved in coverage_type below. Verified 2026-07-20: 'EC' is the only variant.
  NULLIF(regexp_replace(cfg.value ->> 'k_factor', '[^0-9.].*$', ''), '')::numeric,
  -- k_metric carries the nominal metric K plus the same optional suffix (360 vs "360EC").
  NULLIF(cfg.value ->> 'k_metric', ''),
  CASE
    WHEN (cfg.value ->> 'k_factor') ~* 'EC$' OR (cfg.value ->> 'k_metric') ~* 'EC$'
      THEN 'extended'
    ELSE 'standard'
  END,
  NULLIF(cfg.value ->> 'pressure_psi', '')::numeric,
  NULLIF(cfg.value ->> 'pressure_bar', '')::numeric,
  orient.key,
  resp.key,
  'derived:design_parameters.data_points'
FROM public.fm_global_tables t
CROSS JOIN LATERAL jsonb_array_elements(t.design_parameters -> 'data_points') AS dp(value)
CROSS JOIN LATERAL jsonb_each(dp.value -> 'sprinkler_configurations') AS orient(key, value)
CROSS JOIN LATERAL jsonb_each(orient.value) AS resp(key, value)
CROSS JOIN LATERAL jsonb_array_elements(resp.value) AS cfg(value)
WHERE t.design_parameters ? 'data_points'
  AND jsonb_typeof(t.design_parameters -> 'data_points') = 'array'
  AND dp.value ->> 'ceiling_height_ft' IS NOT NULL;

-- Guardrail: fail the migration rather than silently shipping an empty/partial table.
-- 646 rows across 12 tables measured 2026-07-20; allow growth, block collapse.
--
-- 12, not 19: of the 19 fm_global_tables carrying design_parameters.data_points, 7 are a
-- different kind of table and legitimately yield no ceiling sprinkler configurations --
-- table_1/2/3/26 are decision + lookup tables (sprinklers per branch line, hose demand,
-- "determining which ceiling sprinkler protection scheme"), and table_33/34/35 are
-- in-rack (IRAS) designs keyed on iras_arrangement/storage_configurations instead of
-- sprinkler_configurations. Their data_points have no sprinkler_configurations key at all.
-- Verified 2026-07-20. If a future extraction pass adds ceiling configs to those tables,
-- raise this threshold deliberately -- do not lower it to make a failing run pass.
DO $$
DECLARE
  v_rows integer;
  v_tables integer;
BEGIN
  SELECT count(*), count(DISTINCT table_id)
    INTO v_rows, v_tables
    FROM public.fm_sprinkler_configs
   WHERE notes = 'derived:design_parameters.data_points';

  IF v_rows < 600 OR v_tables < 12 THEN
    RAISE EXCEPTION
      'fm_sprinkler_configs derivation collapsed: got % rows across % tables, expected >=600 across >=19. Refusing to ship a table that silently returns no matches.',
      v_rows, v_tables;
  END IF;

  RAISE NOTICE 'fm_sprinkler_configs: derived % rows across % tables', v_rows, v_tables;
END $$;

COMMIT;
