begin;

set local search_path = public, extensions;

select plan(64);

select has_table('public'::name, 'recruiting_user_roles'::name);
select has_table('public'::name, 'recruiting_settings'::name);
select has_table('public'::name, 'recruiting_requisitions'::name);
select has_table('public'::name, 'recruiting_requisition_memberships'::name);
select has_table('public'::name, 'recruiting_stage_definitions'::name);
select has_table('public'::name, 'recruiting_candidates'::name);
select has_table('public'::name, 'recruiting_candidate_contacts'::name);
select has_table('public'::name, 'recruiting_applications'::name);
select has_table('public'::name, 'recruiting_application_sources'::name);
select has_table('public'::name, 'recruiting_documents'::name);
select has_table('public'::name, 'recruiting_stage_events'::name);
select has_table('public'::name, 'recruiting_dispositions'::name);
select has_table('public'::name, 'recruiting_activity_events'::name);
select has_table('public'::name, 'recruiting_tasks'::name);
select has_table('public'::name, 'recruiting_command_receipts'::name);

select has_table('public'::name, 'recruiting_interviews'::name);
select has_table('public'::name, 'recruiting_scorecard_submissions'::name);
select has_table('public'::name, 'recruiting_offers'::name);
select has_table('public'::name, 'recruiting_talent_pools'::name);
select has_table('public'::name, 'recruiting_provider_attempts'::name);
select has_table('public'::name, 'recruiting_automation_rules'::name);
select has_table('public'::name, 'recruiting_ai_runs'::name);
select has_table('private'::name, 'recruiting_accommodation_requests'::name);
select has_table('private'::name, 'recruiting_voluntary_demographics'::name);

select has_function('public', 'current_recruiting_person_id', array[]::text[]);
select has_function('public', 'current_recruiting_is_admin', array[]::text[]);
select has_function(
  'public',
  'current_can_access_recruiting_requisition',
  array['uuid']
);
select has_function(
  'public',
  'current_can_access_recruiting_document',
  array['uuid', 'uuid']
);
select has_function(
  'public',
  'current_can_manage_recruiting_document',
  array['uuid', 'uuid']
);
select has_function(
  'public',
  'current_can_access_sensitive_recruiting_application',
  array['uuid']
);
select has_function(
  'public',
  'current_can_access_recruiting_offer',
  array['uuid']
);
select has_function(
  'public',
  'current_can_manage_recruiting_requisition',
  array['uuid']
);
select has_function(
  'public',
  'recruiting_transition_application',
  array['uuid', 'text', 'integer', 'text', 'uuid', 'text']
);
select has_function(
  'public',
  'recruiting_create_requisition',
  array['text', 'text', 'text', 'text', 'text', 'integer', 'boolean', 'uuid', 'text']
);
select has_function(
  'public',
  'recruiting_create_task',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'timestamp with time zone', 'uuid', 'text']
);
select has_function(
  'public',
  'recruiting_requisition_has_linked_records',
  array['uuid']
);
select has_function(
  'public',
  'recruiting_set_requisition_lifecycle',
  array['uuid', 'text', 'integer', 'text', 'uuid', 'text']
);
select has_function(
  'public',
  'recruiting_delete_unused_draft_requisition',
  array['uuid', 'integer', 'uuid', 'text']
);
select has_function(
  'public',
  'recruiting_request_ai_assistance',
  array['text', 'uuid', 'uuid', 'uuid', 'text', 'uuid', 'text']
);

select col_type_is(
  'public'::name,
  'recruiting_applications'::name,
  'row_version'::name,
  'integer'::text
);
select col_not_null(
  'public'::name,
  'recruiting_activity_events'::name,
  'actor_person_id'::name
);
select col_not_null(
  'public'::name,
  'recruiting_command_receipts'::name,
  'request_hash'::name
);

