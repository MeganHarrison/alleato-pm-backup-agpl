begin;

set local search_path = public, extensions;

select plan(54);

select has_table('public'::name, 'crm_leads'::name);
select col_type_is('public'::name, 'crm_leads'::name, 'id'::name, 'uuid'::text);
select col_type_is('public'::name, 'crm_leads'::name, 'full_name'::name, 'text'::text);
select col_type_is('public'::name, 'crm_leads'::name, 'prospect_company_name'::name, 'text'::text);
select col_not_null('public'::name, 'crm_leads'::name, 'full_name'::name);
select has_function('public'::name, 'crm_apply_lead_research'::name, array['uuid'::name, 'uuid'::name, 'integer'::name]);
select col_type_is('public'::name, 'crm_ai_artifacts'::name, 'suggestions'::name, 'jsonb'::text);
select col_type_is(
  'public'::name,
  'crm_deals'::name,
  'lead_id'::name,
  'uuid'::text
);
select col_type_is(
  'public'::name,
  'crm_activities'::name,
  'lead_id'::name,
  'uuid'::text
);
select col_type_is(
  'public'::name,
  'tasks'::name,
  'crm_lead_id'::name,
  'uuid'::text
);
select col_type_is(
  'public'::name,
  'tasks'::name,
  'source_type'::name,
  'text'::text
);
select col_type_is(
  'public'::name,
  'tasks'::name,
  'source_url'::name,
  'text'::text
);

select col_is_null(
  'public'::name,
  'crm_deals'::name,
  'company_id'::name,
  'lead-backed deals do not require a company'
);
select col_is_null(
  'public'::name,
  'crm_activities'::name,
  'company_id'::name,
  'lead-backed activities do not require a company'
);

select has_check(
  'public'::name,
  'crm_deals'::name,
  'crm_deals_relationship_target_check'::name
);
select has_check(
  'public'::name,
  'crm_activities'::name,
  'crm_activities_relationship_target_check'::name
);

select policies_are(
  'public',
  'crm_leads',
  array['crm_leads_insert', 'crm_leads_read', 'crm_leads_update']
);
select matches(
  (
    select with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_deals'
      and policyname = 'crm_deals_insert'
  ),
  '.*crm_leads.*',
  'deal insert policy verifies the selected lead owner'
);
select matches(
  (
    select with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_deals'
      and policyname = 'crm_deals_update'
  ),
  '.*crm_account_profiles.*',
  'deal update policy verifies the selected account owner'
);

select has_index(
  'public'::name,
  'crm_leads'::name,
  'crm_leads_owner_status_idx'::name
);

select has_function(
  'public'::name,
  'crm_evaluate_lead'::name,
  array['uuid'::name]
);
select has_function(
  'public'::name,
  'crm_convert_lead_to_company'::name,
  array['uuid'::name, 'uuid'::name, 'integer'::name]
);

select ok(
  has_column_privilege(
    'authenticated',
    'public.crm_leads',
    'prospect_company_name',
    'UPDATE'
  ),
  'CRM writers can update user-owned lead details'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_leads',
    'health_status',
    'UPDATE'
  ),
  'CRM writers cannot directly update lead health system fields'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_leads',
    'converted_company_id',
    'UPDATE'
  ),
  'CRM writers cannot directly update lead conversion system fields'
);
select ok(
  has_column_privilege(
    'authenticated',
    'public.crm_leads',
    'prospect_company_name',
    'INSERT'
  ),
  'CRM writers can insert user-owned lead details'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_leads',
    'status',
    'INSERT'
  ),
  'CRM writers cannot insert lead conversion system fields'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_leads',
    'converted_at',
    'INSERT'
  ),
  'CRM writers cannot insert conversion timestamps'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_leads',
    'health_status',
    'INSERT'
  ),
  'CRM writers cannot insert lead health fields'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_leads',
    'row_version',
    'INSERT'
  ),
  'CRM writers cannot insert concurrency state'
);

insert into public.crm_leads (
  id,
  full_name,
  prospect_company_name,
  owner_person_id
)
select
  '00000000-0000-0000-0000-000000005201'::uuid,
  'ALL-52 pgTAP person',
  'ALL-52 pgTAP lead',
  p.id
from public.people p
where p.auth_user_id is not null
  and p.status = 'active'
order by p.id
limit 1;

insert into public.crm_activities (
  company_id,
  lead_id,
  activity_type,
  subject,
  occurred_at,
  created_by_person_id,
  record_origin,
  visibility_scope
)
select
  null,
  l.id,
  'call',
  'ALL-52 health check',
  now(),
  l.owner_person_id,
  'manual',
  'standard'
