begin;

set local search_path = public, extensions;

select plan(26);

select has_column(
  'public',
  'subcontractor_invoice_line_items',
  'source_sov_item_id',
  'Invoice lines have a stable commitment SOV source'
);

select has_column(
  'public',
  'subcontractor_invoice_line_items',
  'source_change_order_id',
  'Invoice lines have a stable approved change-order source'
);

select has_function(
  'public',
  'subcontractor_invoice_schedule_is_valid',
  array['bigint'],
  'Canonical invoice schedule validator exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.subcontractor_invoice_schedule_is_valid(bigint)',
    'EXECUTE'
  ),
  'Anonymous users cannot inspect invoice schedule integrity'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.subcontractor_invoice_schedule_is_valid(bigint)',
    'EXECUTE'
  ),
  'Authenticated users cannot bypass project access through the validator'
);

select trigger_is(
  'public',
  'subcontractor_invoices',
  'trg_subcontractor_invoice_schedule_submission_guard',
  'public',
  'guard_subcontractor_invoice_schedule_submission',
  'Invoice submission is guarded at the database boundary'
);

select trigger_is(
  'public',
  'subcontractor_invoices',
  'trg_subcontractor_invoice_initial_status_guard',
  'public',
  'guard_subcontractor_invoice_initial_status',
  'Direct inserts cannot bypass the guarded submission transition'
);

select trigger_is(
  'public',
  'subcontractor_invoice_line_items',
  'trg_subcontractor_invoice_line_source_canonical',
  'public',
  'canonicalize_subcontractor_invoice_line_source',
  'Invoice line amounts are canonicalized from their source'
);

select trigger_is(
  'public',
  'subcontract_sov_items',
  'trg_subcontract_sov_sync_editable_invoices',
  'public',
  'sync_editable_invoices_from_commitment_sov',
  'Subcontract SOV changes synchronize editable invoices'
);

select trigger_is(
  'public',
  'purchase_order_sov_items',
  'trg_purchase_order_sov_sync_editable_invoices',
  'public',
  'sync_editable_invoices_from_commitment_sov',
  'Purchase-order SOV changes synchronize editable invoices'
);

select trigger_is(
  'public',
  'contract_change_orders',
  'trg_change_order_sync_editable_invoices',
  'public',
  'sync_editable_invoices_from_change_order',
  'Approved change orders synchronize editable invoices'
);

select trigger_is(
  'public',
  'subcontractor_invoices',
  'trg_subcontractor_invoice_reconcile_on_reopen',
  'public',
  'reconcile_subcontractor_invoice_on_reopen',
  'Reopened invoices reconcile every current commitment source'
);

select trigger_is(
  'public',
  'subcontractor_invoice_line_items',
  'trg_subcontractor_invoice_line_delete_guard',
  'public',
  'reject_direct_subcontractor_invoice_line_delete',
  'Direct invoice-line deletion is rejected at the database boundary'
);

select trigger_is(
  'public',
  'subcontractor_invoice_line_items',
  'trg_subcontractor_invoice_line_reconcile_billing_guard',
  'public',
  'guard_billed_invoice_line_reconciliation_delete',
  'Reopen reconciliation cannot delete billed financial rows'
);

select ok(
  pg_get_functiondef(
    'public.subcontractor_invoice_schedule_is_valid(bigint)'::regprocedure
  ) ilike '%source_sov_item_id%'
  and pg_get_functiondef(
    'public.subcontractor_invoice_schedule_is_valid(bigint)'::regprocedure
  ) ilike '%source_change_order_id%'
  and pg_get_functiondef(
    'public.subcontractor_invoice_schedule_is_valid(bigint)'::regprocedure
  ) ilike '%approved%',
  'Schedule validation requires every current source exactly once'
);

select ok(
  pg_get_functiondef(
    'public.guard_commitment_sov_invoice_history()'::regprocedure
  ) ilike '%entered review or accounting%'
  and pg_get_functiondef(
    'public.guard_editable_invoice_change_source()'::regprocedure
  ) ilike '%amount billed%',
  'Source reductions protect submitted history and billed draft amounts'
);

