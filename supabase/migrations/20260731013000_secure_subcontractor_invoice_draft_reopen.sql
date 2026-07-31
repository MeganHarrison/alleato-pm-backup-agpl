-- Secure subcontractor invoice access at the database boundary and make
-- status-transition actor attribution part of the triggering transaction.

begin;

create or replace function public.current_can_access_subcontractor_invoice_fields(
  p_project_id bigint,
  p_subcontract_id uuid,
  p_purchase_order_id uuid,
  p_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (
      (
        p_subcontract_id is not null
        and p_purchase_order_id is null
        and exists (
          select 1
          from public.subcontracts s
          where s.id = p_subcontract_id
            and s.project_id = p_project_id
        )
      )
      or (
        p_purchase_order_id is not null
        and p_subcontract_id is null
        and exists (
          select 1
          from public.purchase_orders po
          where po.id = p_purchase_order_id
            and po.project_id = p_project_id
        )
      )
    )
    and (
      public.current_is_app_admin()
      or public.current_has_project_module_permission(
        p_project_id,
        'commitments',
        case when p_write then 'write' else 'read' end
      )
      or (
        (
          exists (
            select 1
            from public.subcontracts s
            where s.id = p_subcontract_id
              and s.project_id = p_project_id
              and public.current_person_id()
                = any(coalesce(s.invoice_contact_ids, '{}'::uuid[]))
          )
          or exists (
            select 1
            from public.purchase_orders po
            where po.id = p_purchase_order_id
              and po.project_id = p_project_id
              and public.current_person_id()
                = any(coalesce(po.invoice_contact_ids, '{}'::uuid[]))
          )
        )
        and (
          not p_write
          or public.current_has_project_granular_permission(
            p_project_id,
            'edit_own_ssov'
          )
        )
      )
    );
$$;

create or replace function public.current_can_manage_subcontractor_invoice_fields(
  p_project_id bigint,
  p_subcontract_id uuid,
  p_purchase_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_can_access_subcontractor_invoice_fields(
      p_project_id,
      p_subcontract_id,
      p_purchase_order_id,
      false
    )
    and (
      public.current_is_app_admin()
      or public.current_has_project_module_permission(
          p_project_id,
          'commitments',
          'write'
        )
    );
$$;

revoke all on function public.current_can_manage_subcontractor_invoice_fields(
  bigint, uuid, uuid
) from public, anon;
grant execute on function public.current_can_manage_subcontractor_invoice_fields(
  bigint, uuid, uuid
) to authenticated, service_role;

revoke all on function public.current_can_access_subcontractor_invoice_fields(
  bigint, uuid, uuid, boolean
) from public, anon;
grant execute on function public.current_can_access_subcontractor_invoice_fields(
  bigint, uuid, uuid, boolean
) to authenticated, service_role;

create or replace function public.current_can_access_subcontractor_invoice(
  p_invoice_id bigint,
  p_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select public.current_can_access_subcontractor_invoice_fields(
        si.project_id,
        si.subcontract_id,
        si.purchase_order_id,
        p_write
      )
      from public.subcontractor_invoices si
      where si.id = p_invoice_id
    ),
    false
  );
$$;

revoke all on function public.current_can_access_subcontractor_invoice(
  bigint, boolean
) from public, anon;
grant execute on function public.current_can_access_subcontractor_invoice(
  bigint, boolean
) to authenticated, service_role;

create or replace function public.current_can_manage_subcontractor_invoice(
  p_invoice_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select public.current_can_manage_subcontractor_invoice_fields(
        si.project_id,
        si.subcontract_id,
        si.purchase_order_id
      )
      from public.subcontractor_invoices si
      where si.id = p_invoice_id
    ),
    false
  );
$$;

revoke all on function public.current_can_manage_subcontractor_invoice(
  bigint
) from public, anon;
grant execute on function public.current_can_manage_subcontractor_invoice(
  bigint
) to authenticated, service_role;

alter table public.subcontractor_invoices enable row level security;
alter table public.subcontractor_invoice_line_items enable row level security;

drop policy if exists "Authenticated users can manage subcontractor_invoices"
on public.subcontractor_invoices;
drop policy if exists subcontractor_invoices_select
on public.subcontractor_invoices;
drop policy if exists subcontractor_invoices_insert
on public.subcontractor_invoices;
drop policy if exists subcontractor_invoices_update
on public.subcontractor_invoices;
drop policy if exists subcontractor_invoices_delete
on public.subcontractor_invoices;

