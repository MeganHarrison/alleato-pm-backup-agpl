-- Add project_number as a first-class signal for communication project assignment.
-- The previous trigger considered project name/client/aliases but missed emails,
-- Teams docs, and transcripts that only named the job by number.

set statement_timeout = 0;
set lock_timeout = '5min';

create or replace function public.set_project_id_from_title()
returns trigger
language plpgsql
as $$
declare
  combined_title text := lower(coalesce(new.title, ''));
  combined_content text := lower(
    coalesce(new.content, '') || ' ' ||
    coalesce(new.summary, '') || ' ' ||
    coalesce(new.overview, '') || ' ' ||
    coalesce(new.tags, '') || ' ' ||
    coalesce(new.project, '')
  );
  combined_participants text := lower(
    coalesce(new.participants, '') || ' ' ||
    coalesce(new.participants_array::text, '')
  );
  best_project_id integer;
begin
  -- Never overwrite explicit assignments.
  if new.project_id is not null then
    return new;
  end if;

  if combined_title = '' and combined_content = '' and combined_participants = '' then
    return new;
  end if;

  with project_scores as (
    select
      p.id,
      (
        -- Project number is a direct business identifier. Use token matching
        -- only; compact number matching is review-only because it can collide
        -- with dates, ids, or invoice numbers.
        case
          when p.project_number is not null
            and p.project_number <> ''
            and combined_title ~* ('(^|\\W)' || regexp_replace(p.project_number, '([\\W])', '\\\1', 'g') || '(\\W|$)')
          then 12
          else 0
        end
        +
        case
          when p.project_number is not null
            and p.project_number <> ''
            and combined_content ~* ('(^|\\W)' || regexp_replace(p.project_number, '([\\W])', '\\\1', 'g') || '(\\W|$)')
          then 8
          else 0
        end
        +
        case
          when p.name is not null and combined_title like '%' || lower(p.name) || '%' then 10
          else 0
        end
        +
        case
          when p.client is not null and combined_title like '%' || lower(p.client) || '%' then 7
          else 0
        end
        +
        coalesce((
          select count(*) * 6
          from unnest(coalesce(p.aliases, array[]::text[])) alias
          where alias <> ''
            and combined_title ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\\1', 'g') || '(\\W|$)')
        ), 0)
        +
        case
          when p.name is not null and combined_content like '%' || lower(p.name) || '%' then 4
          else 0
        end
        +
        case
          when p.client is not null and combined_content like '%' || lower(p.client) || '%' then 3
          else 0
        end
        +
        coalesce((
          select count(*) * 3
          from unnest(coalesce(p.aliases, array[]::text[])) alias
          where alias <> ''
            and combined_content ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\\1', 'g') || '(\\W|$)')
        ), 0)
        +
        case
          when p.client is not null and combined_participants like '%' || lower(p.client) || '%' then 2
          else 0
        end
        +
        coalesce((
          select count(*) * 2
          from unnest(coalesce(p.aliases, array[]::text[])) alias
          where alias <> ''
            and combined_participants ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\\1', 'g') || '(\\W|$)')
        ), 0)
      ) as score
    from public.projects p
    where coalesce(p.archived, false) = false
  )
  select id
  into best_project_id
  from project_scores
  where score >= 6
  order by score desc, id asc
  limit 1;

  if best_project_id is not null then
    new.project_id := best_project_id;
  end if;

  return new;
end;
$$;
