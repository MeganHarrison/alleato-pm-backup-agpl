-- Fix the dual-system fallback in find_sprinkler_requirements.
-- TARGET: ASRS Supabase project (vqnnvpnoitqhijkztyhq) -- NOT the PM APP project.
--
-- WHY: the function's system_type filter reads
--     (p_system_type IS NULL OR t.system_type = p_system_type OR t.system_type = 'both')
-- The 'both' literal is meant to let a wet-only or dry-only query still match tables that
-- cover either system. But fm_global_tables spells that value 'wet_or_dry' on every row
-- that actually carries sprinkler configs, so the fallback never fires.
--
-- Impact: all 95 configs on the single top_loading table are spelled 'wet_or_dry', so
-- find_sprinkler_requirements('top_loading','wet',...) returned 0 -- every Top-Loading
-- enquiry got nothing, regardless of height or commodity. Measured 2026-07-20:
--     top_loading + wet        -> 0 matches
--     top_loading + wet_or_dry -> 53 matches
--
-- Both spellings are present in the column ('both' and 'wet_or_dry'), so this accepts
-- either rather than rewriting the data. Normalizing the column is a separate concern
-- and would risk the 19 live submissions' stored user_input drifting from the corpus.

CREATE OR REPLACE FUNCTION public.find_sprinkler_requirements(
  p_asrs_type text DEFAULT NULL::text,
  p_system_type text DEFAULT NULL::text,
  p_ceiling_height_ft numeric DEFAULT NULL::numeric,
  p_commodity_class text DEFAULT NULL::text,
  p_tolerance_ft numeric DEFAULT 5
)
RETURNS TABLE(
  table_id text,
  table_number integer,
  title text,
  sprinkler_count integer,
  k_factor numeric,
  pressure_psi numeric,
  special_conditions text[],
  height_match_type text
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    fmt.table_id,
    fmt.table_number,
    fmt.title,
    fsc.sprinkler_count,
    fsc.k_factor,
    fsc.pressure_psi,
    fsc.special_conditions,
    CASE
      WHEN ABS(fsc.ceiling_height_ft - p_ceiling_height_ft) <= p_tolerance_ft THEN 'exact'
      ELSE 'interpolated'
    END AS height_match_type
  FROM fm_global_tables fmt
  JOIN fm_sprinkler_configs fsc ON fmt.table_id = fsc.table_id
  WHERE
    (p_asrs_type IS NULL OR fmt.asrs_type = p_asrs_type)
    -- 'both' and 'wet_or_dry' are the two spellings of "covers either system" that
    -- exist in fm_global_tables.system_type. Accept both.
    AND (
      p_system_type IS NULL
      OR fmt.system_type = p_system_type
      OR fmt.system_type IN ('both', 'wet_or_dry')
    )
    AND (
      p_ceiling_height_ft IS NULL
      OR (fsc.ceiling_height_ft BETWEEN p_ceiling_height_ft - p_tolerance_ft
                                    AND p_ceiling_height_ft + p_tolerance_ft)
    )
    AND (p_commodity_class IS NULL OR p_commodity_class = ANY(fmt.commodity_types))
  ORDER BY
    ABS(fsc.ceiling_height_ft - COALESCE(p_ceiling_height_ft, fsc.ceiling_height_ft)),
    fmt.table_number,
    fsc.k_factor;
END;
$function$;
