-- Focused transactional contract test for the learner-facing training library.
-- Safe to run against the linked database: every fixture and mutation rolls back.

begin;

do $$
declare
  missing_tables text[];
  missing_policies text[];
  resource_type_values text[];
  resource_level_values text[];
  resource_status_values text[];
begin
  select array_agg(required_table order by required_table)
    into missing_tables
  from unnest(array[
    'training_role',
    'training_topic',
    'training_resource',
    'training_resource_role'
  ]) required_table
  where to_regclass('public.' || required_table) is null;

  if missing_tables is not null then
    raise exception
      'Training resource migration is incomplete; missing tables: %',
      missing_tables;
  end if;

  if exists (
    select 1
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname in (
        'training_role',
        'training_topic',
        'training_resource',
        'training_resource_role'
      )
      and not pg_class.relrowsecurity
  ) then
    raise exception 'Training resource RLS is not enabled on every table';
  end if;

  select array_agg(required_policy order by required_policy)
    into missing_policies
  from unnest(array[
    'training_role_select_authenticated',
    'training_role_admin_write',
    'training_topic_select_authenticated',
    'training_topic_admin_write',
    'training_resource_select_authenticated',
    'training_resource_admin_write',
    'training_resource_role_select_authenticated',
    'training_resource_role_admin_write'
  ]) required_policy
  where not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and policyname = required_policy
  );

  if missing_policies is not null then
    raise exception
      'Training resource migration is incomplete; missing policies: %',
      missing_policies;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'training_role',
        'training_topic',
        'training_resource',
        'training_resource_role'
      )
      and 'service_role' = any (roles)
  ) then
    raise exception
      'Service-role training writes must be constrained by column privileges, not an RLS bypass policy';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.training_resource',
    'SELECT'
  ) then
    raise exception 'Service role cannot read training resources for deduplication';
  end if;

  if has_table_privilege(
    'service_role',
    'public.training_resource',
    'INSERT'
  ) or has_table_privilege(
    'service_role',
    'public.training_resource_role',
    'INSERT'
  ) or has_table_privilege(
    'service_role',
    'public.training_resource',
    'UPDATE'
  ) or has_table_privilege(
    'service_role',
    'public.training_resource',
    'DELETE'
  ) then
    raise exception 'Service role can update or delete training resources';
  end if;

  if has_column_privilege(
    'service_role',
    'public.training_resource',
    'title',
    'INSERT'
  ) then
    raise exception 'Service role can bypass the review-candidate RPC';
  end if;

  select enum_range(null::public.training_resource_type)::text[]
    into resource_type_values;
  if resource_type_values <> array['video', 'course', 'doc'] then
    raise exception
      'Unexpected training resource types: %',
      resource_type_values;
  end if;

  select enum_range(null::public.training_resource_level)::text[]
    into resource_level_values;
  if resource_level_values <> array['intro', 'deep-dive'] then
    raise exception
      'Unexpected training resource levels: %',
      resource_level_values;
  end if;

  select enum_range(null::public.training_resource_status)::text[]
    into resource_status_values;
  if resource_status_values <> array['review', 'published', 'archived'] then
    raise exception
      'Unexpected training resource statuses: %',
      resource_status_values;
  end if;
end
$$;

create temporary table training_resource_contract_context (
  admin_id uuid not null,
  topic_id uuid not null,
  role_id uuid not null,
  review_resource_id uuid not null,
  published_resource_id uuid not null
) on commit drop;

do $$
declare
  selected_admin_id uuid;
  selected_topic_id uuid;
  selected_role_id uuid;
  selected_review_id uuid;
  selected_published_id uuid;
