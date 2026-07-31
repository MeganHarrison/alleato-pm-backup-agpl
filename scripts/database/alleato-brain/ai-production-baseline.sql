SELECT jsonb_build_object(
  'checked_at', now(),
  'columns', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'table', table_name,
        'column', column_name,
        'type', data_type
      )
      ORDER BY table_name, ordinal_position
    )
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('rag_document_metadata', 'document_chunks')
  ),
  'rag_documents', (
    SELECT jsonb_build_object(
      'total', count(*),
      'mapped_project_rows', count(*) FILTER (
        WHERE project_id IN (60, 89, 90, 756, 767)
      ),
      'business_area_metadata_rows', count(*) FILTER (
        WHERE source_metadata ? 'business_area_id'
      ),
      'dual_scope_rows', count(*) FILTER (
        WHERE project_id IN (60, 89, 90, 756, 767)
          AND source_metadata ? 'business_area_id'
      )
    )
    FROM public.rag_document_metadata
  ),
  'chunks', (
    SELECT jsonb_build_object(
      'total', count(*),
      'mapped_project_rows', count(*) FILTER (
        WHERE metadata->>'project_id' IN ('60', '89', '90', '756', '767')
      ),
      'business_area_metadata_rows', count(*) FILTER (
        WHERE metadata ? 'business_area_id'
      ),
      'dual_scope_rows', count(*) FILTER (
        WHERE metadata->>'project_id' IN ('60', '89', '90', '756', '767')
          AND metadata ? 'business_area_id'
      )
    )
    FROM public.document_chunks
  )
) AS baseline;
