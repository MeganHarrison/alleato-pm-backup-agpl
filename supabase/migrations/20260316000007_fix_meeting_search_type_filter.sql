-- Fix: full_text_search_meetings was filtering only type='meeting_transcript'
-- but the meetings page stores records as type='meeting'.
-- This mismatch caused the AI to be unable to find meetings visible on the page.

CREATE OR REPLACE FUNCTION public.full_text_search_meetings(
  search_query text,
  match_count integer DEFAULT 5
)
RETURNS TABLE(
  id text,
  title text,
  content text,
  participants text,
  date timestamp without time zone,
  category text,
  rank real
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dm.id,
    dm.title,
    dm.content,
    dm.participants,
    dm.date,
    dm.category,
    ts_rank(
      to_tsvector('english', COALESCE(dm.content, '') || ' ' || COALESCE(dm.title, '')),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM document_metadata dm
  WHERE dm.type IN ('meeting', 'meeting_transcript')
    AND (
      to_tsvector('english', COALESCE(dm.content, '') || ' ' || COALESCE(dm.title, ''))
      @@ plainto_tsquery('english', search_query)
    )
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;
COMMENT ON FUNCTION public.full_text_search_meetings(text, integer) IS
  'Full-text search across meeting content and titles. Covers both type=''meeting'' and type=''meeting_transcript''.';