from public.crm_leads l
where l.id = '00000000-0000-0000-0000-000000005201'::uuid;

select results_eq(
  $$
    select health_status
    from public.crm_leads
    where id = '00000000-0000-0000-0000-000000005201'::uuid
  $$,
  $$ values ('active'::text) $$,
  'meaningful lead activity updates lead health'
);

create temp table all52_conversion_fixture on commit drop as
select
  p.id as owner_person_id,
  companies.ids[1] as company_id,
  companies.ids[2] as other_company_id,
  pipeline.id as pipeline_id,
  stage.id as stage_id,
  0::integer as expected_row_version
from (
  select person.id
  from public.people person
  where person.auth_user_id is not null
    and person.status = 'active'
  order by person.id
  limit 1
) p
cross join lateral (
  select array[
    (
      select company.id
      from public.companies company
      where not exists (
        select 1
        from public.crm_account_profiles profile
        where profile.company_id = company.id
      )
      order by company.id
      limit 1
    ),
    (
      select company.id
      from public.companies company
      where company.id <> (
        select unprofiled.id
        from public.companies unprofiled
        where not exists (
          select 1
          from public.crm_account_profiles profile
          where profile.company_id = unprofiled.id
        )
        order by unprofiled.id
        limit 1
      )
      order by company.id
      limit 1
    )
  ]::uuid[] as ids
) companies
cross join lateral (
  select id
  from public.crm_pipelines
  where archived_at is null
  order by is_default desc, id
  limit 1
) pipeline
cross join lateral (
  select id
  from public.crm_stages
  where pipeline_id = pipeline.id
    and stage_type = 'open'
    and archived_at is null
  order by sort_order, id
  limit 1
) stage;

insert into public.crm_account_profiles (
  company_id,
  lifecycle_stage,
  owner_person_id
)
select
  company_id,
  'lead',
  owner_person_id
from all52_conversion_fixture;

insert into public.crm_leads (
  id,
  full_name,
  prospect_company_name,
  owner_person_id
)
select
  '00000000-0000-0000-0000-000000005202'::uuid,
  'ALL-52 conversion person',
  'ALL-52 conversion lead',
  owner_person_id
from all52_conversion_fixture;

insert into public.crm_deals (
  id,
  name,
  company_id,
  lead_id,
  pipeline_id,
  stage_id,
  owner_person_id,
  value_estimate,
  probability
)
select
  '00000000-0000-0000-0000-000000005203'::uuid,
  'ALL-52 conversion deal',
  null,
  '00000000-0000-0000-0000-000000005202'::uuid,
  pipeline_id,
  stage_id,
  owner_person_id,
  100,
  10
from all52_conversion_fixture;

insert into public.crm_activities (
  id,
  company_id,
  lead_id,
  activity_type,
  subject,
  occurred_at,
  created_by_person_id,
  record_origin,
  visibility_scope
)
select
  '00000000-0000-0000-0000-000000005204'::uuid,
  null,
  '00000000-0000-0000-0000-000000005202'::uuid,
  'call',
  'ALL-52 conversion activity',
  now(),
  owner_person_id,
  'manual',
  'standard'
from all52_conversion_fixture;

insert into public.tasks (
  id,
  title,
  description,
  crm_lead_id,
  source_system,
  source_type,
  source_url,
  status
)
values (
  '00000000-0000-0000-0000-000000005205'::uuid,
  'Call conversion lead',
  'ALL-52 conversion follow-up',
  '00000000-0000-0000-0000-000000005202'::uuid,
  'crm',
  'crm_follow_up',
  '/crm/leads/00000000-0000-0000-0000-000000005202',
  'open'
);

update all52_conversion_fixture
set expected_row_version = (
  select row_version
  from public.crm_leads
  where id = '00000000-0000-0000-0000-000000005202'::uuid
);

select set_config(
  'app.all52_person_id',
  owner_person_id::text,
  true
)
from all52_conversion_fixture;

create or replace function public.current_person_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.all52_person_id', true), '')::uuid
$$;

create or replace function public.current_has_company_module_permission(
  p_module text,
  p_required_level text
)
returns boolean
language sql
stable
as $$
  select p_module = 'crm'
    and p_required_level in ('read', 'write')
$$;

select ok(
  has_function_privilege('authenticated', 'public.crm_apply_lead_research(uuid, uuid, integer)', 'EXECUTE'),
  'authenticated CRM users can execute the guarded research apply function'
);
select ok(
  not has_function_privilege('anon', 'public.crm_apply_lead_research(uuid, uuid, integer)', 'EXECUTE'),
  'anonymous users cannot execute the research apply function'
);

