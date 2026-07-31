-- =============================================================================
-- Unified document_chunks migration
--
-- Changes:
--   1. Add source_type column to document_chunks
--   2. Backfill source_type from document_metadata category/source
--   3. Drop overly restrictive (document_id, chunk_index) unique constraint
--   4. Migrate all Fireflies embeddings from documents → document_chunks
--      (cast vector(3072) → halfvec(3072), no re-embedding needed)
--   5. Create new search_document_chunks RPC with source_type + project filtering
--
-- Run date: 2026-03-22
-- =============================================================================

-- ─── 1. Add source_type column ──────────────────────────────────────────────

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'document';
CREATE INDEX IF NOT EXISTS idx_document_chunks_source_type
  ON document_chunks(source_type);
-- ─── 2. Backfill source_type ────────────────────────────────────────────────

UPDATE document_chunks dc
SET source_type = CASE
  WHEN dm.source = 'fireflies' THEN 'meeting_transcript'
  WHEN dm.category = 'email' THEN 'email'
  WHEN dm.category = 'teams_message' THEN 'teams_message'
  WHEN dm.source = 'microsoft_graph' THEN 'onedrive_document'
  WHEN dm.source = 'Zapier' THEN 'zapier'
  ELSE 'document'
END
FROM document_metadata dm
WHERE dc.document_id = dm.id;
-- ─── 3. Drop restrictive constraint ────────────────────────────────────────
-- chunk_id is already PK + unique. The (document_id, chunk_index) constraint
-- prevents storing multiple chunk types (summary, transcript, segment) for
-- the same meeting at chunk_index 0.

ALTER TABLE document_chunks
  DROP CONSTRAINT IF EXISTS document_chunks_document_id_chunk_index_key;
-- ─── 4. Migrate Fireflies embeddings ───────────────────────────────────────
-- documents table has 11,207 embedded Fireflies chunks at vector(3072).
-- Cast to halfvec(3072) for compatibility with document_chunks HNSW index.

-- 4a. Meeting summaries
INSERT INTO document_chunks (chunk_id, document_id, chunk_index, text, metadata, content_hash, embedding, source_type, created_at)
SELECT
  d.file_id || '__ff_' || COALESCE(d.metadata->>'doc_type', 'chunk') || '_' || COALESCE((d.metadata->>'segment_index')::text, '0') || '_' || COALESCE((d.metadata->>'chunk_index')::text, '0') || '_' || LEFT(d.id::text, 8),
  d.file_id, COALESCE((d.metadata->>'chunk_index')::int, 0), d.content,
  d.metadata || jsonb_build_object('project_id', d.project_id, 'title', d.title, 'file_date', d.file_date),
  d.metadata->>'content_hash', d.embedding::halfvec(3072), 'meeting_summary', d.created_at
FROM documents d
WHERE d.embedding IS NOT NULL AND d.source = 'fireflies' AND d.metadata->>'doc_type' = 'meeting_summary'
ON CONFLICT (chunk_id) DO NOTHING;
-- 4b. Transcript chunks
INSERT INTO document_chunks (chunk_id, document_id, chunk_index, text, metadata, content_hash, embedding, source_type, created_at)
SELECT
  d.file_id || '__ff_chunk_' || COALESCE((d.metadata->>'segment_index')::text, '0') || '_' || COALESCE((d.metadata->>'chunk_index')::text, '0') || '_' || LEFT(d.id::text, 8),
  d.file_id, COALESCE((d.metadata->>'chunk_index')::int, 0), d.content,
  d.metadata || jsonb_build_object('project_id', d.project_id, 'title', d.title, 'file_date', d.file_date),
  d.metadata->>'content_hash', d.embedding::halfvec(3072), 'meeting_transcript', d.created_at
