const projectRef = process.env.SUPABASE_PROJECT_REF ?? "lgveqfnpkxvzbnnwuled";
const accessToken =
  process.env.SUPABASE_ACCESS_TOKEN ??
  process.env.SUPABASE_MANAGEMENT_API_TOKEN;

if (!accessToken) {
  throw new Error(
    "Training freshness verification blocked: SUPABASE_ACCESS_TOKEN or SUPABASE_MANAGEMENT_API_TOKEN is required.",
  );
}

const sql = String.raw`
begin;

do $verify$
declare
  resource_id uuid;
  admin_id uuid;
  fingerprint text := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  archive_fingerprint text := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  first_check_id uuid;
  second_check_id uuid;
  archive_check_id uuid;
  archive_second_check_id uuid;
  decision text;
  status_before text;
  status_after text;
  check_status text;
  check_notes text;
  resource_notes text;
begin
  if not has_table_privilege(
    'service_role',
    'public.training_resource_freshness_checks',
    'SELECT'
  ) or has_table_privilege(
    'service_role',
    'public.training_resource_freshness_checks',
    'INSERT,UPDATE,DELETE'
  ) then
    raise exception 'service_role freshness table ACL is not read-only';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.record_training_resource_freshness_check(uuid,text,text,text,integer,text,text,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.record_training_resource_freshness_check(uuid,text,text,text,integer,text,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'freshness recorder RPC ACL is incorrect';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.review_training_resource_freshness_check(uuid,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.review_training_resource_freshness_check(uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'freshness reviewer RPC ACL is incorrect';
  end if;

  select id, status
  into resource_id, status_before
  from public.training_resource
  where status = 'published'
  order by id
  limit 1;

  select id
  into admin_id
  from public.user_profiles
  where is_admin is true
  order by id
  limit 1;

  if resource_id is null or admin_id is null then
    raise exception 'verification requires one published resource and one app admin';
  end if;

  first_check_id := public.record_training_resource_freshness_check(
    resource_id,
    'unavailable',
    fingerprint,
    'archive',
    410,
    'https://example.com/removed-training-source',
    null,
    '{"verification":true}'::jsonb
  );
  second_check_id := public.record_training_resource_freshness_check(
    resource_id,
    'unavailable',
    fingerprint,
    'archive',
    410,
    'https://example.com/removed-training-source',
    null,
    '{"verification":true}'::jsonb
  );

  select review_status
  into check_status
  from public.training_resource_freshness_checks
  where id = first_check_id;

  select status
  into status_after
  from public.training_resource
  where id = resource_id;

  if first_check_id <> second_check_id
    or check_status <> 'pending'
    or status_before <> 'published'
    or status_after <> 'published'
  then
    raise exception 'automation did not dedupe, promote, and preserve the published source';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  decision := public.review_training_resource_freshness_check(
    first_check_id,
    'keep',
    'Verified false positive; keep the approved resource.'
  );

  select review_status, reviewer_notes
  into check_status, check_notes
  from public.training_resource_freshness_checks
  where id = first_check_id;

  execute 'reset role';

  select status, reviewer_notes
  into status_after, resource_notes
  from public.training_resource
  where id = resource_id;

  if decision <> 'keep'
    or check_status <> 'rejected'
    or check_notes <> 'Verified false positive; keep the approved resource.'
    or status_after <> 'published'
    or resource_notes <> 'Verified false positive; keep the approved resource.'
  then
    raise exception 'keep feedback was not bridged atomically to the canonical resource';
  end if;

  archive_check_id := public.record_training_resource_freshness_check(
    resource_id,
    'unavailable',
    archive_fingerprint,
    'archive',
    410,
    'https://example.com/removed-training-source-mirror',
    null,
    '{"verification":"archive-feedback"}'::jsonb
  );
  archive_second_check_id := public.record_training_resource_freshness_check(
    resource_id,
    'unavailable',
    archive_fingerprint,
    'archive',
    410,
    'https://example.com/removed-training-source-mirror',
    null,
    '{"verification":"archive-feedback"}'::jsonb
  );

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  decision := public.review_training_resource_freshness_check(
    archive_check_id,
    'archive',
    'The source is unavailable; find a current replacement mirror.'
  );

  select review_status, reviewer_notes
  into check_status, check_notes
  from public.training_resource_freshness_checks
  where id = archive_check_id;

  execute 'reset role';

  select status, reviewer_notes
  into status_after, resource_notes
  from public.training_resource
  where id = resource_id;

  if archive_check_id <> archive_second_check_id
    or decision <> 'archive'
    or check_status <> 'accepted'
    or check_notes <> 'The source is unavailable; find a current replacement mirror.'
    or status_after <> 'archived'
    or resource_notes <> 'The source is unavailable; find a current replacement mirror.'
  then
    raise exception 'archive feedback was not bridged atomically to the canonical resource';
  end if;
end
$verify$;

rollback;
`;

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

if (!response.ok) {
  const detail = (await response.text()).slice(0, 800);
  throw new Error(
    `Training freshness live contract verification failed (${response.status}): ${detail}`,
  );
}

console.log(
  "Training freshness live contract passed: service/admin ACL, dedupe, second-observation promotion, source immutability, keep/archive feedback bridge, and rollback.",
);
