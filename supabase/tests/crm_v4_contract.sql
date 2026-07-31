begin;

set local search_path = public, extensions;

select plan(26);

select has_table('public'::name, 'crm_account_profiles'::name);
select has_table('public'::name, 'crm_activities'::name);
select has_table('public'::name, 'crm_deals'::name);
select has_table('public'::name, 'crm_activity_candidates'::name);
select has_table('public'::name, 'crm_conversion_attempts'::name);

select col_type_is('public'::name, 'crm_account_profiles'::name, 'company_id'::name, 'uuid'::text);
select col_type_is('public'::name, 'crm_deals'::name, 'project_id'::name, 'bigint'::text);
select col_type_is('public'::name, 'crm_activities'::name, 'source_document_id'::name, 'text'::text);
select col_type_is('public'::name, 'tasks'::name, 'company_id'::name, 'uuid'::text);
select col_type_is('public'::name, 'tasks'::name, 'crm_deal_id'::name, 'uuid'::text);
select col_type_is(
  'public'::name,
  'projects'::name,
  'crm_conversion_attempt_id'::name,
  'uuid'::text
);

select has_function('public', 'current_has_company_module_permission', array['text', 'text']);
select has_function('public', 'crm_evaluate_account', array['uuid']);
select has_function(
  'public',
  'crm_transition_deal',
  array['uuid', 'uuid', 'integer', 'uuid', 'text']
);
select has_function(
  'public',
  'crm_complete_conversion',
  array['uuid', 'text']
);
select has_function(
  'public',
  'crm_create_activity_candidate',
  array['text', 'text', 'text', 'text', 'uuid', 'jsonb', 'numeric']
);

select policies_are(
  'public',
  'crm_account_profiles',
  array['crm_profiles_insert', 'crm_profiles_read', 'crm_profiles_update']
);
select policies_are(
  'public',
  'crm_deals',
  array['crm_deals_insert', 'crm_deals_read', 'crm_deals_update']
);
select policies_are(
  'public',
  'crm_activity_contacts',
  array['crm_activity_contacts_read', 'crm_activity_contacts_write']
);
select policies_are(
  'public',
  'crm_deal_contacts',
  array['crm_deal_contacts_read', 'crm_deal_contacts_write']
);
select policies_are(
  'public',
  'crm_deal_documents',
  array['crm_deal_documents_read', 'crm_deal_documents_write']
);

select throws_ok(
  $$
    insert into public.crm_deals (
      name, company_id, pipeline_id, stage_id, owner_person_id,
      status, value_estimate, currency_code, probability
    )
    values (
      'Invalid currency', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      gen_random_uuid(), 'open', 1, 'EUR', 10
    )
  $$,
  '23514',
  null,
  'deal writes require an active internal owner'
);

select results_eq(
  $$ select value from public.crm_settings where key = 'auto_accept_enabled' $$,
  $$ values ('false'::jsonb) $$,
  'automatic communication acceptance defaults off'
);
select results_eq(
  $$ select count(*)::bigint from public.crm_pipelines where is_default $$,
  $$ values (1::bigint) $$,
  'exactly one default pipeline is seeded'
);
select results_eq(
  $$ select count(*)::bigint from public.crm_stages $$,
  $$ values (6::bigint) $$,
  'the v1 pipeline stage set is deterministic'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.permission_templates
    where not coalesce(rules_json, '{}'::jsonb) ? 'crm'
  $$,
  $$ values (0::bigint) $$,
  'all permission templates carry an explicit CRM rule'
);

select * from finish();
rollback;