select ok(
  public.subcontractor_invoice_billing_is_within_schedule(
    100,
    25,
    50,
    25
  ),
  'Positive schedule accepts billing up to its canonical value'
);

select ok(
  not public.subcontractor_invoice_billing_is_within_schedule(
    100,
    25,
    76,
    0
  ),
  'Positive schedule rejects overbilling'
);

select ok(
  public.subcontractor_invoice_billing_is_within_schedule(
    -100,
    0,
    0,
    0
  ),
  'Deductive schedule accepts an unbilled negative source'
);

select ok(
  not public.subcontractor_invoice_billing_is_within_schedule(
    -100,
    -75,
    -26,
    0
  ),
  'Deductive schedule rejects billing beyond its signed value'
);

select lives_ok(
  $behavior$
  do $$
  begin
    if not exists (
      select 1
      from public.subcontractor_invoices
      where id = 8268
    ) then
      return;
    end if;

    perform set_config('request.jwt.claim.role', 'service_role', true);
    update public.subcontract_sov_items
    set amount = 16000
    where id = 'cc6d377e-aa9e-4bcd-9207-b2797cefd1f3';

    if (
      select scheduled_value
      from public.subcontractor_invoice_line_items
      where id = 3371
    ) <> 16000 then
      raise exception 'Editable invoice did not synchronize';
    end if;

    begin
      update public.subcontract_sov_items
      set amount = 15000
      where id = 'cc6d377e-aa9e-4bcd-9207-b2797cefd1f3';
      raise exception 'Reduction below billed amount unexpectedly succeeded';
    exception when check_violation then
      null;
    end;

    update public.subcontractor_invoice_line_items
    set scheduled_value = 999
    where id = 3371;
    if (
      select scheduled_value
      from public.subcontractor_invoice_line_items
      where id = 3371
    ) <> 16000 then
      raise exception 'Canonical source value was not restored';
    end if;
  end;
  $$;
  $behavior$,
  'Editable invoice syncs, source reduction fails, and canonical value wins'
);

select lives_ok(
  $behavior$
  do $$
  declare
    v_invoice_id bigint;
  begin
    if not exists (
      select 1
      from public.subcontractor_invoices
      where id = 8268
    ) then
      return;
    end if;

    perform set_config('request.jwt.claim.role', 'service_role', true);
    insert into public.subcontractor_invoices (
      project_id,
      subcontract_id,
      status
    )
    values (
      1149,
      '1ab839e9-a3bc-4b81-a72f-197aa6cd66b5',
      'draft'
    )
    returning id into v_invoice_id;

    begin
      update public.subcontractor_invoices
      set status = 'under_review', submitted_at = now()
      where id = v_invoice_id;
      raise exception 'Empty invoice submission unexpectedly succeeded';
    exception when check_violation then
      null;
    end;
  end;
  $$;
  $behavior$,
  'Database submission guard rejects a source-incomplete invoice'
);

select lives_ok(
  $behavior$
  do $$
  declare
    v_change_id uuid;
    v_scheduled numeric;
    v_completion numeric;
  begin
    if not exists (
      select 1
      from public.subcontractor_invoices
      where id = 8268
    ) then
      return;
    end if;

    perform set_config('request.jwt.claim.role', 'service_role', true);
    insert into public.contract_change_orders (
      approved_date,
      approved_by,
      amount,
      change_order_number,
      contract_id,
      description,
      project_id,
      status
    )
    values (
      current_date,
      (select id from auth.users order by created_at limit 1),
      -5000,
      'PGTAP-DEDUCTIVE',
      '1ab839e9-a3bc-4b81-a72f-197aa6cd66b5',
      'Rollback-only deductive change order',
      1149,
      'approved'
    )
    returning id into v_change_id;

    update public.subcontractor_invoice_line_items
    set work_completed_period = -2500
    where invoice_id = 8268
      and source_change_order_id = v_change_id;

    update public.subcontractor_invoices
    set status = 'under_review', submitted_at = now()
    where id = 8268;

    update public.contract_change_orders
    set amount = -6000
    where id = v_change_id;

    update public.subcontractor_invoices
    set status = 'draft'
    where id = 8268;

    select scheduled_value, work_completed_pct
    into v_scheduled, v_completion
    from public.subcontractor_invoice_line_items
    where invoice_id = 8268
      and source_change_order_id = v_change_id;

    if v_scheduled <> -6000 then
      raise exception 'Reopened invoice did not reconcile the changed source';
    end if;
    if abs(v_completion - (2500::numeric / 6000 * 100)) > 0.0001 then
      raise exception 'Deductive completion percentage was not preserved';
    end if;
  end;
  $$;
  $behavior$,
  'Reopen reconciles missed changes and preserves signed completion'
);

