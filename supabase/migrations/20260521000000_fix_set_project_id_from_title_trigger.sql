-- Fix set_project_id_from_title() trigger function
-- Problem: references p.client which was dropped in Wave 2I
--          (migration 20260518020000_drop_projects_legacy_client_columns.sql)
-- Fix: replace p.client scoring with a join to companies.name via p.company_id
-- Trigger itself (set_project_id_from_title_trg) is unchanged — only the function body.

CREATE OR REPLACE FUNCTION public.set_project_id_from_title()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
        case
          when p.project_number is not null
            and p.project_number <> ''
            and combined_title ~* (
              '(^|[^0-9a-z])' ||
              regexp_replace(lower(p.project_number), '[^0-9a-z]+', '[^0-9a-z]+', 'g') ||
              '([^0-9a-z]|$)'
            )
          then 12
          else 0
        end
        +
        case
          when p.project_number is not null
            and p.project_number <> ''
            and combined_content ~* (
              '(^|[^0-9a-z])' ||
              regexp_replace(lower(p.project_number), '[^0-9a-z]+', '[^0-9a-z]+', 'g') ||
              '([^0-9a-z]|$)'
            )
          then 8
          else 0
        end
        +
        case
          when p.name is not null and combined_title like '%' || lower(p.name) || '%' then 10
          else 0
        end
        +
        -- Replaced: p.client (dropped column) -> companies.name via p.company_id
        case
          when c.name is not null and combined_title like '%' || lower(c.name) || '%' then 7
          else 0
        end
        +
        coalesce((
          select count(*) * 6
          from unnest(coalesce(p.aliases, array[]::text[])) alias
          where alias <> ''
            and combined_title ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\1', 'g') || '(\\W|$)')
        ), 0)
        +
        case
          when p.name is not null and combined_content like '%' || lower(p.name) || '%' then 4
          else 0
        end
        +
        -- Replaced: p.client (dropped column) -> companies.name via p.company_id
        case
          when c.name is not null and combined_content like '%' || lower(c.name) || '%' then 3
          else 0
        end
        +
        coalesce((
          select count(*) * 3
          from unnest(coalesce(p.aliases, array[]::text[])) alias
          where alias <> ''
            and combined_content ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\1', 'g') || '(\\W|$)')
        ), 0)
        +
        -- Replaced: p.client (dropped column) -> companies.name via p.company_id
        case
          when c.name is not null and combined_participants like '%' || lower(c.name) || '%' then 2
          else 0
        end
        +
        coalesce((
          select count(*) * 2
          from unnest(coalesce(p.aliases, array[]::text[])) alias
          where alias <> ''
            and combined_participants ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\1', 'g') || '(\\W|$)')
        ), 0)
      ) as score
    from public.projects p
    left join public.companies c on c.id = p.company_id
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
$function$
