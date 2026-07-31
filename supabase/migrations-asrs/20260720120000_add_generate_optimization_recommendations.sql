-- generate_optimization_recommendations: the 9th FM Global RPC.
-- TARGET: ASRS Supabase project (vqnnvpnoitqhijkztyhq) -- NOT the PM APP project.
-- Missed by the first RPC migration because the survey recorded it under the wrong
-- name (get_fm_optimization_suggestions). actions.ts calls the real name at line 315.
-- Extracted verbatim from PM APP via pg_get_functiondef on 2026-07-20.

CREATE OR REPLACE FUNCTION public.generate_optimization_recommendations(project_data jsonb)
 RETURNS TABLE(recommendation text, savings_potential numeric, priority character varying, implementation_effort character varying, technical_details jsonb)
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

    -- Rule 1: Critical Height Threshold (20 ft)
    IF storage_height > 20 THEN
        RETURN QUERY SELECT
            'CRITICAL: Reduce storage height to ≤20 ft to avoid enhanced protection requirements. This eliminates need for higher pressure sprinklers and additional in-rack protection.'::TEXT,
            125000.00::DECIMAL,
            'Critical'::VARCHAR,
            'Moderate'::VARCHAR,
            jsonb_build_object(
                'current_height', storage_height,
                'recommended_height', 20,
                'protection_reduction', 'Enhanced ceiling protection avoided',
                'table_reference', 'Multiple tables have 20ft thresholds'
            );
    END IF;

    -- Rule 2: Container Type Optimization (Biggest Impact)
    IF container_type = 'open_top_combustible' AND asrs_type = 'mini-load' THEN
        RETURN QUERY SELECT
            'MAJOR SAVINGS: Switch to closed-top containers to eliminate all in-rack sprinkler requirements. This is typically the highest impact change.'::TEXT,
            200000.00::DECIMAL,
            'Critical'::VARCHAR,
            'Minimal'::VARCHAR,
            jsonb_build_object(
                'current_protection', 'Ceiling + In-rack sprinklers required',
                'new_protection', 'Ceiling-only protection sufficient',
                'table_reference', 'Tables 38-42 show in-rack requirements eliminated'
            );
    END IF;

    -- Rule 3: Rack Row Depth Optimization
    IF rack_row_depth > 6 AND asrs_type = 'mini-load' THEN
        RETURN QUERY SELECT
            'Reduce rack row depth to ≤6 ft to lower sprinkler pressure requirements and improve water penetration.'::TEXT,
            45000.00::DECIMAL,
            'High'::VARCHAR,
            'Significant'::VARCHAR,
            jsonb_build_object(
                'current_depth', rack_row_depth,
                'recommended_depth', 6,
                'impact', 'Reduced sprinkler pressures and densities'
            );
    END IF;

    -- Rule 4: System Type Optimization
    IF system_type = 'dry' AND (project_data->>'building_heated')::BOOLEAN = true THEN
        RETURN QUERY SELECT
            'Switch to wet system to reduce sprinkler count requirements (typically 15-25% fewer sprinklers needed).'::TEXT,
            60000.00::DECIMAL,
            'Medium'::VARCHAR,
            'Moderate'::VARCHAR,
            jsonb_build_object(
                'reasoning', 'Heated building allows wet system',
                'benefit', 'Lower sprinkler densities in wet system tables',
                'water_delivery_improvement', 'Faster response time'
            );
    END IF;

    -- Rule 5: Commodity Classification Benefits
    IF commodity_class IN ('class_4', 'cartoned_unexpanded_plastic') AND storage_height <= 15 THEN
        RETURN QUERY SELECT
            'Consider reclassifying commodity or improving packaging to Class 1-3 for significant protection reductions.'::TEXT,
            85000.00::DECIMAL,
            'Medium'::VARCHAR,
            'Minimal'::VARCHAR,
            jsonb_build_object(
                'current_class', commodity_class,
                'benefit', 'Class 1-3 commodities have much lower protection requirements',
                'table_comparison', 'Compare Tables 4-5 vs Tables 6-7'
            );
    END IF;

    RETURN;
END;
$function$
;
