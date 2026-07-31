create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_chat_history_content_fts
  on public.chat_history
  using gin (to_tsvector('english', coalesce(content, '')));

create index if not exists idx_chat_history_content_trgm
  on public.chat_history
  using gin (content gin_trgm_ops);

create index if not exists idx_chat_history_user_session_created
  on public.chat_history (user_id, session_id, created_at);

create or replace function public.search_chat_history(
  p_query text,
  p_user_id uuid default auth.uid(),
  p_project_id integer default null,
  p_match_count integer default 5,
  p_window_size integer default 3
)
returns table (
  query text,
  scope jsonb,
  result_count integer,
  status text,
  session_id uuid,
  lineage_root_session_id uuid,
  title text,
  session_created_at timestamptz,
  session_last_message_at timestamptz,
  project_id integer,
  rank real,
  headline text,
  anchor_message_id uuid,
  anchor_created_at timestamptz,
  anchor_role text,
  anchored_window jsonb,
  bookend_start jsonb,
  bookend_end jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_auth_role text := auth.role();
  v_query text := nullif(trim(p_query), '');
  v_match_count integer := least(greatest(coalesce(p_match_count, 5), 1), 20);
  v_window_size integer := least(greatest(coalesce(p_window_size, 3), 1), 8);
begin
  if p_user_id is null then
    raise insufficient_privilege using message = 'search_chat_history requires a user scope.';
  end if;

  if coalesce(v_auth_role, '') <> 'service_role' and (v_auth_uid is null or v_auth_uid <> p_user_id) then
    raise insufficient_privilege using message = 'search_chat_history user scope does not match the authenticated user.';
  end if;

  if v_query is null then
    return query
    select
      coalesce(p_query, '')::text,
      jsonb_build_object('userId', p_user_id, 'projectId', p_project_id),
      0::integer,
      'empty'::text,
      null::uuid,
      null::uuid,
      null::text,
      null::timestamptz,
      null::timestamptz,
      p_project_id,
      null::real,
      'No chat history query was provided.'::text,
      null::uuid,
      null::timestamptz,
      null::text,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb;
    return;
  end if;

  return query
  with scoped_messages as (
    select
      h.id,
      h.session_id,
      h.user_id,
      h.role,
      h.content,
      h.sources,
      h.metadata,
      h.created_at,
      c.title::text as title,
      c.created_at as session_created_at,
      c.last_message_at as session_last_message_at,
      case
        when coalesce(c.metadata->>'lineageRootSessionId', h.metadata->>'lineageRootSessionId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then coalesce(c.metadata->>'lineageRootSessionId', h.metadata->>'lineageRootSessionId')::uuid
        when coalesce(c.metadata->>'parentSessionId', h.metadata->>'parentSessionId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then coalesce(c.metadata->>'parentSessionId', h.metadata->>'parentSessionId')::uuid
        else h.session_id
      end as lineage_root_session_id,
      case
        when coalesce(c.metadata->>'projectId', c.metadata->>'selectedProjectId', h.metadata->>'projectId', h.metadata->>'selectedProjectId') ~ '^[0-9]+$'
          then coalesce(c.metadata->>'projectId', c.metadata->>'selectedProjectId', h.metadata->>'projectId', h.metadata->>'selectedProjectId')::integer
        else null
      end as resolved_project_id,
      row_number() over (partition by h.session_id order by h.created_at asc nulls last, h.id asc) as message_ordinal,
      to_tsvector('english', coalesce(h.content, '')) as search_vector
    from public.chat_history h
    left join public.conversations c
      on c.session_id = h.session_id::text
      and c.user_id = p_user_id
    where h.user_id = p_user_id
  ),
  matching_messages as (
    select
      sm.*,
      (
        ts_rank_cd(sm.search_vector, websearch_to_tsquery('english', v_query)) +
        (similarity(sm.content, v_query) * 0.15)
      )::real as score
    from scoped_messages sm
    where
      (p_project_id is null or sm.resolved_project_id = p_project_id)
      and (
        sm.search_vector @@ websearch_to_tsquery('english', v_query)
        or sm.content % v_query
      )
  ),
  deduped_matches as (
    select
      mm.*,
      row_number() over (
        partition by mm.lineage_root_session_id
        order by mm.score desc, mm.created_at desc nulls last, mm.id desc
      ) as lineage_rank
    from matching_messages mm
  ),
  selected_matches as (
    select *
    from deduped_matches
    where lineage_rank = 1
    order by score desc, created_at desc nulls last
    limit v_match_count
  ),
  selected_count as (
    select count(*)::integer as count from selected_matches
  )
  select
    v_query::text as query,
    jsonb_build_object('userId', p_user_id, 'projectId', p_project_id) as scope,
    sc.count as result_count,
    'ok'::text as status,
    sm.session_id,
    sm.lineage_root_session_id,
    sm.title,
    sm.session_created_at,
    sm.session_last_message_at,
    sm.resolved_project_id as project_id,
    sm.score as rank,
    ts_headline(
      'english',
      sm.content,
      websearch_to_tsquery('english', v_query),
      'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=8'
    ) as headline,
    sm.id as anchor_message_id,
    sm.created_at as anchor_created_at,
    sm.role as anchor_role,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', w.id,
            'role', w.role,
            'content', w.content,
            'createdAt', w.created_at,
            'isAnchor', w.id = sm.id
          )
          order by w.message_ordinal
        ),
        '[]'::jsonb
      )
      from scoped_messages w
      where w.session_id = sm.session_id
        and w.message_ordinal between sm.message_ordinal - v_window_size and sm.message_ordinal + v_window_size
    ) as anchored_window,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'role', b.role,
            'content', b.content,
            'createdAt', b.created_at
          )
          order by b.message_ordinal
        ),
        '[]'::jsonb
      )
      from scoped_messages b
      where b.session_id = sm.session_id
        and b.message_ordinal <= 3
    ) as bookend_start,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'role', e.role,
            'content', e.content,
            'createdAt', e.created_at
          )
          order by e.message_ordinal
        ),
        '[]'::jsonb
      )
      from (
        select *
        from scoped_messages tail
        where tail.session_id = sm.session_id
        order by tail.message_ordinal desc
        limit 3
      ) e
    ) as bookend_end
  from selected_matches sm
  cross join selected_count sc
  union all
  select
    v_query::text,
    jsonb_build_object('userId', p_user_id, 'projectId', p_project_id),
    0::integer,
    'empty'::text,
    null::uuid,
    null::uuid,
    null::text,
    null::timestamptz,
    null::timestamptz,
    p_project_id,
    null::real,
    format('No prior chat history matched "%s" for the requested scope.', v_query)::text,
    null::uuid,
    null::timestamptz,
    null::text,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  from selected_count sc
  where sc.count = 0;
end;
$$;

grant execute on function public.search_chat_history(text, uuid, integer, integer, integer) to authenticated;
grant execute on function public.search_chat_history(text, uuid, integer, integer, integer) to service_role;