FROM documents d
WHERE d.embedding IS NOT NULL AND d.source = 'fireflies' AND d.metadata->>'doc_type' = 'chunk'
ON CONFLICT (chunk_id) DO NOTHING;
-- 4c. Segment summaries
INSERT INTO document_chunks (chunk_id, document_id, chunk_index, text, metadata, content_hash, embedding, source_type, created_at)
SELECT
  d.file_id || '__ff_segsummary_' || (d.metadata->>'segment_index')::text || '_' || LEFT(d.id::text, 8),
  d.file_id, COALESCE((d.metadata->>'chunk_index')::int, 0), d.content,
  d.metadata || jsonb_build_object('project_id', d.project_id, 'title', d.title, 'file_date', d.file_date),
  d.metadata->>'content_hash', d.embedding::halfvec(3072), 'meeting_segment_summary', d.created_at
FROM documents d
WHERE d.embedding IS NOT NULL AND d.source = 'fireflies' AND d.metadata->>'doc_type' = 'segment_summary'
ON CONFLICT (chunk_id) DO NOTHING;
-- 4d. Section chunks + notes topics
INSERT INTO document_chunks (chunk_id, document_id, chunk_index, text, metadata, content_hash, embedding, source_type, created_at)
SELECT
  d.file_id || '__ff_' || COALESCE(d.metadata->>'doc_type', 'other') || '_' || COALESCE((d.metadata->>'segment_index')::text, '0') || '_' || LEFT(d.id::text, 8),
  d.file_id, COALESCE((d.metadata->>'chunk_index')::int, 0), d.content,
  d.metadata || jsonb_build_object('project_id', d.project_id, 'title', d.title, 'file_date', d.file_date),
  d.metadata->>'content_hash', d.embedding::halfvec(3072),
  CASE
    WHEN d.metadata->>'doc_type' LIKE 'section_%' THEN 'meeting_section'
    WHEN d.metadata->>'doc_type' = 'notes_topic' THEN 'meeting_notes'
    ELSE 'meeting_transcript'
  END,
  d.created_at
FROM documents d
WHERE d.embedding IS NOT NULL AND d.source = 'fireflies'
  AND d.metadata->>'doc_type' NOT IN ('meeting_summary', 'chunk', 'segment_summary')
ON CONFLICT (chunk_id) DO NOTHING;
-- ─── 5. Create unified search RPC ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_document_chunks(
    query_embedding  halfvec(3072),
    filter_source_types text[] DEFAULT NULL,
    filter_project_id bigint DEFAULT NULL,
    match_count      int     DEFAULT 10,
    match_threshold  float   DEFAULT 0.25
)
RETURNS TABLE (
    chunk_id        text,
    document_id     text,
    chunk_index     int,
    chunk_text      text,
    source_type     text,
    similarity      float,
    doc_title       text,
    doc_category    text,
    doc_source      text,
    doc_date        timestamptz,
    doc_project_id  bigint,
    doc_metadata    jsonb,
    doc_created_at  timestamp
)
LANGUAGE plpgsql AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;

    RETURN QUERY
    SELECT
        dc.chunk_id,
        dc.document_id,
        dc.chunk_index,
        dc.text                                              AS chunk_text,
        dc.source_type,
        (1 - (dc.embedding <=> query_embedding))::float     AS similarity,
        dm.title                                            AS doc_title,
        dm.category                                         AS doc_category,
        dm.source                                           AS doc_source,
        dm.date                                             AS doc_date,
        dm.project_id                                       AS doc_project_id,
        dc.metadata                                         AS doc_metadata,
        dm.created_at                                       AS doc_created_at
    FROM document_chunks dc
    JOIN document_metadata dm ON dc.document_id = dm.id
    WHERE
        dc.embedding IS NOT NULL
        AND (filter_source_types IS NULL OR dc.source_type = ANY(filter_source_types))
        AND (filter_project_id IS NULL OR dm.project_id = filter_project_id)
        AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION search_document_chunks(halfvec(3072), text[], bigint, int, float)
    TO anon, authenticated, service_role;
