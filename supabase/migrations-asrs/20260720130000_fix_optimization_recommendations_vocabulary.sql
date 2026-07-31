-- Normalize generate_optimization_recommendations onto the corpus vocabulary.
-- TARGET: ASRS Supabase project (vqnnvpnoitqhijkztyhq) -- NOT the PM APP project.
--
-- WHY: this function guards three of its recommendation branches on values that match
-- neither the form nor fm_global_tables. Measured 2026-07-20, container_type alone had
-- three incompatible spellings in play:
--
--   submitted by users     "Open-Top"              (fm_form_submissions.user_input)
--   stored in the corpus   "Open-Top Combustible"  (fm_global_tables.container_type)
--   compared in this RPC   "open_top_combustible"
--
-- and asrs_type had a fourth spelling here ('mini-load', hyphenated) distinct from both
-- the form's 'Mini-Load' and the corpus's 'mini_load'. Every branch behind those two
-- predicates was dead code -- the function returned only the height-based recommendation,
-- silently, with no error to signal the rest never ran.
--
-- fm_global_tables is the source of truth, so the comparisons move to its vocabulary.
-- The application maps form labels -> corpus tokens in
-- frontend/src/lib/schemas/fm-global-vocabulary.ts before calling.
--
-- Only the predicates change. Recommendation text, savings figures, priorities, and
-- effort ratings are preserved verbatim from PM APP.

CREATE OR REPLACE FUNCTION public.generate_optimization_recommendations(project_data jsonb)
RETURNS TABLE(
  recommendation text,
  savings_potential numeric,
  priority character varying,
  implementation_effort character varying,
  technical_details jsonb
)
LANGUAGE plpgsql
AS $function$
DECLARE
    storage_height DECIMAL;
    container_type TEXT;
    asrs_type TEXT;
    system_type TEXT;
    rack_row_depth DECIMAL;
    commodity_class TEXT;
BEGIN
    -- Extract key parameters from project_data
    storage_height := COALESCE((project_data->>'storage_height_ft')::DECIMAL, 0);
    container_type := project_data->>'container_type';
    asrs_type := project_data->>'asrs_type';
    system_type := project_data->>'system_type';
    rack_row_depth := COALESCE((project_data->>'rack_row_depth_ft')::DECIMAL, 0);
    commodity_class := project_data->>'commodity_class';

    -- Storage height optimization
    IF storage_height > 20 THEN
        RETURN QUERY SELECT
            'CRITICAL: Reduce storage height to ≤20 ft to avoid enhanced protection requirements. This eliminates need for higher pressure sprinklers and additional in-rack protection.'::TEXT,
            125000.00::DECIMAL,
            'Critical'::VARCHAR,
            'Medium'::VARCHAR,
            jsonb_build_object(
                'current_height', storage_height,
                'target_height', 20,
                'reduction_needed', storage_height - 20
            );
    END IF;

    -- Container type optimization.
    -- Corpus vocabulary: 'Open-Top Combustible' / 'Closed-Top Combustible' / 'Direct on Rails'.
    IF container_type = 'Open-Top Combustible' AND asrs_type = 'mini_load' THEN
        RETURN QUERY SELECT
            'Switch to closed-top containers to reduce sprinkler density requirements and eliminate in-rack sprinkler needs.'::TEXT,
            75000.00::DECIMAL,
            'High'::VARCHAR,
            'Low'::VARCHAR,
            jsonb_build_object(
                'current_container', container_type,
                'recommended_container', 'Closed-Top Combustible'
            );
    END IF;

    -- Rack depth optimization
    IF rack_row_depth > 6 AND asrs_type = 'mini_load' THEN
        RETURN QUERY SELECT
            'Reduce rack row depth to ≤6 ft to qualify for simplified protection schemes.'::TEXT,
            45000.00::DECIMAL,
            'Medium'::VARCHAR,
            'High'::VARCHAR,
            jsonb_build_object(
                'current_depth', rack_row_depth,
                'target_depth', 6
            );
    END IF;

    -- System type optimization
    IF system_type = 'dry' AND (project_data->>'building_heated')::BOOLEAN = true THEN
        RETURN QUERY SELECT
            'Convert to wet system since building is heated. Wet systems require fewer sprinklers and lower pressures.'::TEXT,
            35000.00::DECIMAL,
            'High'::VARCHAR,
            'Medium'::VARCHAR,
            jsonb_build_object(
                'current_system', system_type,
                'recommended_system', 'wet'
            );
    END IF;

    RETURN;
END;
$function$;
