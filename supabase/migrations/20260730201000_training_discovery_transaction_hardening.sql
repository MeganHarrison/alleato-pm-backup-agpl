-- Close transaction and audit gaps found during independent review of ALL-54.

begin;

create or replace function public.capture_training_candidate_review_feedback()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  effective_reviewer_id uuid := coalesce(new.reviewed_by, auth.uid());
  effective_notes text :=
    case
      when char_length(coalesce(btrim(new.reviewer_notes), '')) between 8 and 1000
        then btrim(new.reviewer_notes)
      else null
    end;
begin
  if old.status = 'review'
    and new.status in ('published', 'archived')
  then
    if effective_reviewer_id is null then
      raise exception
        using
          errcode = '23502',
          message = 'Training candidate review requires a reviewer identity.';
    end if;

    insert into public.training_resource_feedback (
      resource_id,
      reviewer_id,
      decision,
      reason_codes,
      ratings,
      notes
    )
    values (
      new.id,
      effective_reviewer_id,
      case when new.status = 'published' then 'publish' else 'archive' end,
      array['legacy_unstructured'],
      '{}'::jsonb,
      effective_notes
    )
    on conflict (resource_id)
      where source = 'candidate_review'
      do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.review_training_resource_candidate(
  p_resource_id uuid,
  p_decision text,
  p_reason_codes text[],
  p_ratings jsonb default '{}'::jsonb,
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_notes text := nullif(btrim(p_notes), '');
  normalized_reasons text[];
  target_status public.training_resource_status;
  candidate_id uuid;
  rating record;
  allowed_positive constant text[] := array[
    'field_applicable',
    'trusted_provider',
    'right_depth',
    'clear_instruction',
    'current_content'
  ];
  allowed_negative constant text[] := array[
    'wrong_role_topic',
    'too_basic',
    'too_advanced',
    'outdated',
    'poor_quality',
    'promotional',
    'too_short',
    'duplicate_similar',
    'unsafe_inaccurate'
  ];
begin
  if auth.uid() is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Training resource review requires app admin access.';
  end if;

  if p_decision not in ('publish', 'archive') then
    raise exception
      using
        errcode = '22023',
        message = 'Training resource decision must be publish or archive.';
  end if;

  select array_agg(distinct btrim(reason_code) order by btrim(reason_code))
  into normalized_reasons
  from unnest(coalesce(p_reason_codes, '{}'::text[])) reason_code
  where nullif(btrim(reason_code), '') is not null;

  if coalesce(cardinality(normalized_reasons), 0) = 0 then
    raise exception
      using
        errcode = '22023',
        message = 'Select at least one structured review reason.';
  end if;

  if p_decision = 'publish'
    and not (normalized_reasons <@ allowed_positive)
  then
    raise exception
      using
        errcode = '22023',
        message = 'Published resources require approved positive reason codes.';
  end if;

  if p_decision = 'archive'
    and not (normalized_reasons <@ allowed_negative)
  then
    raise exception
      using
        errcode = '22023',
        message = 'Archived resources require approved negative reason codes.';
  end if;

  if p_decision = 'archive'
    and (
      normalized_notes is null
      or char_length(normalized_notes) not between 8 and 1000
    )
  then
    raise exception
      using
        errcode = '22023',
        message = 'Archive feedback must be between 8 and 1000 characters.';
  end if;

  if jsonb_typeof(coalesce(p_ratings, '{}'::jsonb)) <> 'object' then
    raise exception
      using
        errcode = '22023',
        message = 'Training review ratings must be a JSON object.';
  end if;

  for rating in
    select key, value
    from jsonb_each(coalesce(p_ratings, '{}'::jsonb))
  loop
    if rating.key not in ('relevance', 'depth', 'quality')
      or jsonb_typeof(rating.value) <> 'number'
      or (rating.value #>> '{}')::numeric not between 1 and 5
    then
      raise exception
        using
          errcode = '22023',
          message = 'Training review ratings must use relevance, depth, or quality with values from 1 to 5.';
    end if;
  end loop;

  select candidate.id
  into candidate_id
  from public.training_discovery_candidate candidate
  where candidate.resource_id = p_resource_id
  limit 1;

  target_status :=
    case when p_decision = 'publish' then 'published' else 'archived' end;

  perform 1
  from public.training_resource resource
  where resource.id = p_resource_id
    and resource.status = 'review'
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Training resource is no longer pending review.';
  end if;

  -- Insert feedback first. The status trigger sees the same resource-level
  -- unique row and becomes a no-op. If the update fails, this insert rolls back.
  insert into public.training_resource_feedback (
    resource_id,
    reviewer_id,
    discovery_candidate_id,
    decision,
    reason_codes,
    ratings,
    notes
  )
  values (
    p_resource_id,
    auth.uid(),
    candidate_id,
    p_decision,
    normalized_reasons,
    coalesce(p_ratings, '{}'::jsonb),
    normalized_notes
  );

  update public.training_resource
  set
    status = target_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewer_notes = normalized_notes,
    updated_by = auth.uid(),
    published_by =
      case when p_decision = 'publish' then auth.uid() else null end,
    published_at =
      case when p_decision = 'publish' then now() else null end
  where id = p_resource_id
    and status = 'review';

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Training resource is no longer pending review.';
  end if;

  return target_status::text;
end;
$$;

create function public.training_fingerprint_hamming_distance(
  p_left text,
  p_right text
)
returns integer
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  position integer;
  distance integer := 0;
  xor_nibble integer;
  bit_counts constant integer[] :=
    array[0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
begin
  if p_left !~ '^[0-9a-f]{16}$' or p_right !~ '^[0-9a-f]{16}$' then
    raise exception
      using
        errcode = '22023',
        message = 'Training fingerprints must be 16 lowercase hexadecimal characters.';
  end if;

  for position in 1..16 loop
    xor_nibble :=
      get_byte(decode('0' || substr(p_left, position, 1), 'hex'), 0)
      # get_byte(decode('0' || substr(p_right, position, 1), 'hex'), 0);
    distance := distance + bit_counts[xor_nibble + 1];
  end loop;

  return distance;
end;
$$;

create function public.create_training_discovery_review_candidate(
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

revoke all on function public.capture_training_candidate_review_feedback()
  from public, anon, authenticated, service_role;
revoke all on function public.review_training_resource_candidate(
  uuid,
  text,
  text[],
  jsonb,
  text
) from public, anon, service_role;
grant execute on function public.review_training_resource_candidate(
  uuid,
  text,
  text[],
  jsonb,
  text
) to authenticated;
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
revoke all on function public.training_fingerprint_hamming_distance(text, text)
  from public, anon, authenticated, service_role;

comment on function public.create_training_discovery_review_candidate(
  jsonb,
  jsonb,
  jsonb
) is
  'Atomically creates one review-only resource, its fingerprint, and its discovery audit row.';

notify pgrst, 'reload schema';

commit;
