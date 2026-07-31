-- =============================================================================
-- Remove ASRS / FM-Global (FMDS 8-34 sprinkler engineering) from the PM APP DB
-- =============================================================================
-- The ASRS/FM-Global feature is being retired from the application. The
-- dedicated ASRS Estimator Supabase project (vqnnvpnoitqhijkztyhq) is KEPT and
-- is NOT touched by this migration. This migration only removes the ASRS/FM
-- artifacts that were left behind in the PM APP project (lgveqfnpkxvzbnnwuled):
-- 21 base tables + 10 RPCs + 1 dependent view (figure_statistics, dropped via
-- CASCADE), plus relaxing the estimates.estimate_type check constraint to drop
-- the 'asrs' estimate type.
--
-- Verified live 2026-07-24 before writing:
--   * No table outside the ASRS/FM set depends on these tables EXCEPT
--     block_embeddings (0 rows, FK -> asrs_blocks, no code refs) — included below.
--   * estimates has 0 rows with estimate_type = 'asrs' (2 design_build, 30 NULL),
--     so the constraint change needs no data backfill.
-- Reversible via the pre-change database backup.
-- =============================================================================

BEGIN;

-- 1) RPC functions (dropped first; CASCADE clears any dependent objects) ------
DROP FUNCTION IF EXISTS public.find_sprinkler_requirements(p_asrs_type character varying, p_system_type character varying, p_ceiling_height_ft integer, p_commodity_class character varying, p_k_factor numeric) CASCADE;
DROP FUNCTION IF EXISTS public.find_sprinkler_requirements(p_asrs_type text, p_system_type text, p_ceiling_height_ft numeric, p_commodity_class text, p_tolerance_ft numeric) CASCADE;
DROP FUNCTION IF EXISTS public.generate_optimization_recommendations(project_data jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.get_asrs_figure_options() CASCADE;
DROP FUNCTION IF EXISTS public.get_fm_global_references_by_topic(topic text, limit_count integer) CASCADE;
DROP FUNCTION IF EXISTS public.hybrid_search_fm_global(query_embedding vector, query_text text, match_count integer, text_weight double precision, filter_asrs_type text) CASCADE;
DROP FUNCTION IF EXISTS public.interpolate_sprinkler_requirements(p_table_id character varying, p_target_height_ft integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_fm_global_vectors(query_embedding vector, match_count integer, filter_asrs_type text, filter_source_type text) CASCADE;
DROP FUNCTION IF EXISTS public.search_asrs_figures(p_search_text text, p_asrs_type character varying, p_container_type character varying, p_orientation_type character varying, p_rack_depth character varying, p_spacing character varying) CASCADE;
DROP FUNCTION IF EXISTS public.search_fm_global_all(query_embedding vector, query_text text, match_count integer) CASCADE;

-- 2) Tables (CASCADE clears embeddings FK + internal FKs + indexes/vectors) ----
-- block_embeddings first: it is the only external referrer (into asrs_blocks).
DROP TABLE IF EXISTS public.block_embeddings CASCADE;

-- ASRS tables
DROP TABLE IF EXISTS public.asrs_blocks CASCADE;
DROP TABLE IF EXISTS public.asrs_configurations CASCADE;
DROP TABLE IF EXISTS public.asrs_decision_matrix CASCADE;
DROP TABLE IF EXISTS public.asrs_logic_cards CASCADE;
DROP TABLE IF EXISTS public.asrs_protection_rules CASCADE;
DROP TABLE IF EXISTS public.asrs_sections CASCADE;

-- FM-Global / FMDS tables
DROP TABLE IF EXISTS public.fm_blocks CASCADE;
DROP TABLE IF EXISTS public.fm_cost_factors CASCADE;
DROP TABLE IF EXISTS public.fm_documents CASCADE;
DROP TABLE IF EXISTS public.fm_form_submissions CASCADE;
DROP TABLE IF EXISTS public.fm_global_figures CASCADE;
DROP TABLE IF EXISTS public.fm_global_tables CASCADE;
DROP TABLE IF EXISTS public.fm_optimization_rules CASCADE;
DROP TABLE IF EXISTS public.fm_optimization_suggestions CASCADE;
DROP TABLE IF EXISTS public.fm_sections CASCADE;
DROP TABLE IF EXISTS public.fm_sprinkler_configs CASCADE;
DROP TABLE IF EXISTS public.fm_table_vectors CASCADE;
DROP TABLE IF EXISTS public.fm_text_chunks CASCADE;

-- FM/ASRS domain tables without the fm_/asrs_ name prefix (domain: fm-asrs in
-- tables.yaml). Both empty, no inbound FKs, no code references (verified 2026-07-24).
DROP TABLE IF EXISTS public.optimization_rules CASCADE;
DROP TABLE IF EXISTS public.design_recommendations CASCADE;

-- 3) estimates.estimate_type: drop the 'asrs' option, keep 'design_build' ------
ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_estimate_type_check;
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_estimate_type_check
  CHECK (estimate_type IS NULL OR estimate_type = 'design_build');

COMMIT;