create policy subcontractor_invoices_select
on public.subcontractor_invoices
for select
to authenticated
using (
  public.current_can_access_subcontractor_invoice_fields(
    project_id,
    subcontract_id,
    purchase_order_id,
    false
  )
);

create policy subcontractor_invoices_insert
on public.subcontractor_invoices
for insert
to authenticated
with check (
  public.current_can_manage_subcontractor_invoice_fields(
    project_id,
    subcontract_id,
    purchase_order_id
  )
);

create policy subcontractor_invoices_update
on public.subcontractor_invoices
for update
to authenticated
using (public.current_can_access_subcontractor_invoice(id, true))
with check (
  public.current_can_access_subcontractor_invoice_fields(
    project_id,
    subcontract_id,
    purchase_order_id,
    true
  )
);

create policy subcontractor_invoices_delete
on public.subcontractor_invoices
for delete
to authenticated
using (
  public.current_can_manage_subcontractor_invoice_fields(
    project_id,
    subcontract_id,
    purchase_order_id
  )
);

create or replace function public.enforce_subcontractor_invoice_mutation_boundary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_service boolean := coalesce((select auth.role()) = 'service_role', false);
  v_is_manager boolean;
  v_can_approve boolean;
  v_old_synced boolean;
begin
  if tg_op = 'DELETE' then
    if v_is_service then
      return old;
    end if;

    if not (
      public.current_is_app_admin()
      or public.current_has_project_module_permission(
        old.project_id,
        'commitments',
        'write'
      )
    )
      or old.status::text in ('approved', 'approved_as_noted', 'paid')
      or old.acumatica_ref_nbr is not null
      or old.acumatica_doc_type is not null
      or old.acumatica_sync_at is not null
      or old.acumatica_ap_bill_id is not null
    then
      raise exception
        using
          errcode = '42501',
          message = 'This invoice cannot be deleted';
    end if;

    perform set_config(
      'alleato.subcontractor_invoice_parent_delete',
      old.id::text,
      true
    );
    return old;
  end if;

  if (
    not (
      (
        new.subcontract_id is not null
        and new.purchase_order_id is null
        and exists (
          select 1
          from public.subcontracts s
          where s.id = new.subcontract_id
            and s.project_id = new.project_id
        )
      )
      or (
        new.purchase_order_id is not null
        and new.subcontract_id is null
        and exists (
          select 1
          from public.purchase_orders po
          where po.id = new.purchase_order_id
            and po.project_id = new.project_id
        )
      )
    )
    or (
      new.billing_period_id is not null
      and not exists (
        select 1
        from public.billing_periods bp
        where bp.id = new.billing_period_id
          and bp.project_id = new.project_id
      )
    )
  ) then
    raise exception
      using
        errcode = '23514',
        message = 'Invoice commitment and billing period must belong to the invoice project';
  end if;

  if v_is_service then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status::text not in (
      'draft',
      'under_review',
      'not_invited',
      'invited'
    )
      or new.acumatica_ref_nbr is not null
      or new.acumatica_doc_type is not null
      or new.acumatica_sync_at is not null
      or new.acumatica_ap_bill_id is not null
      or new.submitted_at is not null
      or new.approved_at is not null
    then
      raise exception
        using
          errcode = '23514',
          message = 'New invoices must start in an unsynced intake status';
    end if;
    return new;
  end if;

  if old.project_id is distinct from new.project_id
    or old.subcontract_id is distinct from new.subcontract_id
    or old.purchase_order_id is distinct from new.purchase_order_id
    or old.billing_period_id is distinct from new.billing_period_id
    or old.id is distinct from new.id
    or old.created_at is distinct from new.created_at
  then
    raise exception
      using
        errcode = '23514',
        message = 'Invoice project and commitment cannot be changed';
  end if;

  if old.acumatica_ref_nbr is distinct from new.acumatica_ref_nbr
    or old.acumatica_doc_type is distinct from new.acumatica_doc_type
    or old.acumatica_sync_at is distinct from new.acumatica_sync_at
    or old.acumatica_ap_bill_id is distinct from new.acumatica_ap_bill_id
  then
    raise exception
      using
        errcode = '42501',
        message = 'Accounting link fields are service-managed';
  end if;

  v_is_manager :=
    public.current_is_app_admin()
    or public.current_has_project_module_permission(
      old.project_id,
      'commitments',
      'write'
    );
  v_can_approve :=
    v_is_manager
    and public.current_has_project_granular_permission(
      old.project_id,
      'approve_invoices'
    );
  v_old_synced :=
    old.acumatica_ref_nbr is not null
    or old.acumatica_doc_type is not null
    or old.acumatica_sync_at is not null
    or old.acumatica_ap_bill_id is not null;

  if old.status is distinct from new.status then
    if old.status::text = 'under_review'
      and new.status::text = 'draft'
    then
      if v_old_synced or not v_is_manager then
        raise exception
          using
            errcode = '42501',
            message = 'Only a commitment manager may reopen an unsynced invoice';
      end if;
    elsif old.status::text in ('draft', 'invited', 'revise_and_resubmit')
      and new.status::text = 'under_review'
    then
      if not public.current_can_access_subcontractor_invoice(old.id, true) then
        raise exception
          using
            errcode = '42501',
            message = 'Invoice submission is not permitted';
      end if;
    elsif old.status::text in (
      'not_invited',
      'invited',
      'draft',
      'revise_and_resubmit'
    )
      and new.status::text = 'invited'
    then
      if not v_is_manager then
        raise exception
          using
            errcode = '42501',
            message = 'Only a commitment manager may invite a subcontractor';
      end if;
    elsif (
      old.status::text = 'under_review'
      and new.status::text in (
        'approved',
        'approved_as_noted',
        'pending_owner_approval',
        'revise_and_resubmit'
      )
    )
      or (
        old.status::text = 'pending_owner_approval'
        and new.status::text = 'approved'
      )
      or (
        old.status::text not in ('paid', 'void')
        and new.status::text = 'void'
      )
    then
      if not v_can_approve then
        raise exception
          using
            errcode = '42501',
            message = 'Invoice approval permission is required';
      end if;
    else
      raise exception
        using
          errcode = '23514',
          message = 'Invalid subcontractor invoice status transition';
    end if;

    if new.status::text = 'under_review' then
      if new.approved_at is distinct from old.approved_at
        or new.is_retainage_release is distinct from old.is_retainage_release
        or new.jobplanner_pay_app_number
          is distinct from old.jobplanner_pay_app_number
      then
        raise exception
          using
            errcode = '23514',
            message = 'Submission cannot alter approval or accounting fields';
      end if;
    elsif new.status::text in ('approved', 'approved_as_noted') then
      if new.submitted_at is distinct from old.submitted_at
        or new.jobplanner_pay_app_number
          is distinct from old.jobplanner_pay_app_number
      then
        raise exception
          using
            errcode = '23514',
            message = 'Approval cannot alter submission or accounting fields';
      end if;
    elsif new.submitted_at is distinct from old.submitted_at
      or new.approved_at is distinct from old.approved_at
      or new.is_retainage_release is distinct from old.is_retainage_release
      or new.jobplanner_pay_app_number
        is distinct from old.jobplanner_pay_app_number
    then
      raise exception
        using
          errcode = '23514',
          message = 'This transition cannot alter workflow metadata';
    end if;
  elsif old.invoice_number is distinct from new.invoice_number
    or old.period_start is distinct from new.period_start
    or old.period_end is distinct from new.period_end
    or old.billing_date is distinct from new.billing_date
    or old.notes is distinct from new.notes
  then
    if old.invoice_number is null
      and new.invoice_number is not null
      and old.status::text in ('under_review', 'not_invited')
      and old.period_start is not distinct from new.period_start
      and old.period_end is not distinct from new.period_end
      and old.billing_date is not distinct from new.billing_date
      and old.notes is not distinct from new.notes
      and not v_old_synced
      and v_is_manager
    then
      null;
    elsif v_old_synced
      or old.status::text not in (
        'draft',
        'invited',
        'revise_and_resubmit'
      )
    then
      raise exception
        using
          errcode = '23514',
          message = 'Invoice fields are locked in the current workflow state';
    end if;
  elsif old.submitted_at is distinct from new.submitted_at
    or old.approved_at is distinct from new.approved_at
    or old.is_retainage_release is distinct from new.is_retainage_release
    or old.jobplanner_pay_app_number
      is distinct from new.jobplanner_pay_app_number
  then
    raise exception
      using
        errcode = '23514',
        message = 'Workflow metadata requires a valid status transition';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_subcontractor_invoice_mutation_boundary()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_mutation_boundary
