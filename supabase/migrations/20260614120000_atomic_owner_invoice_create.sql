-- ============================================================================
-- Atomic owner-invoice creation
-- ============================================================================
-- The owner-invoice "create" flow previously issued three sequential API calls:
--   1. POST prime_contract_payment_applications
--   2. POST owner_invoices (linked to the payment application)
--   3. N x POST owner_invoice_line_items
-- A failure on step 2 or 3 left the earlier rows committed -> an orphaned
-- payment application and/or a header invoice with missing line items.
--
-- This function performs all three steps inside a single transaction. Any
-- RAISE (or constraint failure) rolls back every write, so a partial failure
-- leaves NO rows behind. Business rules previously enforced by the individual
-- routes (contract must be Approved, application number must be unique per
-- contract) are preserved here and surface as clear errors.
--
-- SECURITY INVOKER (the default): the function runs with the caller's role and
-- RLS, identical to the direct inserts the API routes used to perform. The
-- calling route still gates with requirePermission(projectId,"contracts","write").

create or replace function public.create_owner_invoice_atomic(
  p_project_id          integer,
  p_contract_id         uuid,
  p_payment_application jsonb,
  p_invoice             jsonb,
  p_line_items          jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_contract_status text;
  v_payapp_id       uuid;
  v_invoice_id      bigint;
  v_invoice_number  text;
  v_item            jsonb;
  v_idx             integer := 0;
begin
  -- 1. Validate the prime contract belongs to this project and is approved.
  select status into v_contract_status
  from public.prime_contracts
  where id = p_contract_id and project_id = p_project_id;

  if v_contract_status is null then
    raise exception 'Contract not found or does not belong to this project.'
      using errcode = 'no_data_found';
  end if;

  if v_contract_status <> 'approved' then
    raise exception
      'Contract must be in Approved status before invoices can be created. Current status: %',
      coalesce(v_contract_status, 'unknown')
      using errcode = 'check_violation';
  end if;

  -- 2. Reject a duplicate application number on this contract (matches the
  --    409 the payment-applications route returned).
  if exists (
    select 1
    from public.prime_contract_payment_applications
    where contract_id = p_contract_id
      and application_number = p_payment_application->>'application_number'
  ) then
    raise exception 'Application number % already exists for this contract.',
      p_payment_application->>'application_number'
      using errcode = 'unique_violation';
  end if;

  -- 3. Create the payment application.
  insert into public.prime_contract_payment_applications (
    contract_id, project_id, application_number, amount, retention_amount,
    percent_complete, status, period_from, period_to, billing_period_id,
    billing_date, notes
  ) values (
    p_contract_id,
    p_project_id,
    p_payment_application->>'application_number',
    coalesce((p_payment_application->>'amount')::numeric, 0),
    coalesce((p_payment_application->>'retention_amount')::numeric, 0),
    coalesce((p_payment_application->>'percent_complete')::numeric, 0),
    coalesce(p_payment_application->>'status', 'draft'),
    (p_payment_application->>'period_from')::date,
    (p_payment_application->>'period_to')::date,
    (p_payment_application->>'billing_period_id')::uuid,
    (p_payment_application->>'billing_date')::date,
    nullif(p_payment_application->>'notes', '')
  )
  returning id into v_payapp_id;

  -- 4. Create the owner invoice linked to the payment application.
  v_invoice_number := nullif(p_invoice->>'invoice_number', '');

  insert into public.owner_invoices (
    prime_contract_id, invoice_number, period_start, period_end,
    billing_period_id, billing_date, due_date, status,
    payment_application_id, gross_amount, net_amount, percent_complete, notes
  ) values (
    p_contract_id,
    v_invoice_number,
    (p_invoice->>'period_start')::date,
    (p_invoice->>'period_end')::date,
    (p_invoice->>'billing_period_id')::uuid,
    (p_invoice->>'billing_date')::date,
    (p_invoice->>'due_date')::date,
    coalesce(p_invoice->>'status', 'draft'),
    v_payapp_id,
    (p_invoice->>'gross_amount')::numeric,
    (p_invoice->>'net_amount')::numeric,
    (p_invoice->>'percent_complete')::numeric,
    nullif(p_invoice->>'notes', '')
  )
  returning id into v_invoice_id;

  -- Mirror the UI fallback invoice number when none was provided.
  if v_invoice_number is null then
    v_invoice_number := 'INV-' || v_invoice_id::text;
    update public.owner_invoices
      set invoice_number = v_invoice_number
      where id = v_invoice_id;
  end if;

  -- 5. Create the invoice line items (generated columns are left to Postgres).
  for v_item in
    select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb))
  loop
    insert into public.owner_invoice_line_items (
      invoice_id, description, category, approved_amount, scheduled_value,
      work_completed_previous, work_completed_period, materials_stored,
      retainage_pct, retainage_amount, retainage_released, sort_order
    ) values (
      v_invoice_id,
      nullif(v_item->>'description', ''),
      nullif(v_item->>'category', ''),
      coalesce((v_item->>'approved_amount')::numeric, 0),
      coalesce((v_item->>'scheduled_value')::numeric, 0),
      coalesce((v_item->>'work_completed_previous')::numeric, 0),
      coalesce((v_item->>'work_completed_period')::numeric, 0),
      coalesce((v_item->>'materials_stored')::numeric, 0),
      coalesce((v_item->>'retainage_pct')::numeric, 0),
      coalesce((v_item->>'retainage_amount')::numeric, 0),
      coalesce((v_item->>'retainage_released')::numeric, 0),
      coalesce((v_item->>'sort_order')::integer, v_idx)
    );
    v_idx := v_idx + 1;
  end loop;

  return jsonb_build_object(
    'invoice_id', v_invoice_id,
    'payment_application_id', v_payapp_id,
    'invoice_number', v_invoice_number
  );
end;
$$;

grant execute on function public.create_owner_invoice_atomic(integer, uuid, jsonb, jsonb, jsonb)
  to authenticated, service_role;

-- Refresh the PostgREST schema cache so the RPC is reachable immediately.
notify pgrst, 'reload schema';