begin
  select up.id
    into selected_admin_id
  from public.user_profiles up
  join public.users_auth ua on ua.auth_user_id = up.id
  join public.people p on p.id = ua.person_id
  where up.is_admin is true
    and p.status = 'active'
  order by up.id
  limit 1;

  if selected_admin_id is null then
    raise exception
      'Training RLS contract test requires at least one user_profiles.is_admin row';
  end if;

  insert into public.training_topic (slug, name)
  values ('training-contract-test', 'Training Contract Test')
  returning id into selected_topic_id;

  insert into public.training_role (slug, name, aliases)
  values ('training-contract-tester', 'Training Contract Tester', array['QA'])
  returning id into selected_role_id;

  insert into public.training_role (slug, name)
  values (
    'training-contract-published-retag',
    'Published Retag Must Fail'
  );

  insert into public.training_resource (
    topic_id,
    title,
    url,
    resource_type,
    level,
    track,
    status
  )
  values (
    selected_topic_id,
    'Review Contract Resource',
    'https://example.com/training-contract-review',
    'doc',
    'intro',
    'quality_assurance',
    'review'
  )
  returning id into selected_review_id;

  insert into public.training_resource (
    topic_id,
    title,
    url,
    resource_type,
    level,
    track,
    status,
    published_at
  )
  values (
    selected_topic_id,
    'Published Contract Resource',
    'https://example.com/training-contract-published',
    'video',
    'deep-dive',
    'quality_assurance',
    'published',
    now()
  )
  returning id into selected_published_id;

  insert into public.training_resource_role (resource_id, role_id)
  values
    (selected_review_id, selected_role_id),
    (selected_published_id, selected_role_id);

  insert into training_resource_contract_context values (
    selected_admin_id,
    selected_topic_id,
    selected_role_id,
    selected_review_id,
    selected_published_id
  );

  begin
    insert into public.training_resource (
      topic_id,
      title,
      url,
      resource_type,
      level,
      track,
      status,
      cost
    )
    values (
      selected_topic_id,
      'Paid Resource Must Fail',
      'https://example.com/paid-training-contract-test',
      'course',
      'deep-dive',
      'quality_assurance',
      'review',
      'paid'
    );

    raise exception 'Free-only constraint did not reject a paid resource';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.training_resource (
      topic_id,
      title,
      url,
      resource_type,
      level,
      track,
      status
    )
    values (
      selected_topic_id,
      'Duplicate URL Must Fail',
      'https://example.com/training-contract-review',
      'doc',
      'intro',
      'quality_assurance',
      'review'
    );

    raise exception 'URL uniqueness did not reject a duplicate resource';
  exception
    when unique_violation then null;
  end;

  begin
    insert into public.training_resource (
      topic_id,
      title,
      url,
      resource_type,
      level,
      track,
      status
    )
    values (
      selected_topic_id,
      'Invalid Track Must Fail',
      'https://example.com/invalid-track-contract-test',
      'doc',
      'intro',
      'Invalid Track',
      'review'
    );

    raise exception 'Track domain did not reject a non-normalized value';
  exception
    when check_violation then null;
  end;

  begin
    update public.training_resource
    set status = 'published'
    where id = selected_review_id;

    raise exception
      'Publish audit constraint accepted a row without published_at';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.training_role (slug, name, aliases)
    values (
      'training-contract-whitespace-alias',
      'Whitespace Alias Must Fail',
      array['   ']
    );

    raise exception 'Role aliases accepted a whitespace-only value';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.training_role (slug, name, aliases)
    values (
      'training-contract-null-alias',
      'Null Alias Must Fail',
      array[null]::text[]
    );

    raise exception 'Role aliases accepted a null element';
  exception
    when check_violation then null;
  end;
end
$$;

-- An ordinary authenticated user sees the published fixture and its role tag,
-- cannot see the review fixture, and cannot write.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    gen_random_uuid()::text,
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  visible_resource_count integer;
  visible_role_link_count integer;
  selected_topic_id uuid;
begin
  select count(*)
    into visible_resource_count
  from public.training_resource
  where url like 'https://example.com/training-contract-%';

  if visible_resource_count <> 1 then
    raise exception
      'Ordinary authenticated user saw % training contract resources; expected 1 published row',
      visible_resource_count;
  end if;

  select count(*)
    into visible_role_link_count
  from public.training_resource_role
  where role_id = (
    select id
    from public.training_role
    where slug = 'training-contract-tester'
  );

  if visible_role_link_count <> 1 then
    raise exception
      'Ordinary authenticated user saw % role links; expected 1 published link',
      visible_role_link_count;
  end if;

  select id
    into selected_topic_id
  from public.training_topic
  where slug = 'training-contract-test';

  begin
    insert into public.training_resource (
      topic_id,
      title,
      url,
      resource_type,
      level,
      track
    )
    values (
      selected_topic_id,
      'Unauthorized Learner Write',
      'https://example.com/training-contract-unauthorized',
      'doc',
      'intro',
      'quality_assurance'
    );

    raise exception 'Ordinary authenticated user inserted a resource';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.create_training_review_candidate(
      p_topic_id => selected_topic_id,
      p_title => 'Unauthorized Learner RPC',
      p_url => 'https://example.com/training-contract-unauthorized-rpc',
      p_resource_type => 'doc',
      p_level => 'intro',
      p_track => 'quality_assurance'
    );

    raise exception 'Ordinary authenticated user executed the service RPC';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;

-- An app admin can read every status and publish through authenticated RLS.
-- The test uses a real admin UUID so every review/publish audit FK is exercised.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (select admin_id::text from training_resource_contract_context),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  visible_resource_count integer;
  selected_review_id uuid;