on public.subcontractor_invoices;
create trigger trg_subcontractor_invoice_mutation_boundary
before insert or update or delete
on public.subcontractor_invoices
for each row
execute function public.enforce_subcontractor_invoice_mutation_boundary();

create or replace function public.enforce_subcontractor_invoice_line_item_boundary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subcontractor_invoices%rowtype;
begin
  if coalesce((select auth.role()) = 'service_role', false) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE'
    and current_setting(
      'alleato.subcontractor_invoice_parent_delete',
      true
    ) = old.invoice_id::text
  then
    return old;
  end if;

  if tg_op = 'UPDATE'
    and coalesce(
      current_setting(
        'alleato.subcontractor_invoice_line_item_rpc',
        true
      ),
      ''
    ) <> 'on'
  then
    raise exception
      using
        errcode = '42501',
        message = 'Invoice line items must be updated through the guarded RPC';
  end if;

  if tg_op = 'UPDATE'
    and (
      old.id is distinct from new.id
      or old.invoice_id is distinct from new.invoice_id
      or old.created_at is distinct from new.created_at
    )
  then
    raise exception
      using
        errcode = '23514',
        message = 'Invoice line-item identity cannot be changed';
  end if;

  if tg_op = 'UPDATE'
    and (
      to_jsonb(old) - array[
        'work_completed_period',
        'materials_stored',
        'retainage_pct',
        'retainage_amount',
        'materials_retainage_pct',
        'materials_retainage_amount',
        'work_retainage_released',
        'materials_retainage_released',
        'work_completed_pct',
        'net_amount_this_period',
        'balance_to_finish',
        'total_completed_stored',
        'updated_at'
      ]::text[]
    ) is distinct from (
      to_jsonb(new) - array[
        'work_completed_period',
        'materials_stored',
        'retainage_pct',
        'retainage_amount',
        'materials_retainage_pct',
        'materials_retainage_amount',
        'work_retainage_released',
        'materials_retainage_released',
        'work_completed_pct',
        'net_amount_this_period',
        'balance_to_finish',
        'total_completed_stored',
        'updated_at'
      ]::text[]
    )
  then
    raise exception
      using
        errcode = '23514',
        message = 'Invoice line-item source values are read-only';
  end if;

  select si.*
  into v_invoice
  from public.subcontractor_invoices si
  where si.id = case
    when tg_op = 'DELETE' then old.invoice_id
    else new.invoice_id
  end;

  if not found
    or v_invoice.status::text not in (
      'draft',
      'invited',
      'revise_and_resubmit'
    )
    or v_invoice.acumatica_ref_nbr is not null
    or v_invoice.acumatica_doc_type is not null
    or v_invoice.acumatica_sync_at is not null
    or v_invoice.acumatica_ap_bill_id is not null
  then
    raise exception
      using
        errcode = '23514',
        message = 'Invoice line items are locked in the current workflow state';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_subcontractor_invoice_line_item_boundary()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_line_item_boundary
