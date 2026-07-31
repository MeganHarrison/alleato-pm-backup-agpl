-- Bound AI memory vector RPCs so memory recall cannot hang on table-wide
-- halfvec/vector distance scans when a vector index is missing or invalid.
--
-- The functions keep their existing signatures, security posture, and grants.
-- They first narrow to active, authorized, recent/high-importance candidates,
-- then calculate vector similarity over that bounded set.

set statement_timeout = 0;
set lock_timeout = '5min';
begin;
create or replace function public.search_ai_memories(
  query_embedding   halfvec(3072),
  p_user_id         uuid,
  match_count       int     default 8,
  match_threshold   float   default 0.45,
  filter_type       text    default null,
  filter_project_id int     default null
)
returns table (
  id              uuid,
  type            text,
  content         text,
  confidence      float,
  importance      float,
  project_id      int,
  meeting_id      text,
  source          text,
  created_at      timestamptz,
  similarity      float
)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_count int := greatest(match_count * 50, 500);
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized to read other users'' memories';
  end if;

  set local hnsw.ef_search = 100;

  return query
  with eligible as materialized (
    select
      m.id,
      m.type,
      m.content,
      m.confidence,
      m.importance,
      m.project_id,
      m.meeting_id,
      m.source,
      m.created_at,
      m.embedding
    from public.ai_memories m
    where m.user_id = p_user_id
      and m.is_active = true
      and (m.expires_at is null or m.expires_at > now())
      and m.embedding is not null
      and (filter_type is null or m.type = filter_type)
      and (filter_project_id is null or m.project_id = filter_project_id)
    order by
      m.importance desc,
      coalesce(m.last_accessed_at, m.created_at) desc
    limit candidate_count
  ),
  ranked as materialized (
    select
      e.*,
      (1 - (e.embedding <=> query_embedding))::float as similarity
    from eligible e
  )
  select
    r.id,
    r.type,
    r.content,
    r.confidence,
    r.importance,
    r.project_id,
    r.meeting_id,
    r.source,
    r.created_at,
    r.similarity
  from ranked r
  where r.similarity > match_threshold
  order by ((r.similarity * 0.7) + (r.importance * 0.3)) desc
  limit match_count;
end;
$$;
create or replace function public.find_duplicate_memory(
  query_embedding      halfvec(3072),
  p_user_id            uuid,
  p_type               text,
  similarity_threshold float default 0.88
)
returns table (
  id          uuid,
  content     text,
  confidence  float,
  importance  float,
  similarity  float
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized to read other users'' memories';
  end if;

  set local hnsw.ef_search = 100;

  return query
  with eligible as materialized (
    select
      m.id,
      m.content,
      m.confidence,
      m.importance,
      m.embedding
    from public.ai_memories m
    where m.user_id = p_user_id
      and m.type = p_type
      and m.is_active = true
      and (m.expires_at is null or m.expires_at > now())
      and m.embedding is not null
    order by
      m.importance desc,
      coalesce(m.last_accessed_at, m.created_at) desc
    limit 500
  ),
  ranked as materialized (
    select
      e.*,
      (1 - (e.embedding <=> query_embedding))::float as similarity
    from eligible e
  )
  select
    r.id,
    r.content,
    r.confidence,
    r.importance,
    r.similarity
  from ranked r
  where r.similarity > similarity_threshold
  order by r.similarity desc
  limit 1;
end;
$$;
create or replace function public.search_team_memories(
  query_embedding   halfvec(3072),
  match_count       int   default 5,
  match_threshold   float default 0.45,
  filter_type       text  default null
)
returns table (
  id          uuid,
  type        text,
  content     text,
  confidence  float,
  importance  float,
  project_id  int,
  source      text,
  created_at  timestamptz,
  similarity  float
)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_count int := greatest(match_count * 50, 500);
begin
  if auth.role() not in ('authenticated', 'service_role') then
    raise exception 'Authentication required';
  end if;

  set local hnsw.ef_search = 100;

  return query
  with eligible as materialized (
    select
      m.id,
      m.type,
      m.content,
      m.confidence,
      m.importance,
      m.project_id,
      m.source,
      m.created_at,
      m.embedding
    from public.ai_memories m
    where m.visibility = 'team'
      and m.is_active = true
      and (m.expires_at is null or m.expires_at > now())
      and m.embedding is not null
      and (filter_type is null or m.type = filter_type)
    order by
      m.importance desc,
      coalesce(m.last_accessed_at, m.created_at) desc
    limit candidate_count
  ),
  ranked as materialized (
    select
      e.*,
      (1 - (e.embedding <=> query_embedding))::float as similarity
    from eligible e
  )
  select
    r.id,
    r.type,
    r.content,
    r.confidence,
    r.importance,
    r.project_id,
    r.source,
    r.created_at,
    r.similarity
  from ranked r
  where r.similarity > match_threshold
  order by ((r.similarity * 0.7) + (r.importance * 0.3)) desc
  limit match_count;
end;
$$;
create or replace function public.search_conversation_memories(
  query_embedding vector(1536),
  match_count int default 5,
  filter_user_id uuid default null
)
returns table (id bigint, content text, metadata jsonb, similarity float)
language sql
stable
as $$
  with eligible as materialized (
    select
      m.id,
      m.content,
      m.metadata,
      m.embedding
    from public.memories m
    where m.memory_type = 'conversation_summary'
      and m.embedding is not null
      and (filter_user_id is null or m.user_id = filter_user_id)
    order by m.created_at desc nulls last
    limit greatest(match_count * 50, 500)
  ),
  ranked as materialized (
    select
      e.id,
      e.content,
      e.metadata,
      (1 - (e.embedding <=> query_embedding))::float as similarity
    from eligible e
  )
  select
    r.id,
    r.content,
    r.metadata,
    r.similarity
  from ranked r
  order by r.similarity desc
  limit match_count;
$$;
revoke all on function public.search_ai_memories(halfvec(3072), uuid, int, float, text, int) from public;
grant execute on function public.search_ai_memories(halfvec(3072), uuid, int, float, text, int) to authenticated, service_role;
revoke all on function public.find_duplicate_memory(halfvec(3072), uuid, text, float) from public;
grant execute on function public.find_duplicate_memory(halfvec(3072), uuid, text, float) to authenticated, service_role;
revoke all on function public.search_team_memories(halfvec(3072), int, float, text) from public;
grant execute on function public.search_team_memories(halfvec(3072), int, float, text) to authenticated, service_role;
grant execute on function public.search_conversation_memories(vector(1536), int, uuid) to anon, authenticated, service_role;
commit;
