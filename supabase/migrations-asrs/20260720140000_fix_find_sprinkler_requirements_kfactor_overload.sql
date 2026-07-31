-- Repair the k-factor overload of find_sprinkler_requirements.
-- TARGET: ASRS Supabase project (vqnnvpnoitqhijkztyhq) -- NOT the PM APP project.
--
-- WHY: this overload (varchar, varchar, integer, varchar, numeric) selected
-- ceiling_height_ft, k_factor, k_type, sprinkler_count, pressure_psi, pressure_bar,
-- sprinkler_orientation and sprinkler_response directly off fm_global_tables. None of
-- those columns exist there -- they live on fm_sprinkler_configs. Every call raised
--     ERROR: column t.ceiling_height_ft does not exist
-- and actions.ts swallowed it with a console.warn, so k-factor-constrained matching
-- has never returned anything and nothing surfaced the failure.
--
-- Rewritten to join fm_sprinkler_configs, mirroring the text overload. The columns are
-- populated as of 20260720100000_populate_fm_sprinkler_configs.sql, so this now returns
-- real rows instead of erroring.
--
-- Also carries the same 'both'/'wet_or_dry' dual-system fix as the text overload
-- (see 20260720110000), and uses commodity_types -- fm_global_tables has no
-- commodity_classes column, which was a second latent error in the original body.
--
-- The OUT column names are deliberately unchanged (k_type, sprinkler_orientation,
-- sprinkler_response -- not the fm_sprinkler_configs spellings k_factor_type,
-- orientation, response_type). fmGlobalMatchSchema in
-- frontend/src/lib/schemas/fm-global-schemas.ts keys on the original names and marks
-- them optional, so renaming them here would drop the values silently rather than fail.
--
-- DROP first: CREATE OR REPLACE cannot change a function's return type.

DROP FUNCTION IF EXISTS public.find_sprinkler_requirements(
  character varying, character varying, integer, character varying, numeric
);

CREATE FUNCTION public.find_sprinkler_requirements(
  p_asrs_type character varying,
  p_system_type character varying,
  p_ceiling_height_ft integer,
  p_commodity_class character varying,
  p_k_factor numeric
)
RETURNS TABLE(
  table_id text,
  table_number integer,
  title text,
  ceiling_height_ft numeric,
  k_factor numeric,
  k_type text,
  sprinkler_count integer,
  pressure_psi numeric,
  pressure_bar numeric,
  sprinkler_orientation text,
  sprinkler_response text,
  special_conditions text[]
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    t.table_id,
    t.table_number,
    t.title,
    c.ceiling_height_ft,
    c.k_factor,
    c.k_factor_type,   -- returned as k_type
    c.sprinkler_count,
    c.pressure_psi,
    c.pressure_bar,
    c.orientation,     -- returned as sprinkler_orientation
    c.response_type,   -- returned as sprinkler_response
    c.special_conditions
  FROM fm_global_tables t
  JOIN fm_sprinkler_configs c ON t.table_id = c.table_id
  WHERE
    (p_asrs_type IS NULL OR t.asrs_type = p_asrs_type)
    AND (
      p_system_type IS NULL
      OR t.system_type = p_system_type
      OR t.system_type IN ('both', 'wet_or_dry')
    )
    AND (p_ceiling_height_ft IS NULL OR c.ceiling_height_ft = p_ceiling_height_ft)
    AND (p_commodity_class IS NULL OR p_commodity_class = ANY(t.commodity_types))
    AND (p_k_factor IS NULL OR c.k_factor = p_k_factor)
    AND c.sprinkler_count IS NOT NULL
  ORDER BY t.table_number, c.ceiling_height_ft, c.k_factor;
END;
$function$;
