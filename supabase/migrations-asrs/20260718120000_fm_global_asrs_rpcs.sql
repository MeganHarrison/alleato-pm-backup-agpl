-- FM Global / ASRS RPC functions.
-- TARGET: ASRS Supabase project (vqnnvpnoitqhijkztyhq) -- NOT the PM APP project.
-- Data was copied to the ASRS project without functions; this restores them.
-- Source of truth: extracted via pg_get_functiondef from PM APP on 2026-07-18.

CREATE OR REPLACE FUNCTION public.find_sprinkler_requirements(p_asrs_type text DEFAULT NULL::text, p_system_type text DEFAULT NULL::text, p_ceiling_height_ft numeric DEFAULT NULL::numeric, p_commodity_class text DEFAULT NULL::text, p_tolerance_ft numeric DEFAULT 5)
 RETURNS TABLE(table_id text, table_number integer, title text, sprinkler_count integer, k_factor numeric, pressure_psi numeric, special_conditions text[], height_match_type text)
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
    END as height_match_type
  FROM fm_global_tables fmt
  JOIN fm_sprinkler_configs fsc ON fmt.table_id = fsc.table_id
  WHERE
    (p_asrs_type IS NULL OR fmt.asrs_type = p_asrs_type)
    AND (p_system_type IS NULL OR fmt.system_type = p_system_type OR fmt.system_type = 'both')
    AND (p_ceiling_height_ft IS NULL OR
         (fsc.ceiling_height_ft BETWEEN p_ceiling_height_ft - p_tolerance_ft
                                   AND p_ceiling_height_ft + p_tolerance_ft))
    AND (p_commodity_class IS NULL OR p_commodity_class = ANY(fmt.commodity_types))
  ORDER BY
    ABS(fsc.ceiling_height_ft - COALESCE(p_ceiling_height_ft, fsc.ceiling_height_ft)),
    fmt.table_number;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_sprinkler_requirements(p_asrs_type character varying DEFAULT NULL::character varying, p_system_type character varying DEFAULT NULL::character varying, p_ceiling_height_ft integer DEFAULT NULL::integer, p_commodity_class character varying DEFAULT NULL::character varying, p_k_factor numeric DEFAULT NULL::numeric)
 RETURNS TABLE(table_id character varying, table_number integer, title text, ceiling_height_ft integer, k_factor numeric, k_type character varying, sprinkler_count integer, pressure_psi numeric, pressure_bar numeric, sprinkler_orientation character varying, sprinkler_response character varying, special_conditions text[])
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        t.table_id,
        t.table_number,
        t.title,
        t.ceiling_height_ft,
        t.k_factor,
        t.k_type,
        t.sprinkler_count,
        t.pressure_psi,
        t.pressure_bar,
        t.sprinkler_orientation,
        t.sprinkler_response,
        t.special_conditions
    FROM fm_global_tables t
    WHERE
        (p_asrs_type IS NULL OR t.asrs_type = p_asrs_type)
        AND (p_system_type IS NULL OR t.system_type = p_system_type)
        AND (p_ceiling_height_ft IS NULL OR t.ceiling_height_ft = p_ceiling_height_ft)
        AND (p_commodity_class IS NULL OR p_commodity_class = ANY(t.commodity_classes))
        AND (p_k_factor IS NULL OR t.k_factor = p_k_factor)
        AND t.sprinkler_count IS NOT NULL
    ORDER BY t.table_number, t.ceiling_height_ft, t.k_factor;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_asrs_figure_options()
 RETURNS TABLE(asrs_types text[], container_types text[], orientation_types text[], rack_depths text[], spacings text[])
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        ARRAY(SELECT DISTINCT asrs_type FROM asrs_figures WHERE asrs_type IS NOT NULL ORDER BY asrs_type),
        ARRAY(SELECT DISTINCT container_type FROM asrs_figures WHERE container_type IS NOT NULL ORDER BY container_type),
        ARRAY(SELECT DISTINCT orientation_type FROM asrs_figures WHERE orientation_type IS NOT NULL ORDER BY orientation_type),
        ARRAY(SELECT DISTINCT rack_row_depth FROM asrs_figures WHERE rack_row_depth IS NOT NULL ORDER BY rack_row_depth),
        ARRAY(SELECT DISTINCT max_horizontal_spacing FROM asrs_figures WHERE max_horizontal_spacing IS NOT NULL ORDER BY max_horizontal_spacing);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fm_global_references_by_topic(topic text, limit_count integer DEFAULT 20)
 RETURNS TABLE(reference_type text, reference_number text, title text, section text, asrs_relevance text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    (
        -- Get tables
        SELECT
            'table'::text as reference_type,
            t.table_id as reference_number,
            t.title,
            t.asrs_type as section,
            'High'::text as asrs_relevance
        FROM fm_global_tables t
        WHERE t.title ILIKE '%' || topic || '%'
           OR t.protection_scheme ILIKE '%' || topic || '%'
           OR t.asrs_type ILIKE '%' || topic || '%'
        LIMIT limit_count / 2
    )
    UNION ALL
    (
        -- Get figures
        SELECT
            'figure'::text as reference_type,
            'Figure ' || f.figure_number::text as reference_number,
            f.title,
            f.figure_type as section,
            'High'::text as asrs_relevance
        FROM fm_global_figures f
        WHERE f.title ILIKE '%' || topic || '%'
           OR f.clean_caption ILIKE '%' || topic || '%'
           OR f.figure_type ILIKE '%' || topic || '%'
        LIMIT limit_count / 2
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.hybrid_search_fm_global(query_embedding vector, query_text text, match_count integer DEFAULT 10, text_weight double precision DEFAULT 0.3, filter_asrs_type text DEFAULT NULL::text)
 RETURNS TABLE(vector_id uuid, source_id uuid, source_type text, content text, combined_score double precision, vector_similarity double precision, text_similarity double precision, asrs_topic text, regulation_section text, design_parameter text, metadata jsonb, table_number text, figure_number text, reference_title text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            v.id,
            v.content_id,
            v.content_type,
            v.content,
            1 - (v.embedding <=> query_embedding) as vector_score,
            v.metadata,
            CASE
                WHEN v.content_type = 'table' THEN t.asrs_type
                WHEN v.content_type = 'figure' THEN f.asrs_type
                ELSE NULL
            END as asrs_type_val,
            CASE
                WHEN v.content_type = 'table' THEN t.table_id
                WHEN v.content_type = 'figure' THEN 'Figure ' || f.figure_number::text
                ELSE NULL
            END as reference_number,
            CASE
                WHEN v.content_type = 'table' THEN t.title
                WHEN v.content_type = 'figure' THEN f.title
                ELSE NULL
            END as reference_title
        FROM fm_global_vectors v
        LEFT JOIN fm_global_tables t ON v.content_id = t.id AND v.content_type = 'table'
        LEFT JOIN fm_global_figures f ON v.content_id = f.id AND v.content_type = 'figure'
        WHERE
            (filter_asrs_type IS NULL OR
             (v.content_type = 'table' AND t.asrs_type = filter_asrs_type) OR
             (v.content_type = 'figure' AND f.asrs_type = filter_asrs_type))
        ORDER BY v.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_results AS (
        SELECT
            v.id,
            v.content_id,
            v.content_type,
            v.content,
            ts_rank(to_tsvector('english', v.content), plainto_tsquery('english', query_text)) as text_score,
            v.metadata,
            CASE
                WHEN v.content_type = 'table' THEN t.asrs_type
                WHEN v.content_type = 'figure' THEN f.asrs_type
                ELSE NULL
            END as asrs_type_val,
            CASE
                WHEN v.content_type = 'table' THEN t.table_id
                WHEN v.content_type = 'figure' THEN 'Figure ' || f.figure_number::text
                ELSE NULL
            END as reference_number,
            CASE
                WHEN v.content_type = 'table' THEN t.title
                WHEN v.content_type = 'figure' THEN f.title
                ELSE NULL
            END as reference_title
        FROM fm_global_vectors v
        LEFT JOIN fm_global_tables t ON v.content_id = t.id AND v.content_type = 'table'
        LEFT JOIN fm_global_figures f ON v.content_id = f.id AND v.content_type = 'figure'
        WHERE
            to_tsvector('english', v.content) @@ plainto_tsquery('english', query_text)
            AND (filter_asrs_type IS NULL OR
                 (v.content_type = 'table' AND t.asrs_type = filter_asrs_type) OR
                 (v.content_type = 'figure' AND f.asrs_type = filter_asrs_type))
        LIMIT match_count * 2
    ),
    combined AS (
        SELECT
            COALESCE(v.id, t.id) as vector_id,
            COALESCE(v.content_id, t.content_id) as source_id,
            COALESCE(v.content_type, t.content_type) as source_type,
            COALESCE(v.content, t.content) as content,
            COALESCE(v.vector_score, 0) * (1 - text_weight) + COALESCE(t.text_score, 0) * text_weight as score,
            COALESCE(v.vector_score, 0) as vector_similarity,
            COALESCE(t.text_score, 0) as text_similarity,
            COALESCE(v.metadata, t.metadata) as metadata,
            COALESCE(v.asrs_type_val, t.asrs_type_val) as asrs_topic,
            COALESCE(v.reference_number, t.reference_number) as reference_number,
            COALESCE(v.reference_title, t.reference_title) as reference_title,
            COALESCE(v.content_type, t.content_type) as content_type_final
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT
        c.vector_id,
        c.source_id,
        c.source_type,
        c.content,
        c.score as combined_score,
        c.vector_similarity,
        c.text_similarity,
        c.asrs_topic,
        NULL::text as regulation_section,
        NULL::text as design_parameter,
        c.metadata,
        CASE WHEN c.content_type_final = 'table' THEN c.reference_number ELSE NULL END as table_number,
        CASE WHEN c.content_type_final = 'figure' THEN c.reference_number ELSE NULL END as figure_number,
        c.reference_title
    FROM combined c
    ORDER BY c.score DESC
    LIMIT match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_fm_global_vectors(query_embedding vector, match_count integer DEFAULT 10, filter_asrs_type text DEFAULT NULL::text, filter_source_type text DEFAULT NULL::text)
 RETURNS TABLE(vector_id uuid, source_id uuid, source_type text, content text, similarity double precision, asrs_topic text, regulation_section text, design_parameter text, metadata jsonb, table_number text, figure_number text, reference_title text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT
            v.id as vector_id,
            v.content_id as source_id,
            v.content_type as source_type,
            v.content,
            1 - (v.embedding <=> query_embedding) as similarity,
            v.metadata,
            CASE
                WHEN v.content_type = 'table' THEN t.asrs_type
                WHEN v.content_type = 'figure' THEN f.asrs_type
                ELSE NULL
            END as asrs_topic,
            CASE
                WHEN v.content_type = 'table' THEN t.table_id
                WHEN v.content_type = 'figure' THEN 'Figure ' || f.figure_number::text
                ELSE NULL
            END as reference_number,
            CASE
                WHEN v.content_type = 'table' THEN t.title
                WHEN v.content_type = 'figure' THEN f.title
                ELSE NULL
            END as reference_title
        FROM fm_global_vectors v
        LEFT JOIN fm_global_tables t ON v.content_id = t.id AND v.content_type = 'table'
        LEFT JOIN fm_global_figures f ON v.content_id = f.id AND v.content_type = 'figure'
        WHERE
            (filter_source_type IS NULL OR v.content_type = filter_source_type)
            AND (filter_asrs_type IS NULL OR
                 (v.content_type = 'table' AND t.asrs_type = filter_asrs_type) OR
                 (v.content_type = 'figure' AND f.asrs_type = filter_asrs_type))
        ORDER BY v.embedding <=> query_embedding
        LIMIT match_count
    )
    SELECT
        vs.vector_id,
        vs.source_id,
        vs.source_type,
        vs.content,
        vs.similarity,
        vs.asrs_topic,
        NULL::text as regulation_section,
        NULL::text as design_parameter,
        vs.metadata,
        CASE WHEN vs.source_type = 'table' THEN vs.reference_number ELSE NULL END as table_number,
        CASE WHEN vs.source_type = 'figure' THEN vs.reference_number ELSE NULL END as figure_number,
        vs.reference_title
    FROM vector_search vs;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_asrs_figures(p_search_text text DEFAULT NULL::text, p_asrs_type character varying DEFAULT NULL::character varying, p_container_type character varying DEFAULT NULL::character varying, p_orientation_type character varying DEFAULT NULL::character varying, p_rack_depth character varying DEFAULT NULL::character varying, p_spacing character varying DEFAULT NULL::character varying)
 RETURNS TABLE(id uuid, order_number integer, figure_number character varying, name text, orientation_type character varying, asrs_type character varying, container_type character varying, rack_row_depth character varying, max_horizontal_spacing character varying, relevance_score real)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.order_number,
        f.figure_number,
        f.name,
        f.orientation_type,
        f.asrs_type,
        f.container_type,
        f.rack_row_depth,
        f.max_horizontal_spacing,
        CASE
            WHEN p_search_text IS NOT NULL THEN
                ts_rank(f.search_vector, plainto_tsquery('english', p_search_text))
            ELSE 1.0
        END as relevance_score
    FROM asrs_figures f
    WHERE
        (p_search_text IS NULL OR f.search_vector @@ plainto_tsquery('english', p_search_text))
        AND (p_asrs_type IS NULL OR f.asrs_type = p_asrs_type)
        AND (p_container_type IS NULL OR f.container_type = p_container_type)
        AND (p_orientation_type IS NULL OR f.orientation_type = p_orientation_type)
        AND (p_rack_depth IS NULL OR f.rack_row_depth = p_rack_depth)
        AND (p_spacing IS NULL OR f.max_horizontal_spacing = p_spacing)
    ORDER BY
        CASE
            WHEN p_search_text IS NOT NULL THEN
                ts_rank(f.search_vector, plainto_tsquery('english', p_search_text))
            ELSE f.order_number
        END DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_fm_global_all(query_embedding vector, query_text text, match_count integer DEFAULT 10)
 RETURNS TABLE(source_id text, source_type text, source_table text, content text, similarity double precision, title text, metadata jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH
    -- Search fm_text_chunks (document chunks with embeddings)
    chunk_results AS (
        SELECT
            c.id::text as source_id,
            c.content_type as source_type,
            'fm_text_chunks'::text as source_table,
            c.raw_text as content,
            1 - (c.embedding <=> query_embedding) as similarity,
            COALESCE(c.chunk_summary, CONCAT('Chunk from ', c.doc_id)) as title,
            jsonb_build_object(
                'doc_id', c.doc_id,
                'page_number', c.page_number,
                'section_path', c.section_path,
                'related_tables', c.related_tables,
                'related_figures', c.related_figures,
                'topics', c.topics
            ) as metadata
        FROM fm_text_chunks c
        WHERE c.embedding IS NOT NULL
    ),

    -- Search fm_table_vectors (table embeddings)
    table_results AS (
        SELECT
            tv.id::text as source_id,
            tv.content_type as source_type,
            'fm_table_vectors'::text as source_table,
            tv.content_text as content,
            1 - (tv.embedding <=> query_embedding) as similarity,
            CONCAT('Table ', tv.table_id) as title,
            tv.metadata
        FROM fm_table_vectors tv
        WHERE tv.embedding IS NOT NULL
    ),

    -- Search fm_global_vectors (if it has data)
    vector_results AS (
        SELECT
            v.id::text as source_id,
            v.content_type as source_type,
            'fm_global_vectors'::text as source_table,
            v.content,
            1 - (v.embedding <=> query_embedding) as similarity,
            'FM Global Vector' as title,
            v.metadata
        FROM fm_global_vectors v
        WHERE v.embedding IS NOT NULL
    ),

    -- Combine all results
    all_results AS (
        SELECT * FROM chunk_results
        UNION ALL
        SELECT * FROM table_results
        UNION ALL
        SELECT * FROM vector_results
    )

    SELECT * FROM all_results
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$function$
;
