-- Project-scope Microsoft Graph communications for RAG.
--
-- Fixes two gaps:
-- 1. Existing Graph rows with obvious project signals were still unassigned.
-- 2. Category-specific document chunk search ranked globally before app-side
--    project filtering, so project-scoped Teams/email searches could miss rows.

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
drop function if exists public.search_document_chunks_by_category(halfvec(3072), text, integer, double precision);
drop function if exists public.search_document_chunks_by_category(halfvec(3072), text, integer, double precision, bigint);
create or replace function public.search_document_chunks_by_category(
    query_embedding  halfvec(3072),
    filter_category  text,
    match_count      int     default 10,
    match_threshold  float   default 0.25,
    filter_project_id bigint default null
)
returns table (
    chunk_id        text,
    document_id     text,
    chunk_index     int,
    chunk_text      text,
    similarity      float,
    doc_title       text,
    doc_category    text,
    doc_source      text,
    doc_type        text,
    doc_date        timestamptz,
    doc_participants text,
    doc_tags        text,
    doc_project_id  bigint,
    doc_metadata    jsonb,
    doc_created_at  timestamptz
)
language plpgsql
as $$
begin
    set local hnsw.ef_search = 100;

    return query
    select
        dc.chunk_id,
        dc.document_id,
        dc.chunk_index,
        dc.text                                              as chunk_text,
        (1 - (dc.embedding <=> query_embedding))::float     as similarity,
        dm.title                                            as doc_title,
        dm.category                                         as doc_category,
        dm.source                                           as doc_source,
        dm.type                                             as doc_type,
        dm.date                                             as doc_date,
        dm.participants                                     as doc_participants,
        dm.tags                                             as doc_tags,
        dm.project_id                                       as doc_project_id,
        dc.metadata                                         as doc_metadata,
        dm.created_at                                       as doc_created_at
    from public.document_chunks dc
    join public.document_metadata dm
        on dc.document_id = dm.id
    where
        dc.embedding is not null
        and dm.category = filter_category
        and (filter_project_id is null or dm.project_id = filter_project_id)
        and (1 - (dc.embedding <=> query_embedding)) > match_threshold
    order by dc.embedding <=> query_embedding
    limit match_count;
end;
$$;
grant execute on function public.search_document_chunks_by_category(halfvec(3072), text, int, float, bigint)
  to anon, authenticated, service_role;
with candidate_scores as (
  select
    dm.id as document_id,
    p.id as project_id,
    (
      case
        when p.name is not null and lower(coalesce(dm.title, '')) like '%' || lower(p.name) || '%' then 10
        else 0
      end
      +
      case
        when p.client is not null and lower(coalesce(dm.title, '')) like '%' || lower(p.client) || '%' then 7
        else 0
      end
      +
      coalesce((
        select count(*) * 6
        from unnest(coalesce(p.aliases, array[]::text[])) alias
        where alias <> ''
          and lower(coalesce(dm.title, '')) ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\\1', 'g') || '(\\W|$)')
      ), 0)
      +
      case
        when p.name is not null and lower(coalesce(dm.content, '') || ' ' || coalesce(dm.summary, '') || ' ' || coalesce(dm.overview, '') || ' ' || coalesce(dm.tags, '') || ' ' || coalesce(dm.project, '')) like '%' || lower(p.name) || '%' then 4
        else 0
      end
      +
      case
        when p.client is not null and lower(coalesce(dm.content, '') || ' ' || coalesce(dm.summary, '') || ' ' || coalesce(dm.overview, '') || ' ' || coalesce(dm.tags, '') || ' ' || coalesce(dm.project, '')) like '%' || lower(p.client) || '%' then 3
        else 0
      end
      +
      coalesce((
        select count(*) * 3
        from unnest(coalesce(p.aliases, array[]::text[])) alias
        where alias <> ''
          and lower(coalesce(dm.content, '') || ' ' || coalesce(dm.summary, '') || ' ' || coalesce(dm.overview, '') || ' ' || coalesce(dm.tags, '') || ' ' || coalesce(dm.project, '')) ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\\1', 'g') || '(\\W|$)')
      ), 0)
      +
      case
        when p.client is not null and lower(coalesce(dm.participants, '') || ' ' || coalesce(dm.participants_array::text, '')) like '%' || lower(p.client) || '%' then 2
        else 0
      end
      +
      coalesce((
        select count(*) * 2
        from unnest(coalesce(p.aliases, array[]::text[])) alias
        where alias <> ''
          and lower(coalesce(dm.participants, '') || ' ' || coalesce(dm.participants_array::text, '')) ~* ('(^|\\W)' || regexp_replace(alias, '([\\W])', '\\\1', 'g') || '(\\W|$)')
      ), 0)
    ) as score
  from public.document_metadata dm
  cross join public.projects p
  where dm.project_id is null
    and dm.source = 'microsoft_graph'
    and dm.category in ('teams_message', 'email', 'document')
    and coalesce(p.archived, false) = false
), ranked as (
  select
    document_id,
    project_id,
    score,
    row_number() over (partition by document_id order by score desc, project_id asc) as rn
  from candidate_scores
  where score >= 6
)
update public.document_metadata dm
set project_id = ranked.project_id
from ranked
where dm.id = ranked.document_id
  and ranked.rn = 1;