insert into public.crm_leads (
  id, full_name, prospect_company_name, owner_person_id,
  linkedin_url, facebook_url, x_url
)
select
  '00000000-0000-0000-0000-000000005210'::uuid,
  'Research Person',
  'Original Prospect Company',
  owner_person_id,
  'https://www.linkedin.com/in/manual-profile',
  'https://www.facebook.com/manual-profile',
  'https://x.com/manual-profile'
from all52_conversion_fixture;

insert into public.crm_ai_artifacts (
  id, artifact_type, lead_id, title, content, citations,
  suggestions, explanation, review_status, created_by_person_id
)
select
  '00000000-0000-0000-0000-000000005211'::uuid,
  'lead_research',
  '00000000-0000-0000-0000-000000005210'::uuid,
  'Cited lead research',
  'Public source summary',
  '[{"title":"Company source","url":"https://example.com"}]'::jsonb,
  '{"prospect_company_name":"Researched Company","job_title":"President","website_url":"https://example.com"}'::jsonb,
  'Review before applying.',
  'draft',
  owner_person_id
from all52_conversion_fixture;

select lives_ok(
  $$
    select public.crm_apply_lead_research(
      '00000000-0000-0000-0000-000000005210'::uuid,
      '00000000-0000-0000-0000-000000005211'::uuid,
      (select row_version from public.crm_leads where id = '00000000-0000-0000-0000-000000005210'::uuid)
    )
  $$,
  'owner can explicitly apply a cited lead research draft'
);
select results_eq(
  $$
    select prospect_company_name, job_title, website_url,
           linkedin_url, facebook_url, x_url
    from public.crm_leads
    where id = '00000000-0000-0000-0000-000000005210'::uuid
  $$,
  $$ values (
    'Researched Company'::text,
    'President'::text,
    'https://example.com'::text,
    'https://www.linkedin.com/in/manual-profile'::text,
    'https://www.facebook.com/manual-profile'::text,
    'https://x.com/manual-profile'::text
  ) $$,
  'AI applies only whitelisted business fields and preserves manual social URLs'
);
select results_eq(
  $$ select review_status from public.crm_ai_artifacts where id = '00000000-0000-0000-0000-000000005211'::uuid $$,
  $$ values ('applied'::text) $$,
  'applied research records its terminal review state'
);
select throws_ok(
  $$
    select public.crm_apply_lead_research(
      '00000000-0000-0000-0000-000000005210'::uuid,
      '00000000-0000-0000-0000-000000005211'::uuid,
      (select row_version from public.crm_leads where id = '00000000-0000-0000-0000-000000005210'::uuid)
    )
  $$,
  'P0001',
  'Lead research draft was not found or was already reviewed.',
  'an applied research draft cannot be applied twice'
);
insert into public.crm_ai_artifacts (
  id, artifact_type, lead_id, title, content, citations,
  suggestions, explanation, review_status, created_by_person_id
)
select
  '00000000-0000-0000-0000-000000005212'::uuid,
  'lead_research',
  '00000000-0000-0000-0000-000000005210'::uuid,
  'Owner-only research',
  'Public source summary',
  '[{"title":"Company source","url":"https://example.com"}]'::jsonb,
  '{"job_title":"Chief Executive Officer"}'::jsonb,
  'Review before applying.',
  'draft',
  owner_person_id
from all52_conversion_fixture;
select set_config('app.all52_person_id', '00000000-0000-0000-0000-000000009999', true);
select throws_ok(
  $$
    select public.crm_apply_lead_research(
      '00000000-0000-0000-0000-000000005210'::uuid,
      '00000000-0000-0000-0000-000000005212'::uuid,
      (select row_version from public.crm_leads where id = '00000000-0000-0000-0000-000000005210'::uuid)
    )
  $$,
  'P0001',
  null,
  'a non-owner cannot apply lead research'
);
select set_config('app.all52_person_id', owner_person_id::text, true) from all52_conversion_fixture;
insert into public.crm_ai_artifacts (
  id, artifact_type, lead_id, title, content, citations,
  suggestions, explanation, review_status, created_by_person_id
)
select
  '00000000-0000-0000-0000-000000005213'::uuid,
  'lead_research',
  '00000000-0000-0000-0000-000000005210'::uuid,
  'Stale research',
  'Public source summary',
  '[{"title":"Company source","url":"https://example.com"}]'::jsonb,
  '{"job_title":"Executive"}'::jsonb,
  'Review before applying.',
  'draft',
  owner_person_id
