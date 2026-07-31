-- Serialize review decisions and candidate dedupe at the database boundary.

begin;

create or replace function public.training_fingerprint_hamming_distance(
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

create function public.review_training_resource_candidate_locked(
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
begin
  if auth.uid() is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Training resource review requires app admin access.';
  end if;

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

  return public.review_training_resource_candidate(
    p_resource_id => p_resource_id,
    p_decision => p_decision,
    p_reason_codes => p_reason_codes,
    p_ratings => p_ratings,
    p_notes => p_notes
  );
end;
$$;

create function public.create_training_discovery_review_candidate_locked(
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

  return public.create_training_discovery_review_candidate(
    p_resource => p_resource,
    p_candidate => p_candidate,
    p_fingerprint => p_fingerprint
  );
end;
$$;

revoke all on function public.training_fingerprint_hamming_distance(text, text)
  from public, anon, authenticated, service_role;

revoke all on function public.review_training_resource_candidate(
  uuid,
  text,
  text[],
  jsonb,
  text
) from public, anon, authenticated, service_role;
revoke all on function public.review_training_resource_candidate_locked(
  uuid,
  text,
  text[],
  jsonb,
  text
) from public, anon, service_role;
grant execute on function public.review_training_resource_candidate_locked(
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
) from public, anon, authenticated, service_role;
revoke all on function public.create_training_discovery_review_candidate_locked(
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.create_training_discovery_review_candidate_locked(
  jsonb,
  jsonb,
  jsonb
) to service_role;

comment on function public.review_training_resource_candidate_locked(
  uuid,
  text,
  text[],
  jsonb,
  text
) is
  'Serializes a structured app-admin decision and returns a specific stale-review error.';
comment on function public.create_training_discovery_review_candidate_locked(
  jsonb,
  jsonb,
  jsonb
) is
  'Serializes topic-level duplicate validation before atomic review-candidate creation.';

notify pgrst, 'reload schema';

commit;
