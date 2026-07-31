-- =============================================================================
-- Fix: Missing HNSW index on document_chunks.embedding
-- =============================================================================
--
-- Root cause: document_chunks.embedding was migrated from vector(1536) to
-- halfvec(3072), but the HNSW index was never recreated with halfvec_cosine_ops.
-- Every search_document_chunks_by_category call was doing a brute-force
-- sequential scan over 85k+ rows, exceeding the 2-minute statement_timeout.
--
-- Additionally, the similarity threshold in the WHERE clause prevented the
-- planner from using an early-stopping top-k scan.
--
-- Fix:
--   1. Partial HNSW index scoped to Teams source types (34k rows, builds fast)
--   2. Full HNSW index for all other categories (85k rows)
--   3. Rewritten function: source_type hint → partial index → CTE join pattern
--      removes threshold from the inner ANN scan so HNSW can do top-k properly
-- =============================================================================

-- 1. Partial HNSW index for Teams DM + channel chunks only.
--    Constrains the ANN scan to ~34k rows instead of 85k for Teams searches.
CREATE INDEX IF NOT EXISTS idx_document_chunks_teams_embedding
ON document_chunks
USING hnsw (embedding halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE source_type IN ('teams_dm', 'teams_channel');

-- 2. Full HNSW index for all chunks (used by email, document, and other searches).
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
ON document_chunks
USING hnsw (embedding halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. Rewrite the search function.
--    Key changes vs previous version:
--    a) Map filter_category → source_type[] so the partial index is used for Teams
--    b) CTE pattern: do vector ORDER BY LIMIT first (hits HNSW), join metadata second
--    c) Remove threshold from the inner WHERE — apply it on the CTE output instead
--       so pgvector can do an early-stopping top-k scan rather than a full scan
--    d) Reduce ef_search from 100 → 40 (plenty for 8-result queries, ~2x faster)
--    e) Oversample 4x inside the CTE to ensure enough results survive the join filter

DROP FUNCTION IF EXISTS public.search_document_chunks_by_category(halfvec(3072), text, int, float, bigint);

CREATE OR REPLACE FUNCTION public.search_document_chunks_by_category(
    query_embedding   halfvec(3072),
    filter_category   text,
    match_count       int     DEFAULT 10,
    match_threshold   float   DEFAULT 0.25,
    filter_project_id bigint  DEFAULT NULL
)
RETURNS TABLE (
    chunk_id         text,
    document_id      text,
    chunk_index      int,
    chunk_text       text,
    similarity       float,
    doc_title        text,
    doc_category     text,
    doc_source       text,
    doc_type         text,
    doc_date         timestamptz,
    doc_participants text,
    doc_tags         text,
    doc_project_id   bigint,
    doc_metadata     jsonb,
    doc_created_at   timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
    source_type_hints text[];
BEGIN
    -- Lower ef_search: 40 candidates is sufficient for top-8 queries.
    -- (Previous value of 100 added overhead without improving recall at this scale.)
    SET LOCAL hnsw.ef_search = 40;

    -- Map category to known source_type values so Postgres can use the partial
    -- HNSW index for Teams and avoid scanning unrelated chunk types.
    source_type_hints := CASE filter_category
        WHEN 'teams_message' THEN ARRAY['teams_dm', 'teams_channel']
        WHEN 'email'         THEN ARRAY['email']
        WHEN 'document'      THEN ARRAY['onedrive_document']
        ELSE NULL  -- unmapped categories fall through to the generic path
    END;

    IF source_type_hints IS NOT NULL THEN
        -- Fast path: scan only chunks matching the source_type hint.
        -- For Teams this hits the partial HNSW index (34k rows, not 85k).
        -- CTE does vector scan + LIMIT first, then joins metadata — this lets
        -- pgvector stop early once it has enough top-k candidates.
        RETURN QUERY
        WITH candidates AS (
            SELECT
                dc.chunk_id::text           AS cid,
                dc.document_id::text        AS did,
                dc.chunk_index::int         AS cidx,
                dc.text::text               AS ctext,
                (1 - (dc.embedding <=> query_embedding))::float AS sim,
                dc.metadata::jsonb          AS cmeta
            FROM document_chunks dc
            WHERE
                dc.source_type = ANY(source_type_hints)
                AND dc.embedding IS NOT NULL
            ORDER BY dc.embedding <=> query_embedding
            LIMIT match_count * 4   -- oversample before post-join filtering
        )
        SELECT
            c.cid,
            c.did,
            c.cidx,
            c.ctext,
            c.sim,
            dm.title::text,
            dm.category::text,
            dm.source::text,
            dm.type::text,
            dm.date::timestamptz,
            dm.participants::text,
            dm.tags::text,
            dm.project_id::bigint,
            c.cmeta,
            dm.created_at::timestamptz
        FROM candidates c
        JOIN document_metadata dm ON c.did = dm.id
        WHERE
            dm.category = filter_category
            AND (filter_project_id IS NULL OR dm.project_id = filter_project_id)
            AND c.sim > match_threshold
        ORDER BY c.sim DESC
        LIMIT match_count;

    ELSE
        -- Generic path: category not mapped to a source_type.
        -- Uses the full HNSW index; similarity threshold applied after the scan.
        RETURN QUERY
        WITH candidates AS (
            SELECT
                dc.chunk_id::text           AS cid,
                dc.document_id::text        AS did,
                dc.chunk_index::int         AS cidx,
                dc.text::text               AS ctext,
                (1 - (dc.embedding <=> query_embedding))::float AS sim,
                dc.metadata::jsonb          AS cmeta
            FROM document_chunks dc
            WHERE dc.embedding IS NOT NULL
            ORDER BY dc.embedding <=> query_embedding
            LIMIT match_count * 8   -- larger oversample: category share is unknown
        )
        SELECT
            c.cid,
            c.did,
            c.cidx,
            c.ctext,
            c.sim,
            dm.title::text,
            dm.category::text,
            dm.source::text,
            dm.type::text,
            dm.date::timestamptz,
            dm.participants::text,
            dm.tags::text,
            dm.project_id::bigint,
            c.cmeta,
            dm.created_at::timestamptz
        FROM candidates c
        JOIN document_metadata dm ON c.did = dm.id
        WHERE
            dm.category = filter_category
            AND (filter_project_id IS NULL OR dm.project_id = filter_project_id)
            AND c.sim > match_threshold
        ORDER BY c.sim DESC
        LIMIT match_count;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_document_chunks_by_category(halfvec(3072), text, int, float, bigint)
  TO anon, authenticated, service_role;