from all52_conversion_fixture;
select throws_ok(
  $$
    select public.crm_apply_lead_research(
      '00000000-0000-0000-0000-000000005210'::uuid,
      '00000000-0000-0000-0000-000000005213'::uuid,
      1
    )
  $$,
  'P0001',
  'CRM lead changed. Refresh before applying research.',
  'stale lead research versions fail loudly'
);
select throws_ok(
  $$
    insert into public.crm_ai_artifacts (
      artifact_type, lead_id, title, content, citations, suggestions,
      explanation, review_status, created_by_person_id
    )
    select 'lead_research',
      '00000000-0000-0000-0000-000000005210'::uuid,
      'Malformed research', 'No sources', '[]'::jsonb,
      '{"linkedin_url":"https://linkedin.com/in/not-allowed"}'::jsonb,
      'Invalid', 'draft', owner_person_id
    from all52_conversion_fixture
  $$,
  '23514',
  null,
  'uncited or social-field AI research is rejected by the database'
);
select results_eq(
  $$ select public, file_size_limit from storage.buckets where id = 'crm-lead-photos' $$,
  $$ values (false, 2097152::bigint) $$,
  'lead photo storage remains private with the two megabyte limit'
);
select results_eq(
  $$ select allowed_mime_types from storage.buckets where id = 'crm-lead-photos' $$,
  $$ values (array['image/jpeg', 'image/png', 'image/webp']::text[]) $$,
  'lead photo storage accepts only the supported image MIME types'
);

select throws_ok(
  $$
    select public.crm_convert_lead_to_company(
      '00000000-0000-0000-0000-000000005202'::uuid,
      company_id,
      expected_row_version + 1
    )
    from all52_conversion_fixture
  $$,
  '40001',
  null,
  'stale conversion versions fail loudly'
);

select throws_ok(
  $$
    select public.crm_convert_lead_to_company(
      '00000000-0000-0000-0000-000000005202'::uuid,
      other_company_id,
      expected_row_version
    )
    from all52_conversion_fixture
  $$,
  '23514',
  null,
  'conversion rejects a company outside the compatible CRM account boundary'
);

select lives_ok(
  $$
    select public.crm_convert_lead_to_company(
      '00000000-0000-0000-0000-000000005202'::uuid,
      company_id,
      expected_row_version
    )
    from all52_conversion_fixture
  $$,
  'lead conversion succeeds'
);

select results_eq(
  $$
    select d.company_id, d.lead_id
    from public.crm_deals d
    where d.id = '00000000-0000-0000-0000-000000005203'::uuid
  $$,
  $$
    select company_id, null::uuid
    from all52_conversion_fixture
  $$,
  'lead conversion reparents deals'
);

select results_eq(
  $$
    select a.company_id, a.lead_id
    from public.crm_activities a
    where a.id = '00000000-0000-0000-0000-000000005204'::uuid
  $$,
  $$
    select company_id, null::uuid
    from all52_conversion_fixture
  $$,
  'lead conversion reparents activities'
);

select results_eq(
  $$
    select t.company_id, t.crm_lead_id
    from public.tasks t
    where t.id = '00000000-0000-0000-0000-000000005205'::uuid
  $$,
  $$
    select company_id, null::uuid
    from all52_conversion_fixture
  $$,
  'lead conversion moves tasks to one relationship identity'
);

select lives_ok(
  $$
    select public.crm_convert_lead_to_company(
      '00000000-0000-0000-0000-000000005202'::uuid,
      company_id,
      expected_row_version
    )
    from all52_conversion_fixture
  $$,
  'same-company conversion replay succeeds with the original version'
);

select throws_ok(
  $$
    select public.crm_convert_lead_to_company(
      '00000000-0000-0000-0000-000000005202'::uuid,
      other_company_id,
      expected_row_version
    )
    from all52_conversion_fixture
  $$,
  '23514',
  null,
  'conversion replay to a different company is rejected'
);
select has_index(
  'public'::name,
  'crm_deals'::name,
  'crm_deals_lead_status_idx'::name
);
select has_index(
  'public'::name,
  'crm_activities'::name,
  'crm_activities_lead_occurred_idx'::name
);
select has_index(
  'public'::name,
  'tasks'::name,
  'tasks_crm_lead_due_idx'::name
);

select results_eq(
  $$
    select count(*)::bigint
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'crm_lead_id'
  $$,
  $$ values (0::bigint) $$,
  'native leads do not add CRM identity to ERP-owned companies'
);

select * from finish();
rollback;