begin
  select count(*)
    into visible_resource_count
  from public.training_resource
  where url like 'https://example.com/training-contract-%';

  if visible_resource_count <> 2 then
    raise exception
      'App admin saw % training contract resources; expected review and published rows',
      visible_resource_count;
  end if;

  select id
    into selected_review_id
  from public.training_resource
  where url = 'https://example.com/training-contract-review';

  perform public.review_training_resource_candidate_locked(
    p_resource_id => selected_review_id,
    p_decision => 'publish',
    p_reason_codes => array['field_applicable', 'right_depth'],
    p_ratings => '{"relevance": 5, "depth": 4, "quality": 4}'::jsonb,
    p_notes => 'Strong field applicability and appropriate instructional depth.'
  );

  if not exists (
    select 1
    from public.training_resource
    where id = selected_review_id
      and status = 'published'
      and reviewed_by = auth.uid()
      and published_by = auth.uid()
      and exists (
        select 1
        from public.training_resource_feedback feedback
        where feedback.resource_id = selected_review_id
          and feedback.decision = 'publish'
          and 'field_applicable' = any(feedback.reason_codes)
      )
  ) then
    raise exception 'App admin could not publish and audit a review row';
  end if;
end
$$;

reset role;

-- The newly published row immediately appears through the learner RLS path,
-- while the same ordinary caller still cannot archive it.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    gen_random_uuid()::text,
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  visible_resource_count integer;
  selected_review_id uuid;
  affected_resource_count integer;
begin
  select count(*)
    into visible_resource_count
  from public.training_resource
  where url like 'https://example.com/training-contract-%';

  if visible_resource_count <> 2 then
    raise exception
      'Ordinary authenticated user saw % training contract resources after publish; expected 2 published rows',
      visible_resource_count;
  end if;

  select id
    into selected_review_id
  from public.training_resource
  where url = 'https://example.com/training-contract-review';

  update public.training_resource
  set status = 'archived'
  where id = selected_review_id;
  get diagnostics affected_resource_count = row_count;

  if affected_resource_count <> 0 then
    raise exception 'Ordinary authenticated user archived a published resource';
  end if;
end
$$;

reset role;

-- The app admin can archive the same resource after publication.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    (select admin_id::text from training_resource_contract_context),
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  selected_review_id uuid;
begin
  select id
    into selected_review_id
  from public.training_resource
  where url = 'https://example.com/training-contract-review';

  update public.training_resource
  set
    status = 'archived',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    published_at = null,
    published_by = null,
    updated_by = auth.uid()
  where id = selected_review_id
    and status = 'published';

  if not exists (
    select 1
    from public.training_resource
    where id = selected_review_id
      and status = 'archived'
      and reviewed_by = auth.uid()
      and published_at is null
      and published_by is null
  ) then
    raise exception 'App admin could not archive and audit the published row';
  end if;
end
$$;

reset role;

-- A service-role job can create only a default-review candidate and atomically
-- attach existing roles through the RPC. Direct insert, retag, publish, update,
-- and delete attempts fail.
set local role service_role;

do $$
declare
  selected_topic_id uuid;
  selected_role_id uuid;
  selected_published_id uuid;
  selected_retag_role_id uuid;
  candidate_id uuid;
  candidate_status public.training_resource_status;
begin
  select id
    into selected_topic_id
  from public.training_topic
  where slug = 'training-contract-test';

  select id
    into selected_role_id
  from public.training_role
  where slug = 'training-contract-tester';

  select id
    into selected_published_id
  from public.training_resource
  where url = 'https://example.com/training-contract-published';

  select id
    into selected_retag_role_id
  from public.training_role
  where slug = 'training-contract-published-retag';

  select public.create_training_review_candidate(
    p_topic_id => selected_topic_id,
    p_title => 'Service Review Candidate',
    p_url => 'https://example.com/training-contract-service-review',
    p_resource_type => 'course',
    p_level => 'intro',
    p_track => 'quality_assurance',
    p_role_ids => array[selected_role_id]
  )
  into candidate_id;

  select status
    into candidate_status
  from public.training_resource
  where id = candidate_id;

  if candidate_status <> 'review' then
    raise exception
      'Service candidate defaulted to %, expected review',
      candidate_status;
  end if;

  if not exists (
    select 1
    from public.training_resource_role
    where resource_id = candidate_id
      and role_id = selected_role_id
  ) then
    raise exception 'Review-candidate RPC did not attach the requested role';
  end if;

  begin
    insert into public.training_resource (
      topic_id,
      title,
      url,
      resource_type,
      level,
      track,
      status
    )
    values (
      selected_topic_id,
      'Service Publish Must Fail',
      'https://example.com/training-contract-service-publish',
      'course',
      'intro',
      'quality_assurance',
      'published'
    );

    raise exception 'Service role inserted an explicitly published resource';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.training_resource_role (resource_id, role_id)
    values (selected_published_id, selected_retag_role_id);

    raise exception 'Service role retagged an existing published resource';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.training_resource
    set status = 'published', published_at = now()
    where id = candidate_id;

    raise exception 'Service role updated a review candidate';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.training_resource
    where id = candidate_id;

    raise exception 'Service role deleted a review candidate';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
rollback;
