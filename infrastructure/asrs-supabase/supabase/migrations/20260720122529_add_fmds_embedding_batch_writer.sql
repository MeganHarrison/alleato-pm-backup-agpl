begin;

create or replace function public.store_fmds_chunk_embeddings(
  requested_revision_id uuid,
  embedding_rows jsonb,
  requested_model text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  revision_status text;
  item jsonb;
  changed integer := 0;
  row_changed integer;
begin
  select status into revision_status
  from public.fmds_corpus_revisions
  where id = requested_revision_id;

  if revision_status is null then
    raise exception 'Unknown FMDS revision %', requested_revision_id;
  end if;
  if revision_status <> 'staging' then
    raise exception 'Embedding writes require a staging revision; current status is %', revision_status;
  end if;
  if jsonb_typeof(embedding_rows) <> 'array' then
    raise exception 'embedding_rows must be a JSON array';
  end if;
  if requested_model <> 'text-embedding-3-large' then
    raise exception 'Unsupported FMDS embedding model: %', requested_model;
  end if;

  for item in select value from jsonb_array_elements(embedding_rows)
  loop
    update public.fmds_chunks
    set embedding = (item ->> 'embedding')::public.halfvec(3072),
        embedding_model = requested_model,
        embedding_dimensions = 3072,
        embedding_status = 'embedded',
        embedding_error = null
    where id = (item ->> 'id')::uuid
      and revision_id = requested_revision_id;

    get diagnostics row_changed = row_count;
    if row_changed <> 1 then
      raise exception 'Embedding target % is missing or belongs to another revision', item ->> 'id';
    end if;
    changed := changed + row_changed;
  end loop;

  return changed;
end;
$$;

revoke all on function public.store_fmds_chunk_embeddings(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.store_fmds_chunk_embeddings(uuid, jsonb, text)
  to service_role;

commit;