select policies_are(
  'public',
  'recruiting_candidates',
  array[
    'recruiting_candidates_insert',
    'recruiting_candidates_read',
    'recruiting_candidates_update'
  ]
);
select policies_are(
  'public',
  'recruiting_requisition_approvals',
  array[
    'recruiting_requisition_approvals_insert',
    'recruiting_requisition_approvals_read',
    'recruiting_requisition_approvals_update'
  ]
);
select policies_are(
  'public',
  'recruiting_offer_approvals',
  array[
    'recruiting_offer_approvals_insert',
    'recruiting_offer_approvals_read',
    'recruiting_offer_approvals_update'
  ]
);
select policies_are(
  'public',
  'recruiting_applications',
  array[
    'recruiting_applications_insert',
    'recruiting_applications_read',
    'recruiting_applications_update'
  ]
);
select policies_are(
  'public',
  'recruiting_activity_events',
  array[
    'recruiting_activity_events_insert',
    'recruiting_activity_events_read'
  ]
);

select results_eq(
  $$
    select value
    from public.recruiting_settings
    where key = 'ai_enabled'
  $$,
  $$ values ('false'::jsonb) $$,
  'employment AI defaults disabled'
);
select results_eq(
  $$
    select value
    from public.recruiting_settings
    where key = 'provider_delivery_enabled'
  $$,
  $$ values ('false'::jsonb) $$,
  'provider delivery defaults disabled'
);
select results_eq(
  $$
    select value
    from public.recruiting_settings
    where key = 'retention_deletion_enabled'
  $$,
  $$ values ('false'::jsonb) $$,
  'destructive retention defaults disabled'
);
select results_eq(
  $$
    select value
    from public.recruiting_settings
    where key = 'ai_evaluation_approved'
  $$,
  $$ values ('false'::jsonb) $$,
  'employment AI evaluation defaults unapproved'
);
select results_eq(
  $$
    select value
    from public.recruiting_settings
    where key = 'outlook_mail_verified'
  $$,
  $$ values ('false'::jsonb) $$,
  'Outlook readiness requires persisted provider verification'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.recruiting_applications',
    'UPDATE'
  ),
  false,
  'authenticated users cannot bypass audited application commands'
);
select is(
  has_table_privilege(
    'authenticated',
    'public.recruiting_applications',
    'INSERT'
  ),
  false,
  'authenticated users cannot create terminal applications directly'
);
select is(
  has_table_privilege(
    'authenticated',
    'public.recruiting_requisitions',
    'UPDATE'
  ),
  false,
  'authenticated users cannot bypass requisition approval state'
);
select is(
  has_table_privilege(
    'authenticated',
    'public.recruiting_ai_runs',
    'INSERT'
  ),
  false,
  'authenticated users cannot bypass the AI evaluation gate'
);
select is(
  has_table_privilege(
    'authenticated',
    'public.recruiting_candidates',
    'UPDATE'
  ),
  false,
  'authenticated users cannot bypass candidate lifecycle commands'
);
select is(
  has_table_privilege(
    'authenticated',
    'public.recruiting_ai_citations',
    'INSERT'
  ),
  false,
  'authenticated users cannot forge AI citation evidence'
);

select results_eq(
  $$
    select public.recruiting_stage_transition_allowed('new', 'review')
  $$,
  $$ values (true) $$,
  'new applications may advance to review'
);
select results_eq(
  $$
    select public.recruiting_stage_transition_allowed('new', 'hired')
  $$,
  $$ values (false) $$,
  'applications cannot skip from new to hired'
);

select throws_ok(
  $$
    insert into public.recruiting_applications (
      requisition_id,
      candidate_id,
      current_stage,
      status,
      row_version,
      created_by_person_id
    )
    values (
      gen_random_uuid(),
      gen_random_uuid(),
      'new',
      'active',
      1,
      gen_random_uuid()
    )
  $$,
  '23503',
  null,
  'applications require real candidate and requisition records'
);

select throws_ok(
  $$
    insert into public.recruiting_command_receipts (
      actor_person_id,
      idempotency_key,
      command_name,
      request_hash,
      response_body
    )
    values (
      gen_random_uuid(),
      gen_random_uuid(),
      'application.transition',
      '',
      '{}'::jsonb
    )
  $$,
  '23514',
  null,
  'command receipts require a nonempty request hash'
);

select results_eq(
  $$
    select public.recruiting_ai_action_allowed('draft_message')
  $$,
  $$ values (true) $$,
  'AI may draft content for human review'
);
select results_eq(
  $$
    select public.recruiting_ai_action_allowed('reject_candidate')
  $$,
  $$ values (false) $$,
  'AI may not reject a candidate'
);

select * from finish();
rollback;
