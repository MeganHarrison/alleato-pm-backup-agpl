-- Transactional contract test for the training discovery learning loop.

begin;

do $$
declare
  missing_tables text[];
begin
  select array_agg(required_table order by required_table)
  into missing_tables
  from unnest(array[
    'training_discovery_policy',
    'training_discovery_run',
    'training_discovery_candidate',
    'training_resource_fingerprint',
    'training_resource_feedback'
  ]) required_table
  where to_regclass('public.' || required_table) is null;

  if missing_tables is not null then
    raise exception
      'Training discovery learning migration is incomplete; missing tables: %',
      missing_tables;
  end if;

  if (
    select count(*)
    from public.training_discovery_policy
    where status = 'active'
  ) <> 1 then
    raise exception 'Training discovery requires exactly one active policy';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.training_discovery_candidate',
    'INSERT'
  ) then
    raise exception 'Service role cannot record discovery candidate evidence';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.training_resource_feedback',
    'INSERT'
  ) then
    raise exception 'Authenticated callers can bypass structured review RPC';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.create_training_discovery_review_candidate_locked(jsonb,jsonb,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.create_training_discovery_review_candidate_locked(jsonb,jsonb,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Atomic training discovery RPC privileges are invalid';
  end if;

  if public.training_fingerprint_hamming_distance(
    '0123456789abcdef',
    '0123456789abcdee'
  ) <> 1 then
    raise exception 'Training fingerprint distance is incorrect';
  end if;
end
$$;

create temporary table training_learning_context (
  admin_id uuid not null,
  role_id uuid not null,
  topic_id uuid not null,
  resource_id uuid not null,
  legacy_resource_id uuid not null,
  run_id uuid not null,
  candidate_id uuid not null,
  shadow_policy_id uuid not null,
  qualified_policy_id uuid not null,
  active_policy_id uuid not null
) on commit drop;

do $$
declare
  selected_admin_id uuid;
  selected_role_id uuid;
  selected_topic_id uuid;
  selected_resource_id uuid;
  selected_legacy_resource_id uuid;
  selected_run_id uuid;
  selected_candidate_id uuid;
  selected_shadow_policy_id uuid;
  selected_qualified_policy_id uuid;
  selected_active_policy_id uuid;
  atomic_receipt jsonb;
begin
  select id
  into selected_active_policy_id
  from public.training_discovery_policy
  where status = 'active';

  select up.id
  into selected_admin_id
  from public.user_profiles up
  join public.users_auth ua on ua.auth_user_id = up.id
  join public.people person on person.id = ua.person_id
  where up.is_admin is true
    and person.status = 'active'
  order by up.id
  limit 1;

  if selected_admin_id is null then
    raise exception
      'Training learning contract test requires an active app admin';
  end if;

  insert into public.training_role (slug, name)
  values ('learning-loop-test-role', 'Learning Loop Test Role')
  returning id into selected_role_id;

  insert into public.training_topic (slug, name)
  values ('learning-loop-test-topic', 'Learning Loop Test Topic')
  returning id into selected_topic_id;

  select public.create_training_review_candidate(
    p_topic_id => selected_topic_id,
    p_title => 'Learning Loop Candidate',
    p_url => 'https://youtube.com/watch?v=learning-loop-contract',
    p_resource_type => 'video',
    p_level => 'deep-dive',
    p_track => 'pm',
    p_role_ids => array[selected_role_id],
    p_description => 'A complete construction workflow training course.'
  )
  into selected_resource_id;

  select public.create_training_review_candidate(
    p_topic_id => selected_topic_id,
    p_title => 'Learning Loop Legacy Candidate',
    p_url => 'https://youtube.com/watch?v=learning-loop-legacy-contract',
    p_resource_type => 'video',
    p_level => 'deep-dive',
    p_track => 'pm',
    p_role_ids => array[selected_role_id],
    p_description => 'A rolling-deploy compatibility fixture.'
  )
  into selected_legacy_resource_id;

  insert into public.training_discovery_run (
    role_id,
    topic_id,
    policy_id,
    trigger_source,
    status,
    query_plan,
    limits
  )
  select
    selected_role_id,
    selected_topic_id,
    policy.id,
    'test',
    'running',
    '[{"strategy":"role_topic_course","query":"contract","maxResults":1}]'::jsonb,
    '{"maxSearchResults":1,"maxInserts":1}'::jsonb
  from public.training_discovery_policy policy
  where policy.status = 'active'
  returning id into selected_run_id;

  insert into public.training_resource_fingerprint (
    resource_id,
    canonical_url,
    provider,
    external_id,
    content_fingerprint,
    fingerprint_source
  )
  values (
    selected_resource_id,
    'https://youtube.com/watch?v=learning-loop-contract',
    'youtube.com',
    'learning-loop-contract',
    '0123456789abcdef',
    'search_evidence'
  )
  on conflict (resource_id) do update
  set
    canonical_url = excluded.canonical_url,
    provider = excluded.provider,
    external_id = excluded.external_id,
    content_fingerprint = excluded.content_fingerprint,
    fingerprint_source = excluded.fingerprint_source,
    updated_at = now();

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
    selected_run_id,
    selected_resource_id,
    'Learning Loop Candidate',
    'https://youtube.com/watch?v=learning-loop-contract',
    'youtube.com',
    'learning-loop-contract',
    'role_topic_course',
    1,
    1,
    0.85,
    'inserted',
    'review_candidate_created',
    'Contract fixture',
    '{"topicRelevance":0.9}'::jsonb,
    '["Strong topic evidence"]'::jsonb,
    '0123456789abcdef',
    'search_evidence'
  )
  returning id into selected_candidate_id;

  perform set_config(
    'request.jwt.claims',
    '{"role":"service_role"}',
    true
  );

  atomic_receipt := public.create_training_discovery_review_candidate_locked(
    jsonb_build_object(
      'p_topic_id', selected_topic_id,
      'p_title', 'Learning Loop Atomic Candidate',
      'p_url', 'https://youtube.com/watch?v=learning-loop-atomic-contract',
      'p_resource_type', 'video',
      'p_level', 'deep-dive',
      'p_track', 'pm',
      'p_role_ids', jsonb_build_array(selected_role_id),
      'p_description', 'An atomic construction training workflow fixture.',
      'p_provider', 'youtube.com',
      'p_source_attribution', 'Training learning SQL contract',
      'p_metadata', '{"finder":{"policy":"atomic-test"}}'::jsonb
    ),
    jsonb_build_object(
      'run_id', selected_run_id,
      'title', 'Learning Loop Atomic Candidate',
      'strategy', 'role_topic_course',
      'original_rank', 2,
      'learned_rank', 2,
      'score', 0.8,
      'detail', 'Atomic contract fixture',
      'features', '{"topicRelevance":0.8}'::jsonb,
      'explanation', '["Atomic evidence"]'::jsonb
    ),
    jsonb_build_object(
      'canonical_url',
      'https://youtube.com/watch?v=learning-loop-atomic-contract',
      'provider',
      'youtube.com',
      'external_id',
      'learning-loop-atomic-contract',
      'content_fingerprint',
      'fedcba9876543210',
      'fingerprint_source',
      'search_evidence',
      'evidence',
      jsonb_build_object('runId', selected_run_id)
    )
  );

  if atomic_receipt ->> 'resourceId' is null
    or atomic_receipt ->> 'candidateId' is null
    or not exists (
      select 1
      from public.training_resource resource
      join public.training_resource_fingerprint fingerprint
        on fingerprint.resource_id = resource.id
      join public.training_discovery_candidate candidate
        on candidate.resource_id = resource.id
      where resource.id = (atomic_receipt ->> 'resourceId')::uuid
        and resource.status = 'review'
        and candidate.id = (atomic_receipt ->> 'candidateId')::uuid
    )
  then
    raise exception
      'Atomic training discovery RPC did not persist all review evidence';
  end if;

  begin
    perform public.create_training_discovery_review_candidate_locked(
      jsonb_build_object(
        'p_topic_id', selected_topic_id,
        'p_title', 'Learning Loop Concurrent Duplicate',
        'p_url', 'https://example.org/learning-loop-concurrent-duplicate',
        'p_resource_type', 'video',
        'p_level', 'deep-dive',
        'p_track', 'pm',
        'p_role_ids', jsonb_build_array(selected_role_id),
        'p_provider', 'example.org'
      ),
      jsonb_build_object(
        'run_id', selected_run_id,
        'title', 'Learning Loop Concurrent Duplicate',
        'strategy', 'role_topic_course',
        'original_rank', 3,
        'learned_rank', 3,
        'score', 0.79,
        'detail', 'Concurrent duplicate contract fixture'
      ),
      jsonb_build_object(
        'canonical_url',
        'https://example.org/learning-loop-concurrent-duplicate',
        'provider',
        'example.org',
        'content_fingerprint',
        'fedcba9876543210',
        'fingerprint_source',
        'search_evidence'
      )
    );
    raise exception 'Atomic discovery RPC accepted a near duplicate';
  exception
    when unique_violation then null;
  end;

  update public.training_discovery_run
  set
    status = 'completed',
    completed_at = now(),
    counts = '{"searched":1,"inserted":1}'::jsonb
  where id = selected_run_id;

  insert into public.training_discovery_policy (
    version,
    status,
    weights,
    evaluation,
    evaluated_at
  )
  values (
    'learning-loop-shadow-test',
    'shadow',
    '{}'::jsonb,
    '{"sampleSize":5,"beatsActive":true}'::jsonb,
    now()
  )
  returning id into selected_shadow_policy_id;

  insert into public.training_discovery_policy (
    version,
    status,
    weights,
    evaluation,
    evaluated_at
  )
  values (
    'learning-loop-qualified-test',
    'shadow',
    '{}'::jsonb,
    '{"sampleSize":20,"beatsActive":true}'::jsonb,
    now()
  )
  returning id into selected_qualified_policy_id;

  insert into training_learning_context
  values (
    selected_admin_id,
    selected_role_id,
    selected_topic_id,
    selected_resource_id,
    selected_legacy_resource_id,
    selected_run_id,
    selected_candidate_id,
    selected_shadow_policy_id,
    selected_qualified_policy_id,
    selected_active_policy_id
  );
end
$$;

grant select on training_learning_context to authenticated;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (select admin_id::text from training_learning_context),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  selected_resource_id uuid :=
    (select resource_id from training_learning_context);
  selected_legacy_resource_id uuid :=
    (select legacy_resource_id from training_learning_context);
  selected_shadow_policy_id uuid :=
    (select shadow_policy_id from training_learning_context);
  selected_qualified_policy_id uuid :=
    (select qualified_policy_id from training_learning_context);
  selected_active_policy_id uuid :=
    (select active_policy_id from training_learning_context);
  metrics jsonb;
begin
  update public.training_resource
  set
    status = 'published',
    published_at = now(),
    published_by = auth.uid(),
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    reviewer_notes = 'Legacy transition remains auditable during rolling deploys.'
  where id = selected_legacy_resource_id;

  if not exists (
    select 1
    from public.training_resource_feedback feedback
    where feedback.resource_id = selected_legacy_resource_id
      and feedback.reason_codes = array['legacy_unstructured']
  ) then
    raise exception 'Legacy training review transition was not captured';
  end if;

  if public.review_training_resource_candidate_locked(
    p_resource_id => selected_resource_id,
    p_decision => 'publish',
    p_reason_codes => array['field_applicable', 'right_depth'],
    p_ratings => '{"relevance":5,"depth":4,"quality":4}'::jsonb,
    p_notes => 'Strong field applicability and appropriate instructional depth.'
  ) <> 'published' then
    raise exception 'Structured training review returned an invalid receipt';
  end if;

  if not exists (
    select 1
    from public.training_resource_feedback feedback
    where feedback.resource_id = selected_resource_id
      and feedback.decision = 'publish'
      and feedback.reason_codes @> array['field_applicable', 'right_depth']
      and feedback.discovery_candidate_id = (
        select candidate_id from training_learning_context
      )
  ) then
    raise exception 'Structured training review feedback was not persisted';
  end if;

  begin
    perform public.review_training_resource_candidate_locked(
      p_resource_id => selected_resource_id,
      p_decision => 'publish',
      p_reason_codes => array['field_applicable'],
      p_ratings => '{"relevance":5}'::jsonb,
      p_notes => 'A stale repeated decision.'
    );
    raise exception 'Repeated training review decision was accepted';
  exception
    when no_data_found then null;
  end;

  metrics := public.get_training_discovery_admin_metrics();
  if (metrics ->> 'reviewed')::integer < 1
    or (metrics ->> 'published')::integer < 1
  then
    raise exception 'Training discovery metrics omitted reviewed evidence';
  end if;

  begin
    perform public.activate_training_discovery_policy(
      selected_shadow_policy_id
    );
    raise exception 'Under-evaluated discovery policy was activated';
  exception
    when invalid_parameter_value then null;
  end;

  if public.activate_training_discovery_policy(
    selected_qualified_policy_id
  ) <> 'learning-loop-qualified-test' then
    raise exception 'Qualified discovery policy was not activated';
  end if;

  if public.activate_training_discovery_policy(
    selected_active_policy_id
  ) <> 'feedback-ranking-v2' then
    raise exception 'Retired discovery policy could not be restored';
  end if;
end
$$;

reset role;
rollback;
