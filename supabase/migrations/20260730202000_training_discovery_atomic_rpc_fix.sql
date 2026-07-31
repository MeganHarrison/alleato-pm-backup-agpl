-- Resolve PL/pgSQL variable/column ambiguity in the atomic discovery RPC.

begin;

create or replace function public.create_training_discovery_review_candidate(
  p_resource jsonb,
  p_candidate jsonb,
  p_fingerprint jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_resource_id uuid;
  created_candidate_id uuid;
  role_ids uuid[];
  target_topic_id uuid;
  candidate_canonical_url text;
  candidate_provider text;
  candidate_external_id text;
  candidate_fingerprint text;
begin
  if auth.role() <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Training discovery candidate creation requires service role.';
  end if;

  if jsonb_typeof(p_resource) <> 'object'
    or jsonb_typeof(p_candidate) <> 'object'
    or jsonb_typeof(p_fingerprint) <> 'object'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Training discovery candidate payloads must be JSON objects.';
  end if;

  if jsonb_typeof(coalesce(p_resource -> 'p_role_ids', '[]'::jsonb)) <> 'array'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Training discovery resource role ids must be an array.';
  end if;

  select coalesce(array_agg(role_id), '{}'::uuid[])
  into role_ids
  from (
    select distinct role_id_text::uuid as role_id
    from jsonb_array_elements_text(
      coalesce(p_resource -> 'p_role_ids', '[]'::jsonb)
    ) as requested_role(role_id_text)
  ) requested_roles;

  target_topic_id := nullif(p_resource ->> 'p_topic_id', '')::uuid;
  candidate_canonical_url := p_fingerprint ->> 'canonical_url';
  candidate_provider := p_fingerprint ->> 'provider';
  candidate_external_id := p_fingerprint ->> 'external_id';
  candidate_fingerprint := p_fingerprint ->> 'content_fingerprint';

  perform pg_advisory_xact_lock(
    hashtextextended(
      'training-discovery-topic:' || target_topic_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.training_resource_fingerprint existing_fingerprint
    join public.training_resource existing_resource
      on existing_resource.id = existing_fingerprint.resource_id
    where existing_resource.topic_id = target_topic_id
      and (
        existing_fingerprint.canonical_url = candidate_canonical_url
        or (
          candidate_external_id is not null
          and existing_fingerprint.provider = candidate_provider
          and existing_fingerprint.external_id = candidate_external_id
        )
        or (
          candidate_fingerprint is not null
          and existing_fingerprint.content_fingerprint is not null
          and public.training_fingerprint_hamming_distance(
            existing_fingerprint.content_fingerprint,
            candidate_fingerprint
          ) <= 5
        )
      )
  ) then
    raise exception
      using
        errcode = '23505',
        message = 'TRAINING_RESOURCE_DUPLICATE: canonical identity or near-duplicate fingerprint already exists for this topic.';
  end if;

  created_resource_id := public.create_training_review_candidate(
    p_topic_id =>
      target_topic_id,
    p_title =>
      p_resource ->> 'p_title',
    p_url =>
      p_resource ->> 'p_url',
    p_resource_type =>
      (p_resource ->> 'p_resource_type')::public.training_resource_type,
    p_level =>
      (p_resource ->> 'p_level')::public.training_resource_level,
    p_track =>
      (p_resource ->> 'p_track')::public.training_resource_track,
    p_role_ids =>
      role_ids,
    p_description =>
      p_resource ->> 'p_description',
    p_embed_url =>
      p_resource ->> 'p_embed_url',
    p_thumbnail_url =>
      p_resource ->> 'p_thumbnail_url',
    p_provider =>
      p_resource ->> 'p_provider',
    p_duration_minutes =>
      nullif(p_resource ->> 'p_duration_minutes', '')::integer,
    p_source_attribution =>
      p_resource ->> 'p_source_attribution',
    p_metadata =>
      coalesce(p_resource -> 'p_metadata', '{}'::jsonb)
  );

  insert into public.training_resource_fingerprint (
    resource_id,
    canonical_url,
    provider,
    external_id,
    content_fingerprint,
    fingerprint_source,
    evidence
  )
  values (
    created_resource_id,
    candidate_canonical_url,
    candidate_provider,
    candidate_external_id,
    candidate_fingerprint,
    p_fingerprint ->> 'fingerprint_source',
    coalesce(p_fingerprint -> 'evidence', '{}'::jsonb)
  )
  on conflict (resource_id) do update
  set
    canonical_url = excluded.canonical_url,
    provider = excluded.provider,
    external_id = excluded.external_id,
    content_fingerprint = excluded.content_fingerprint,
    fingerprint_source = excluded.fingerprint_source,
    evidence = excluded.evidence;

  insert into public.training_discovery_candidate (
    run_id,
    resource_id,
    title,
    canonical_url,
    provider,
    external_id,
    strategy,
    original_rank,
    learned_rank,
    score,
    decision,
    reason_code,
    detail,
    features,
    explanation,
    content_fingerprint,
    fingerprint_source
  )
  values (
    nullif(p_candidate ->> 'run_id', '')::uuid,
    created_resource_id,
    p_candidate ->> 'title',
    candidate_canonical_url,
    candidate_provider,
    candidate_external_id,
    p_candidate ->> 'strategy',
    (p_candidate ->> 'original_rank')::integer,
    (p_candidate ->> 'learned_rank')::integer,
    (p_candidate ->> 'score')::numeric,
    'inserted',
    'review_candidate_created',
    p_candidate ->> 'detail',
    coalesce(p_candidate -> 'features', '{}'::jsonb),
    coalesce(p_candidate -> 'explanation', '[]'::jsonb),
    candidate_fingerprint,
    p_fingerprint ->> 'fingerprint_source'
  )
  returning id into created_candidate_id;

  return jsonb_build_object(
    'resourceId', created_resource_id,
    'candidateId', created_candidate_id
  );
end;
$$;

revoke all on function public.create_training_discovery_review_candidate(
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.create_training_discovery_review_candidate(
  jsonb,
  jsonb,
  jsonb
) to service_role;

notify pgrst, 'reload schema';

commit;
