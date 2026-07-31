begin;

set local search_path = public, extensions;

select plan(16);

select has_function(
  'public',
  'current_can_access_subcontractor_invoice_fields',
  array['bigint', 'uuid', 'uuid', 'boolean'],
  'Field-level subcontractor invoice authorization helper exists'
);

select has_function(
  'public',
  'current_can_access_subcontractor_invoice',
  array['bigint', 'boolean'],
  'Existing-invoice authorization helper exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.current_can_access_subcontractor_invoice(bigint, boolean)',
    'EXECUTE'
  ),
  'Authenticated users can execute the invoice authorization helper'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.current_can_access_subcontractor_invoice(bigint, boolean)',
    'EXECUTE'
  ),
  'Anonymous users cannot execute the invoice authorization helper'
);

select policies_are(
  'public',
  'subcontractor_invoices',
  array[
    'subcontractor_invoices_delete',
    'subcontractor_invoices_insert',
    'subcontractor_invoices_select',
    'subcontractor_invoices_update'
  ],
  'Invoice policies are split by operation'
);

select policies_are(
  'public',
  'subcontractor_invoice_line_items',
  array[
    'subcontractor_invoice_line_items_delete',
    'subcontractor_invoice_line_items_insert',
    'subcontractor_invoice_line_items_select',
    'subcontractor_invoice_line_items_update'
  ],
  'Invoice line-item policies are split by operation'
);

select ok(
  (
    select qual ilike '%current_can_access_subcontractor_invoice%'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subcontractor_invoices'
      and policyname = 'subcontractor_invoices_update'
  ),
  'Invoice updates use the write authorization helper'
);

select ok(
  (
    select with_check ilike '%current_can_access_subcontractor_invoice%'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subcontractor_invoice_line_items'
      and policyname = 'subcontractor_invoice_line_items_update'
  ),
  'Line-item updates inherit invoice write authorization'
);

select ok(
  (
    select with_check ilike '%current_can_manage_subcontractor_invoice%'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subcontractor_invoice_line_items'
      and policyname = 'subcontractor_invoice_line_items_insert'
  )
  and (
    select qual ilike '%current_can_manage_subcontractor_invoice%'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subcontractor_invoice_line_items'
      and policyname = 'subcontractor_invoice_line_items_delete'
  ),
  'Only commitment managers may add or remove invoice line items'
);

select ok(
  pg_get_functiondef(
    'public.current_can_access_subcontractor_invoice_fields(bigint, uuid, uuid, boolean)'::regprocedure
  ) ilike '%current_has_project_module_permission%'
  and pg_get_functiondef(
    'public.current_can_access_subcontractor_invoice_fields(bigint, uuid, uuid, boolean)'::regprocedure
  ) ilike '%edit_own_ssov%',
  'Authorization supports commitment managers and assigned invoice contacts'
);

select ok(
  pg_get_functiondef(
    'public.current_can_access_subcontractor_invoice_fields(bigint, uuid, uuid, boolean)'::regprocedure
  ) ilike '%s.project_id = p_project_id%'
  and pg_get_functiondef(
    'public.current_can_access_subcontractor_invoice_fields(bigint, uuid, uuid, boolean)'::regprocedure
  ) ilike '%po.project_id = p_project_id%',
  'Invoice authorization requires the commitment and invoice project to match'
);

select ok(
  (
    select qual ilike '%current_can_manage_subcontractor_invoice_fields%'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subcontractor_invoices'
      and policyname = 'subcontractor_invoices_delete'
  ),
  'Invoice contacts cannot delete parent invoices'
);

select ok(
  pg_get_functiondef(
    'public.enforce_subcontractor_invoice_mutation_boundary()'::regprocedure
  ) ilike '%acumatica_ref_nbr%'
  and pg_get_functiondef(
    'public.enforce_subcontractor_invoice_mutation_boundary()'::regprocedure
  ) ilike '%under_review%'
  and pg_get_functiondef(
    'public.enforce_subcontractor_invoice_mutation_boundary()'::regprocedure
  ) ilike '%submitted_at%'
  and pg_get_functiondef(
    'public.enforce_subcontractor_invoice_mutation_boundary()'::regprocedure
  ) ilike '%billing_periods%'
  and pg_get_functiondef(
    'public.enforce_subcontractor_invoice_mutation_boundary()'::regprocedure
  ) ilike '%cannot be deleted%'
  and pg_get_functiondef(
    'public.enforce_subcontractor_invoice_mutation_boundary()'::regprocedure
  ) ilike '%approve_invoices%',
  'Direct invoice updates enforce accounting and workflow invariants'
);

select ok(
  pg_get_functiondef(
    'public.enforce_subcontractor_invoice_line_item_boundary()'::regprocedure
  ) ilike '%revise_and_resubmit%'
  and pg_get_functiondef(
    'public.enforce_subcontractor_invoice_line_item_boundary()'::regprocedure
  ) ilike '%acumatica_sync_at%'
  and pg_get_functiondef(
    'public.enforce_subcontractor_invoice_line_item_boundary()'::regprocedure
  ) ilike '%old.invoice_id%'
  and pg_get_functiondef(
    'public.enforce_subcontractor_invoice_line_item_boundary()'::regprocedure
  ) ilike '%to_jsonb(old)%'
  and pg_get_functiondef(
    'public.enforce_subcontractor_invoice_line_item_boundary()'::regprocedure
  ) ilike '%work_completed_period%'
  and pg_get_functiondef(
    'public.update_subcontractor_invoice_line_item(bigint, bigint, bigint, numeric, numeric, numeric, numeric, numeric, numeric)'::regprocedure
  ) ilike '%cannot exceed the scheduled value%',
  'Direct line-item updates are limited to unsynced editable invoices'
);

select ok(
  pg_get_functiondef(
    'public.log_subcontractor_invoice_field_changes()'::regprocedure
  ) ilike '%field.updated%'
  and pg_get_functiondef(
    'public.log_subcontractor_invoice_line_item_changes()'::regprocedure
  ) ilike '%line_item.updated%',
  'Financial field and line-item audits are database-transactional'
);

select ok(
  pg_get_functiondef(
    'public.log_subcontractor_invoice_status_change()'::regprocedure
  ) ilike '%actor_user_id%'
  and pg_get_functiondef(
    'public.log_subcontractor_invoice_status_change()'::regprocedure
  ) ilike '%auth.uid%',
  'Status audit attribution is recorded by the database trigger'
);

select * from finish();

rollback;
