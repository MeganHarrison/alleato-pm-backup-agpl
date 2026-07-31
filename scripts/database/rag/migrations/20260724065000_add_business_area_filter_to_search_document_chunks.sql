-- Add exact Alleato Brain Business Area filtering to the canonical AI Database
-- search RPC. Project and Business Area are typed, mutually-exclusive scopes.
--
-- Target: AI Database (fqcvmfqldlewvbsuxdvz), not the PM APP database.

BEGIN;

-- A null JSON value is not a Business Area label. Remove the key so legacy
-- project chunks follow the existing unscoped/project authorization path
-- instead of being rejected as malformed branch data.
UPDATE public.document_chunks
SET metadata = metadata - 'business_area_id'
WHERE metadata ? 'business_area_id'
  AND jsonb_typeof(metadata -> 'business_area_id') = 'null';

DROP FUNCTION IF EXISTS public.search_document_chunks(
  halfvec,
  text[],
  bigint,
  integer,
  double precision,
  text,
  text,
  boolean,
  text,
  text
);

CREATE OR REPLACE FUNCTION public.search_document_chunks(
  query_embedding halfvec,
  filter_source_types text[] DEFAULT NULL::text[],
  filter_project_id bigint DEFAULT NULL::bigint,
  match_count integer DEFAULT 10,
  match_threshold double precision DEFAULT 0.25,
  ranking_mode text DEFAULT 'vector'::text,
  query_text text DEFAULT NULL::text,
  telemetry_enabled boolean DEFAULT false,
  query_signature text DEFAULT NULL::text,
  trace_id text DEFAULT NULL::text,
  filter_business_area_id bigint DEFAULT NULL::bigint
)
RETURNS TABLE(
  chunk_id text,
  document_id text,
  chunk_index integer,
  chunk_text text,
  source_type text,
  similarity double precision,
  vector_score double precision,
  text_score double precision,
  recall_score double precision,
  recency_score double precision,
  hybrid_score double precision,
  ranking_mode_used text,
  score_components jsonb,
  doc_title text,
  doc_category text,
  doc_source text,
  doc_date timestamp with time zone,
  doc_project_id bigint,
  doc_business_area_id bigint,
  doc_metadata jsonb,
  doc_created_at timestamp without time zone
)
LANGUAGE plpgsql
AS $function$
DECLARE
  normalized_mode text := lower(coalesce(ranking_mode, 'vector'));
  use_hybrid boolean;
  tsq tsquery;
  telemetry_mode text;
