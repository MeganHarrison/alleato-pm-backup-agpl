-- Fix full_text_search_meetings: date type mismatch and filter scope
-- 1. Return timestamptz (matches actual column type) instead of timestamp
-- 2. Expand filter to include all Fireflies meetings (source='fireflies'),
--    not just type='meeting'|'meeting_transcript' which missed 'Interview' type
-- 3. Also search summary/overview fields (not just content/title) for better recall

-- Must drop first because return type changed (timestamp -> timestamptz)
DROP FUNCTION IF EXISTS public.full_text_search_meetings(text, integer);
CREATE OR REPLACE FUNCTION public.full_text_search_meetings(
  search_query text,
  match_count integer DEFAULT 5
)
RETURNS TABLE(
  id text,
  title text,
  content text,
  participants text,
  date timestamptz,
  category text,
  rank real
)
LANGUAGE plpgsql
AS $function$
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
      to_tsvector('english',
        COALESCE(dm.content, '') || ' ' ||
        COALESCE(dm.title, '') || ' ' ||
        COALESCE(dm.summary, '') || ' ' ||
        COALESCE(dm.overview, '')
      ),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM document_metadata dm
  WHERE (dm.source = 'fireflies' OR dm.type IN ('meeting', 'meeting_transcript'))
    AND (
      to_tsvector('english',
        COALESCE(dm.content, '') || ' ' ||
        COALESCE(dm.title, '') || ' ' ||
        COALESCE(dm.summary, '') || ' ' ||
        COALESCE(dm.overview, '')
      )
      @@ plainto_tsquery('english', search_query)
    )
  ORDER BY rank DESC
  LIMIT match_count;
END;
$function$;
