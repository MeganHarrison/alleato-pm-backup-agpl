begin;

do $$
declare
  current_embedding_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
    into current_embedding_type
  from pg_attribute attribute
  where attribute.attrelid = 'public.memories'::regclass
    and attribute.attname = 'embedding'
    and not attribute.attisdropped;

  if current_embedding_type is distinct from 'halfvec(3072)' then
    raise exception
      'Expected public.memories.embedding to be halfvec(3072), found %',
      coalesce(current_embedding_type, '<missing>');
  end if;
end;
$$;

-- The 1536-dimension overload is obsolete and makes PostgREST unable to
-- choose the 3072-dimension function used by the current embedding model.
drop function if exists public.search_conversation_memories(vector(1536), integer, uuid);

create or replace function public.search_conversation_memories(
  query_embedding halfvec(3072),
  match_count integer default 5,
  filter_user_id uuid default null
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  with eligible as materialized (
    select
      memory.id,
      memory.content,
      memory.metadata,
      memory.embedding
    from public.memories memory
    where memory.memory_type = 'conversation_summary'
      and memory.embedding is not null
      and (filter_user_id is null or memory.user_id = filter_user_id)
    order by memory.created_at desc nulls last
    limit greatest(match_count * 50, 500)
  )
  select
    eligible.id,
    eligible.content,
    eligible.metadata,
    (1 - (eligible.embedding <=> query_embedding))::double precision as similarity
  from eligible
  order by eligible.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.search_conversation_memories(halfvec(3072), integer, uuid) from public;
revoke all on function public.search_conversation_memories(halfvec(3072), integer, uuid) from anon;
grant execute on function public.search_conversation_memories(halfvec(3072), integer, uuid)
  to authenticated, service_role;

comment on function public.search_conversation_memories(halfvec(3072), integer, uuid) is
  'Search user-scoped conversation summaries with the canonical 3072-dimension embedding model.';

notify pgrst, 'reload schema';

commit;
