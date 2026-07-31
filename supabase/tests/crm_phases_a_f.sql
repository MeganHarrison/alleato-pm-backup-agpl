begin;

set local search_path = public, extensions;

select plan(45);

select has_table('public'::name, 'crm_microsoft_connections'::name);
select has_table('public'::name, 'crm_forecast_snapshots'::name);
select has_table('public'::name, 'crm_stage_requirements'::name);
select has_table('public'::name, 'crm_sales_assets'::name);
select has_table('public'::name, 'crm_relationship_intelligence'::name);
select has_table('public'::name, 'crm_ai_artifacts'::name);

select col_type_is(
  'public'::name,
  'crm_deals'::name,
  'forecast_category'::name,
  'text'::text
);
select col_type_is(
  'public'::name,
  'crm_deals'::name,
  'pursuit_type'::name,
  'text'::text
);
select col_type_is(
  'public'::name,
  'crm_deals'::name,
  'bid_due_date'::name,
  'timestamp with time zone'::text
);
select col_type_is(
  'public'::name,
  'crm_deals'::name,
  'qualification_score'::name,
  'integer'::text
);
select col_type_is(
  'public'::name,
  'crm_deals'::name,
  'win_loss_notes'::name,
  'text'::text
);

select has_check(
  'public'::name,
  'crm_microsoft_connections'::name,
  'crm_microsoft_connection_truth'::name
);
select has_check(
  'public'::name,
  'crm_microsoft_connections'::name,
  'crm_microsoft_automatic_matching_truth'::name
);
select has_check(
  'public'::name,
  'crm_relationship_intelligence'::name,
  'crm_relationship_intelligence_target'::name
);

select policies_are(
  'public',
  'crm_microsoft_connections',
  array[
    'crm_microsoft_connections_owner_preferences',
    'crm_microsoft_connections_owner_read',
    'crm_microsoft_connections_owner_update_preferences',
    'crm_microsoft_connections_service'
  ]
);
select policies_are(
  'public',
  'crm_forecast_snapshots',
  array['crm_forecast_snapshots_admin', 'crm_forecast_snapshots_read']
);
select policies_are(
  'public',
  'crm_stage_requirements',
  array['crm_stage_requirements_admin', 'crm_stage_requirements_read']
);
select policies_are(
  'public',
  'crm_sales_assets',
  array[
    'crm_sales_assets_owner_update',
    'crm_sales_assets_read',
    'crm_sales_assets_write'
  ]
);
select policies_are(
  'public',
  'crm_relationship_intelligence',
  array[
    'crm_relationship_intelligence_owner_update',
    'crm_relationship_intelligence_read',
    'crm_relationship_intelligence_write'
  ]
);
select policies_are(
  'public',
  'crm_ai_artifacts',
  array[
    'crm_ai_artifacts_owner_update',
    'crm_ai_artifacts_read',
    'crm_ai_artifacts_write'
  ]
);

select has_index(
  'public'::name,
  'crm_forecast_snapshots'::name,
  'crm_forecast_snapshots_week_idx'::name
);
select has_index(
  'public'::name,
  'crm_relationship_intelligence'::name,
  'crm_relationship_intelligence_company_idx'::name
);
select has_index(
  'public'::name,
  'crm_ai_artifacts'::name,
  'crm_ai_artifacts_deal_idx'::name
);

select ok(
  (select count(*) > 0 from public.crm_stage_requirements),
  'default stage exit criteria are seeded'
);
select ok(
  (
    select count(*) >= 3
    from public.crm_sales_assets
    where approval_status = 'approved'
  ),
  'approved starter cadence, playbook, and template are seeded'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.crm_microsoft_connections
    where connection_status = 'connected'
      and not mail_connected
      and not calendar_connected
  $$,
  $$ values (0::bigint) $$,
  'connection state cannot claim a connection without a granted capability'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.crm_relationship_intelligence',
    'SELECT'
  ),
  'authenticated CRM users can read permitted relationship intelligence'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.crm_sales_assets',
    'DELETE'
  ),
  'CRM writers cannot delete governed sales assets'
);
select ok(
  has_table_privilege(
    'service_role',
    'public.crm_microsoft_connections',
    'UPDATE'
  ),
  'the integration service can update verified Microsoft health state'
);
select ok(
  has_column_privilege(
    'authenticated',
    'public.crm_microsoft_connections',
    'privacy_mode',
    'UPDATE'
  ),
  'CRM users can update their Microsoft privacy preference'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_microsoft_connections',
    'connection_status',
    'UPDATE'
  ),
  'CRM users cannot forge Microsoft connection health'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_microsoft_connections',
    'granted_scopes',
    'UPDATE'
  ),
  'CRM users cannot forge granted Microsoft scopes'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_deals',
    'stage_id',
    'UPDATE'
  ),
  'CRM writers cannot bypass governed stage transitions'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_deals',
    'status',
    'UPDATE'
  ),
  'CRM writers cannot bypass governed deal closure'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_relationship_intelligence',
    'reviewed_by_person_id',
    'INSERT'
  ),
  'CRM writers cannot forge relationship review attribution'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_relationship_intelligence',
    'status',
    'UPDATE'
  ),
  'CRM writers cannot approve relationship intelligence directly'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_ai_artifacts',
    'reviewed_by_person_id',
    'INSERT'
  ),
  'CRM writers cannot forge AI review attribution'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_ai_artifacts',
    'review_status',
    'UPDATE'
  ),
  'CRM writers cannot apply AI output directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.crm_capture_forecast_snapshot(uuid)',
    'EXECUTE'
  ),
  'only the service can execute the forecast replacement function'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.crm_capture_forecast_snapshot(uuid)',
    'EXECUTE'
  ),
  'the CRM API service can execute the forecast replacement function'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_deals',
    'status',
    'INSERT'
  ),
  'CRM writers cannot create an already-closed deal'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_deals',
    'closed_at',
    'INSERT'
  ),
  'CRM writers cannot supply deal closure metadata at creation'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.crm_deals',
    'project_id',
    'INSERT'
  ),
  'CRM writers cannot create a deal with a forged project link'
);
select has_trigger(
  'public'::name,
  'crm_deals'::name,
  'crm_deals_creation_guard'::name,
  'new deals have a database stage-governance trigger'
);

create temporary table crm_deal_creation_guard_probe (
  stage_id uuid,
  pipeline_id uuid,
  status text,
  closed_at timestamptz,
  lost_reason text,
  project_id bigint,
  project_sync_status text,
  row_version integer,
  archived_at timestamptz
);
create trigger crm_deal_creation_guard_probe_trigger
before insert on crm_deal_creation_guard_probe
for each row execute function public.crm_guard_new_deal();
select throws_ok(
  $$
    insert into crm_deal_creation_guard_probe (stage_id, pipeline_id)
    select stage.id, stage.pipeline_id
    from public.crm_stages stage
    where stage.stage_type in ('won', 'lost')
      and stage.archived_at is null
    limit 1
  $$,
  '23514',
  'New CRM deals must begin in an active open stage in the selected pipeline.',
  'a terminal stage is rejected at the database boundary'
);

select * from finish();
rollback;