BEGIN
  IF match_count <= 0 THEN
    RAISE EXCEPTION 'match_count must be positive';
  END IF;

  IF filter_project_id IS NOT NULL
     AND filter_business_area_id IS NOT NULL THEN
    RAISE EXCEPTION
      'search_document_chunks accepts project scope XOR Business Area scope'
      USING ERRCODE = '22023';
  END IF;

  IF filter_business_area_id IS NOT NULL
     AND filter_business_area_id <= 0 THEN
    RAISE EXCEPTION
      'filter_business_area_id must be positive'
      USING ERRCODE = '22023';
  END IF;

  IF normalized_mode NOT IN ('vector', 'hybrid') THEN
    RAISE EXCEPTION 'ranking_mode must be vector or hybrid, got %', ranking_mode;
  END IF;

  use_hybrid := normalized_mode = 'hybrid';
  telemetry_mode := CASE
    WHEN use_hybrid AND nullif(trim(coalesce(query_text, '')), '') IS NULL
      THEN 'degraded_hybrid'
    WHEN use_hybrid THEN 'hybrid'
    ELSE 'vector'
  END;

  IF nullif(trim(coalesce(query_text, '')), '') IS NOT NULL THEN
    tsq := websearch_to_tsquery('english', query_text);
  END IF;

  SET LOCAL hnsw.ef_search = 100;
  SET LOCAL ivfflat.probes = 4;

  CREATE TEMPORARY TABLE pg_temp.search_document_chunks_ranked
  ON COMMIT DROP AS
  WITH vector_candidates AS (
    SELECT
      dc.chunk_id,
      dc.document_id,
      dc.chunk_index,
      dc.text AS chunk_text,
      dc.source_type,
      (1 - (dc.embedding <=> query_embedding))::float AS vector_score,
      dc.metadata ->> 'title' AS doc_title,
      coalesce(dc.metadata ->> 'category', dc.metadata ->> 'doc_type')
        AS doc_category,
      dc.metadata ->> 'source' AS doc_source,
      CASE
        WHEN coalesce(dc.metadata ->> 'file_date', dc.metadata ->> 'date')
          ~ '^\d{4}-\d{2}-\d{2}'
          THEN (
            coalesce(dc.metadata ->> 'file_date', dc.metadata ->> 'date')
          )::timestamptz
        ELSE NULL::timestamptz
      END AS doc_date,
      nullif(dc.metadata ->> 'project_id', '')::bigint AS doc_project_id,
      nullif(dc.metadata ->> 'business_area_id', '')::bigint
        AS doc_business_area_id,
      dc.metadata AS doc_metadata,
      dc.created_at::timestamp AS doc_created_at
    FROM public.document_chunks dc
    WHERE
      dc.embedding IS NOT NULL
      AND (
        filter_source_types IS NULL
        OR dc.source_type = ANY(filter_source_types)
      )
      AND (
        filter_project_id IS NULL
        OR nullif(dc.metadata ->> 'project_id', '')::bigint = filter_project_id
      )
      AND (
        filter_business_area_id IS NULL
        OR nullif(dc.metadata ->> 'business_area_id', '')::bigint
          = filter_business_area_id
      )
      AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT greatest(match_count * 4, match_count)
  ),
  scored AS (
    SELECT
      vc.*,
      CASE
        WHEN tsq IS NULL THEN NULL::double precision
        ELSE (
          ts_rank_cd(
            to_tsvector(
              'english',
              coalesce(vc.doc_title, '') || ' ' || coalesce(vc.chunk_text, '')
            ),
            tsq
          )::double precision
        )
      END AS raw_text_rank,
      coalesce(stats.recall_count, 0) AS recall_count,
      stats.last_recalled_at,
      coalesce(vc.doc_date, vc.doc_created_at::timestamptz) AS source_time
    FROM vector_candidates vc
    LEFT JOIN public.document_chunk_retrieval_stats stats
      ON stats.chunk_id = vc.chunk_id
  ),
  normalized AS (
    SELECT
      scored.*,
      CASE
        WHEN raw_text_rank IS NULL THEN NULL::double precision
        ELSE raw_text_rank / (1 + raw_text_rank)
      END AS text_score,
      least(
        1,
        ln(1 + greatest(recall_count, 0)) / ln(11)
      )::double precision AS recall_score,
      greatest(
        0.1,
        exp(
          -greatest(
            0,
            extract(
              epoch FROM (
                now() - coalesce(source_time, now())
              )
            ) / 86400
          ) / 180
        )
      )::double precision AS recency_score
    FROM scored
  )
  SELECT
    normalized.chunk_id,
    normalized.document_id,
    normalized.chunk_index,
    normalized.chunk_text,
    normalized.source_type,
    normalized.vector_score AS similarity,
    normalized.vector_score,
    normalized.text_score,
    normalized.recall_score,
    normalized.recency_score,
    CASE
      WHEN use_hybrid AND normalized.text_score IS NOT NULL THEN
        (
          normalized.vector_score * 0.65
          + normalized.text_score * 0.20
          + normalized.recall_score * 0.10
          + normalized.recency_score * 0.05
        )::double precision
      ELSE normalized.vector_score
    END AS hybrid_score,
    CASE
      WHEN use_hybrid AND normalized.text_score IS NULL THEN 'degraded_hybrid'
      WHEN use_hybrid THEN 'hybrid'
      ELSE 'vector'
    END AS ranking_mode_used,
    jsonb_build_object(
      'vectorScore', normalized.vector_score,
      'textScore', normalized.text_score,
      'recallScore', normalized.recall_score,
      'recencyScore', normalized.recency_score,
      'recallCount', normalized.recall_count,
      'lastRecalledAt', normalized.last_recalled_at,
      'weights', jsonb_build_object(
        'vector', CASE WHEN use_hybrid THEN 0.65 ELSE 1 END,
        'text', CASE WHEN use_hybrid THEN 0.20 ELSE 0 END,
        'recall', CASE WHEN use_hybrid THEN 0.10 ELSE 0 END,
        'recency', CASE WHEN use_hybrid THEN 0.05 ELSE 0 END
      )
    ) AS score_components,
    normalized.doc_title,
    normalized.doc_category,
    normalized.doc_source,
    normalized.doc_date,
    normalized.doc_project_id,
    normalized.doc_business_area_id,
    normalized.doc_metadata,
    normalized.doc_created_at
  FROM normalized
  ORDER BY
    CASE
      WHEN use_hybrid AND normalized.text_score IS NOT NULL THEN
        (
          normalized.vector_score * 0.65
          + normalized.text_score * 0.20
          + normalized.recall_score * 0.10
          + normalized.recency_score * 0.05
        )
      ELSE normalized.vector_score
    END DESC
  LIMIT match_count;

  IF telemetry_enabled THEN
    INSERT INTO public.document_chunk_retrieval_telemetry (
      chunk_id,
      retrieval_date,
      retrieval_mode,
      source_type,
      project_id,
      recall_count,
      first_recalled_at,
      last_recalled_at,
      last_query_signature,
      last_trace_id,
      metadata
    )
    SELECT
      r.chunk_id,
      (now() AT TIME ZONE 'UTC')::date,
      telemetry_mode,
      r.source_type,
      r.doc_project_id,
      1,
      now(),
      now(),
      nullif(query_signature, ''),
      nullif(trace_id, ''),
      jsonb_build_object(
        'filterSourceTypes', filter_source_types,
        'filterProjectId', filter_project_id,
        'filterBusinessAreaId', filter_business_area_id,
        'matchThreshold', match_threshold
      )
    FROM pg_temp.search_document_chunks_ranked r
    ON CONFLICT
      ON CONSTRAINT document_chunk_retrieval_telemetry_bucket_key
    DO UPDATE SET
      recall_count =
        public.document_chunk_retrieval_telemetry.recall_count + 1,
      last_recalled_at = excluded.last_recalled_at,
      last_query_signature = excluded.last_query_signature,
      last_trace_id = excluded.last_trace_id,
      updated_at = now(),
      metadata =
        public.document_chunk_retrieval_telemetry.metadata
        || excluded.metadata;
  END IF;

  RETURN QUERY
  SELECT * FROM pg_temp.search_document_chunks_ranked;
END;
$function$;

REVOKE EXECUTE
  ON FUNCTION public.search_document_chunks(
    halfvec,
    text[],
    bigint,
    integer,
    double precision,
    text,
    text,
    boolean,
    text,
    text,
    bigint
  )
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.search_document_chunks(
    halfvec,
    text[],
    bigint,
    integer,
    double precision,
    text,
    text,
    boolean,
    text,
    text,
    bigint
  )
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
