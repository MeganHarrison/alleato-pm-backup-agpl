-- Improve document_metadata.project_id auto-assignment for Graph + meeting ingestions.
-- Uses project name, client name, aliases, and participant/context matches.

CREATE OR REPLACE FUNCTION public.set_project_id_from_title()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  combined_title TEXT := lower(COALESCE(NEW.title, ''));
  combined_content TEXT := lower(COALESCE(NEW.content, ''));
  combined_participants TEXT := lower(COALESCE(NEW.participants, '') || ' ' || COALESCE(NEW.participants_array::text, ''));
  best_project_id INTEGER;
BEGIN
  -- Never overwrite explicit assignments.
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Fast exit if no usable signal.
  IF combined_title = '' AND combined_content = '' AND combined_participants = '' THEN
    RETURN NEW;
  END IF;

  WITH project_scores AS (
    SELECT
      p.id,
      (
        -- Title signal (highest confidence).
        CASE
          WHEN p.name IS NOT NULL AND combined_title LIKE '%' || lower(p.name) || '%' THEN 10
          ELSE 0
        END
        +
        CASE
          WHEN p.client IS NOT NULL AND combined_title LIKE '%' || lower(p.client) || '%' THEN 7
          ELSE 0
        END
        +
        COALESCE((
          SELECT COUNT(*) * 6
          FROM unnest(COALESCE(p.aliases, ARRAY[]::TEXT[])) alias
          WHERE alias <> ''
            AND combined_title ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\\1', 'g') || '(\\W|$)')
        ), 0)
        +
        -- Content signal.
        CASE
          WHEN p.name IS NOT NULL AND combined_content LIKE '%' || lower(p.name) || '%' THEN 4
          ELSE 0
        END
        +
        CASE
          WHEN p.client IS NOT NULL AND combined_content LIKE '%' || lower(p.client) || '%' THEN 3
          ELSE 0
        END
        +
        COALESCE((
          SELECT COUNT(*) * 3
          FROM unnest(COALESCE(p.aliases, ARRAY[]::TEXT[])) alias
          WHERE alias <> ''
            AND combined_content ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\\1', 'g') || '(\\W|$)')
        ), 0)
        +
        -- Participant signal.
        CASE
          WHEN p.client IS NOT NULL AND combined_participants LIKE '%' || lower(p.client) || '%' THEN 2
          ELSE 0
        END
        +
        COALESCE((
          SELECT COUNT(*) * 2
          FROM unnest(COALESCE(p.aliases, ARRAY[]::TEXT[])) alias
          WHERE alias <> ''
            AND combined_participants ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\\1', 'g') || '(\\W|$)')
        ), 0)
      ) AS score
    FROM public.projects p
    WHERE COALESCE(p.archived, FALSE) = FALSE
  )
  SELECT id
  INTO best_project_id
  FROM project_scores
  WHERE score >= 6
  ORDER BY score DESC, id ASC
  LIMIT 1;

  IF best_project_id IS NOT NULL THEN
    NEW.project_id := best_project_id;
  END IF;

  RETURN NEW;
END;
$$;