select lives_ok(
  $behavior$
  do $$
  declare
    v_change_id uuid;
  begin
    if not exists (
      select 1
      from public.subcontractor_invoices
      where id = 8268
    ) then
      return;
    end if;

    perform set_config('request.jwt.claim.role', 'service_role', true);
    insert into public.contract_change_orders (
      approved_date,
      approved_by,
      amount,
      change_order_number,
      contract_id,
      description,
      project_id,
      status
    )
    values (
      current_date,
      (select id from auth.users order by created_at limit 1),
      1000,
      'PGTAP-BILLED-REMOVAL',
      '1ab839e9-a3bc-4b81-a72f-197aa6cd66b5',
      'Rollback-only billed source removal',
      1149,
      'approved'
    )
    returning id into v_change_id;

    update public.subcontractor_invoice_line_items
    set work_completed_period = 500
    where invoice_id = 8268
      and source_change_order_id = v_change_id;

    update public.subcontractor_invoices
    set status = 'under_review', submitted_at = now()
    where id = 8268;

    update public.contract_change_orders
    set status = 'pending'
    where id = v_change_id;

    begin
      update public.subcontractor_invoices
      set status = 'draft'
      where id = 8268;
      raise exception 'Reopen unexpectedly deleted a billed source';
    exception when check_violation then
      null;
    end;

    if not exists (
      select 1
      from public.subcontractor_invoice_line_items
      where invoice_id = 8268
        and source_change_order_id = v_change_id
        and work_completed_period = 500
    ) then
      raise exception 'Billed source line was not preserved';
    end if;

    update public.contract_change_orders
    set status = 'approved'
    where id = v_change_id;
    update public.subcontractor_invoices
    set status = 'draft'
    where id = 8268;
  end;
  $$;
  $behavior$,
  'Reopen fails loudly instead of deleting a billed removed source'
);

select lives_ok(
  $behavior$
  do $$
  begin
    if not exists (
      select 1
      from public.subcontractor_invoice_line_items
      where id = 3371
    ) then
      return;
    end if;

    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('alleato.invoice_sov_sync', 'off', true);
    begin
      delete from public.subcontractor_invoice_line_items
      where id = 3371;
      raise exception 'Direct authenticated deletion unexpectedly succeeded';
    exception when insufficient_privilege then
      null;
    end;

    if not exists (
      select 1
      from public.subcontractor_invoice_line_items
      where id = 3371
    ) then
      raise exception 'Protected invoice line was deleted';
    end if;
    perform set_config('request.jwt.claim.role', 'service_role', true);
  end;
  $$;
  $behavior$,
  'Authenticated line deletion is rejected before it can race submission'
);

select lives_ok(
  $behavior$
  do $$
  begin
    if not exists (
      select 1
      from public.subcontractor_invoices
      where id = 8268
    ) then
      return;
    end if;

    perform set_config('request.jwt.claim.role', 'service_role', true);
    update public.subcontractor_invoices
    set status = 'under_review', submitted_at = now()
    where id = 8268;

    begin
      update public.subcontract_sov_items
      set amount = 17000
      where id = 'cc6d377e-aa9e-4bcd-9207-b2797cefd1f3';
      raise exception 'Submitted invoice history unexpectedly changed';
    exception when check_violation then
      null;
    end;

    update public.subcontractor_invoices
    set status = 'draft'
    where id = 8268;
  end;
  $$;
  $behavior$,
  'Submitted invoice history locks its commitment SOV'
);

select * from finish();

rollback;