on public.subcontractor_invoice_line_items;
create trigger trg_subcontractor_invoice_line_item_boundary
before insert or update or delete
on public.subcontractor_invoice_line_items
for each row
execute function public.enforce_subcontractor_invoice_line_item_boundary();

create or replace function public.update_subcontractor_invoice_line_item(
  p_project_id bigint,
  p_invoice_id bigint,
  p_line_item_id bigint,
  p_work_completed_period numeric,
  p_materials_stored numeric,
  p_retainage_pct numeric,
  p_materials_retainage_pct numeric,
  p_work_retainage_released numeric,
  p_materials_retainage_released numeric
)
returns public.subcontractor_invoice_line_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subcontractor_invoices%rowtype;
  v_line public.subcontractor_invoice_line_items%rowtype;
  v_work numeric;
  v_materials numeric;
  v_work_pct numeric;
  v_materials_pct numeric;
  v_work_released numeric;
  v_materials_released numeric;
  v_work_retainage numeric;
  v_materials_retainage numeric;
  v_total_completed numeric;
begin
  if not public.current_can_access_subcontractor_invoice(
    p_invoice_id,
    true
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Invoice line-item update is not permitted';
  end if;

  select si.*
  into v_invoice
  from public.subcontractor_invoices si
  where si.id = p_invoice_id
    and si.project_id = p_project_id
  for update;

  if not found
    or v_invoice.status::text not in (
      'draft',
      'invited',
      'revise_and_resubmit'
    )
    or v_invoice.acumatica_ref_nbr is not null
    or v_invoice.acumatica_doc_type is not null
    or v_invoice.acumatica_sync_at is not null
    or v_invoice.acumatica_ap_bill_id is not null
  then
    raise exception
      using
        errcode = '23514',
        message = 'Invoice line items are locked in the current workflow state';
  end if;

  select li.*
  into v_line
  from public.subcontractor_invoice_line_items li
  where li.id = p_line_item_id
    and li.invoice_id = p_invoice_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Invoice line item was not found';
  end if;

  v_work := coalesce(p_work_completed_period, v_line.work_completed_period, 0);
  v_materials := coalesce(p_materials_stored, v_line.materials_stored, 0);
  v_work_pct := coalesce(p_retainage_pct, v_line.retainage_pct, 0);
  v_materials_pct := coalesce(
    p_materials_retainage_pct,
    v_line.materials_retainage_pct,
    0
  );
  v_work_released := greatest(
    coalesce(
      p_work_retainage_released,
      v_line.work_retainage_released,
      0
    ),
    0
  );
  v_materials_released := greatest(
    coalesce(
      p_materials_retainage_released,
      v_line.materials_retainage_released,
      0
    ),
    0
  );

  if v_work < 0 or v_materials < 0 then
    raise exception
      using
        errcode = '22003',
        message = 'Work completed and stored materials cannot be negative';
  end if;

  if v_work_pct < 0 or v_work_pct > 100
    or v_materials_pct < 0 or v_materials_pct > 100
  then
    raise exception
      using
        errcode = '22003',
        message = 'Retainage percentages must be between 0 and 100';
  end if;

  v_work_retainage := v_work * v_work_pct / 100;
  v_materials_retainage := v_materials * v_materials_pct / 100;

  if v_work_released
    > coalesce(v_line.previous_work_retainage, 0) + v_work_retainage
    or v_materials_released
    > coalesce(v_line.previous_materials_retainage, 0)
      + v_materials_retainage
  then
    raise exception
      using
        errcode = '23514',
        message = 'Retainage release exceeds the amount withheld';
  end if;

  v_total_completed :=
    coalesce(v_line.work_completed_previous, 0)
    + v_work
    + v_materials;

  if v_total_completed > coalesce(v_line.scheduled_value, 0) then
    raise exception
      using
        errcode = '23514',
        message = 'Invoice billing cannot exceed the scheduled value';
  end if;

  perform set_config(
    'alleato.subcontractor_invoice_line_item_rpc',
    'on',
    true
  );

  update public.subcontractor_invoice_line_items
  set
    work_completed_period = v_work,
    materials_stored = v_materials,
    retainage_pct = v_work_pct,
    retainage_amount = v_work_retainage,
    materials_retainage_pct = v_materials_pct,
    materials_retainage_amount = v_materials_retainage,
    work_retainage_released = v_work_released,
    materials_retainage_released = v_materials_released,
    work_completed_pct = case
      when coalesce(v_line.scheduled_value, 0) > 0
        then v_total_completed / v_line.scheduled_value * 100
      else 0
    end,
    updated_at = now()
  where id = p_line_item_id
    and invoice_id = p_invoice_id
  returning * into v_line;

  return v_line;
end;
$$;

revoke all on function public.update_subcontractor_invoice_line_item(
  bigint,
  bigint,
  bigint,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric
) from public, anon;
grant execute on function public.update_subcontractor_invoice_line_item(
  bigint,
  bigint,
  bigint,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric
) to authenticated, service_role;

drop policy if exists
  "Authenticated users can manage subcontractor_invoice_line_items"
on public.subcontractor_invoice_line_items;
drop policy if exists subcontractor_invoice_line_items_select
on public.subcontractor_invoice_line_items;
drop policy if exists subcontractor_invoice_line_items_insert
on public.subcontractor_invoice_line_items;
drop policy if exists subcontractor_invoice_line_items_update
on public.subcontractor_invoice_line_items;
drop policy if exists subcontractor_invoice_line_items_delete
on public.subcontractor_invoice_line_items;

create policy subcontractor_invoice_line_items_select
on public.subcontractor_invoice_line_items
for select
to authenticated
using (
  public.current_can_access_subcontractor_invoice(invoice_id, false)
);

create policy subcontractor_invoice_line_items_insert
on public.subcontractor_invoice_line_items
for insert
to authenticated
with check (
  public.current_can_manage_subcontractor_invoice(invoice_id)
);

create policy subcontractor_invoice_line_items_update
on public.subcontractor_invoice_line_items
for update
to authenticated
using (
  public.current_can_access_subcontractor_invoice(invoice_id, true)
)
with check (
  public.current_can_access_subcontractor_invoice(invoice_id, true)
);

create policy subcontractor_invoice_line_items_delete
on public.subcontractor_invoice_line_items
for delete
to authenticated
using (
  public.current_can_manage_subcontractor_invoice(invoice_id)
);

create or replace function public.log_subcontractor_invoice_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.subcontractor_invoice_audit_log (
    invoice_id,
    event_type,
    field_name,
    old_value,
    new_value,
    notes,
    actor_user_id,
    actor_email,
    created_at
  )
  select
    new.id,
    'field.updated',
    changed.field_name,
    changed.old_value,
    changed.new_value,
    'Updated ' || replace(changed.field_name, '_', ' '),
    (select auth.uid()),
    (
      select u.email
      from auth.users u
      where u.id = (select auth.uid())
    ),
    now()
  from (
    values
      (
        'invoice_number',
        to_jsonb(old.invoice_number),
        to_jsonb(new.invoice_number)
      ),
      (
        'period_start',
        to_jsonb(old.period_start),
        to_jsonb(new.period_start)
      ),
      (
        'period_end',
        to_jsonb(old.period_end),
        to_jsonb(new.period_end)
      ),
      (
        'billing_date',
        to_jsonb(old.billing_date),
        to_jsonb(new.billing_date)
      ),
      ('notes', to_jsonb(old.notes), to_jsonb(new.notes))
  ) as changed(field_name, old_value, new_value)
  where changed.old_value is distinct from changed.new_value;

  return new;
end;
$$;

revoke all on function public.log_subcontractor_invoice_field_changes()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_field_changes
on public.subcontractor_invoices;
create trigger trg_subcontractor_invoice_field_changes
after update
on public.subcontractor_invoices
for each row
execute function public.log_subcontractor_invoice_field_changes();

create or replace function public.log_subcontractor_invoice_line_item_changes()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.subcontractor_invoice_audit_log (
    invoice_id,
    event_type,
    field_name,
    old_value,
    new_value,
    notes,
    actor_user_id,
    actor_email,
    created_at
  )
  values (
    new.invoice_id,
    'line_item.updated',
    'line_item_' || new.id::text,
    jsonb_build_object(
      'work_completed_period', old.work_completed_period,
      'materials_stored', old.materials_stored,
      'retainage_pct', old.retainage_pct,
      'materials_retainage_pct', old.materials_retainage_pct,
      'work_retainage_released', old.work_retainage_released,
      'materials_retainage_released', old.materials_retainage_released
    ),
    jsonb_build_object(
      'work_completed_period', new.work_completed_period,
      'materials_stored', new.materials_stored,
      'retainage_pct', new.retainage_pct,
      'materials_retainage_pct', new.materials_retainage_pct,
      'retainage_amount', new.retainage_amount,
      'materials_retainage_amount', new.materials_retainage_amount,
      'work_retainage_released', new.work_retainage_released,
      'materials_retainage_released', new.materials_retainage_released
    ),
    'Updated invoice line item',
    (select auth.uid()),
    (
      select u.email
      from auth.users u
      where u.id = (select auth.uid())
    ),
    now()
  );

  return new;
end;
$$;

revoke all on function public.log_subcontractor_invoice_line_item_changes()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_line_item_changes
on public.subcontractor_invoice_line_items;
create trigger trg_subcontractor_invoice_line_item_changes
after update
on public.subcontractor_invoice_line_items
for each row
execute function public.log_subcontractor_invoice_line_item_changes();

create or replace function public.log_subcontractor_invoice_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    insert into public.subcontractor_invoice_audit_log (
      invoice_id,
      event_type,
      field_name,
      old_value,
      new_value,
      notes,
      actor_user_id,
      actor_email,
      created_at
    )
    values (
      new.id,
      'status.changed',
      'status',
      to_jsonb(old.status),
      to_jsonb(new.status),
      'Status changed from '
        || coalesce(old.status::text, 'none')
        || ' to '
        || new.status::text,
      (select auth.uid()),
      (
        select u.email
        from auth.users u
        where u.id = (select auth.uid())
      ),
      now()
    );
  end if;

  return new;
end;
$$;

revoke all on function public.log_subcontractor_invoice_status_change()
from public, anon, authenticated;

commit;
