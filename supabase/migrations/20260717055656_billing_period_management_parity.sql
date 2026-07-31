-- Procore-parity billing period management.
--
-- Durable owners introduced here:
--   1. One atomic save transition that closes the previous open period.
--   2. One atomic delete guard covering every live billing-period FK consumer.
--   3. Monthly / weekly / never automation stored on invoicing_settings.
--   4. A daily pg_cron generator that derives every occurrence from anchors.

alter table public.billing_periods
  alter column project_id set not null,
  alter column is_closed set not null;

alter table public.billing_periods
  add constraint billing_periods_valid_date_range
  check (start_date <= end_date);

-- Eleven historical rows currently have no due date. Keep those rows readable,
-- but enforce a due date on every new or updated row until the legacy values can
-- be reconciled from source records and the constraint can be validated.
alter table public.billing_periods
  add constraint billing_periods_due_date_required
  check (due_date is not null) not valid;

create unique index uq_billing_periods_project_date_range
  on public.billing_periods(project_id, start_date, end_date);

create unique index uq_billing_periods_one_open
  on public.billing_periods(project_id)
  where is_closed = false;

create index if not exists idx_prime_contract_payment_applications_billing_period_id
  on public.prime_contract_payment_applications(billing_period_id);

create index if not exists idx_acumatica_ar_invoices_billing_period_id
  on public.acumatica_ar_invoices(billing_period_id);

-- Billing history is immutable once any downstream invoice/payment record uses
-- a period. Replace the three SET NULL relationships and the additional live
-- contract_payments relationship with explicit restrictive ownership.
alter table public.subcontractor_invoices
  drop constraint if exists subcontractor_invoices_billing_period_id_fkey,
  add constraint subcontractor_invoices_billing_period_id_fkey
    foreign key (billing_period_id)
    references public.billing_periods(id)
    on delete restrict;

alter table public.acumatica_ar_invoices
  drop constraint if exists acumatica_ar_invoices_billing_period_id_fkey,
  add constraint acumatica_ar_invoices_billing_period_id_fkey
    foreign key (billing_period_id)
    references public.billing_periods(id)
    on delete restrict;

alter table public.billing_invitations
  drop constraint if exists billing_invitations_billing_period_id_fkey,
  add constraint billing_invitations_billing_period_id_fkey
    foreign key (billing_period_id)
    references public.billing_periods(id)
    on delete restrict;

alter table public.contract_payments
  drop constraint if exists contract_payments_billing_period_id_fkey,
  add constraint contract_payments_billing_period_id_fkey
    foreign key (billing_period_id)
    references public.billing_periods(id)
    on delete restrict;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'billing_period_frequency'
  ) then
    create type public.billing_period_frequency as enum ('never', 'monthly', 'weekly');
  end if;
end
$$;

alter table public.invoicing_settings
  add column if not exists automatic_billing_frequency public.billing_period_frequency not null default 'never',
  add column if not exists automatic_anchor_start_date date,
  add column if not exists automatic_anchor_end_date date,
  add column if not exists automatic_anchor_due_date date,
  add column if not exists automatic_occurrence_cursor integer not null default 0;

alter table public.invoicing_settings
  add constraint invoicing_settings_automatic_cursor_nonnegative
    check (automatic_occurrence_cursor >= 0),
  add constraint invoicing_settings_automatic_dates_valid
    check (
      automatic_billing_frequency = 'never'
      or (
        automatic_anchor_start_date is not null
        and automatic_anchor_end_date is not null
        and automatic_anchor_due_date is not null
        and automatic_anchor_start_date <= automatic_anchor_end_date
      )
    );

create index idx_invoicing_settings_automatic_due
  on public.invoicing_settings(automatic_billing_frequency, automatic_anchor_start_date)
  where automatic_billing_frequency <> 'never';

create or replace function public.save_billing_period_atomic(
  p_project_id bigint,
  p_period_id uuid,
  p_start_date date,
  p_end_date date,
  p_due_date date,
  p_name text,
  p_is_closed boolean,
  p_actor_id uuid default null
)
returns public.billing_periods
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_period public.billing_periods%rowtype;
  v_next_period_number integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_start_date is null or p_end_date is null or p_due_date is null then
    raise exception using
      errcode = '23514',
      message = 'From, To, and Due Date are required.';
  end if;

  if p_start_date > p_end_date then
    raise exception using
      errcode = '23514',
      message = 'To date must be on or after From date.';
  end if;

  perform 1
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Project not found.';
  end if;

  if p_period_id is null then
    update public.billing_periods
       set is_closed = true,
           closed_date = coalesce(closed_date, v_now),
           closed_by = coalesce(closed_by, p_actor_id),
           updated_at = v_now
     where project_id = p_project_id
       and is_closed = false;

    select coalesce(max(period_number), 0) + 1
      into v_next_period_number
      from public.billing_periods
     where project_id = p_project_id;

    insert into public.billing_periods (
      project_id,
      period_number,
      start_date,
      end_date,
      due_date,
      name,
      is_closed,
      closed_date,
      closed_by,
      updated_at
    ) values (
      p_project_id,
      v_next_period_number,
      p_start_date,
      p_end_date,
      p_due_date,
      nullif(btrim(p_name), ''),
      false,
      null,
      null,
      v_now
    )
    returning * into v_period;
  else
    select *
      into v_period
      from public.billing_periods
     where id = p_period_id
       and project_id = p_project_id
     for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'Billing period not found for this project.';
    end if;

    if p_is_closed = false then
      update public.billing_periods
         set is_closed = true,
             closed_date = coalesce(closed_date, v_now),
             closed_by = coalesce(closed_by, p_actor_id),
             updated_at = v_now
       where project_id = p_project_id
         and id <> p_period_id
         and is_closed = false;
    end if;

    update public.billing_periods
       set start_date = p_start_date,
           end_date = p_end_date,
           due_date = p_due_date,
           name = nullif(btrim(p_name), ''),
           is_closed = p_is_closed,
           closed_date = case
             when p_is_closed = false then null
             when v_period.is_closed = false then v_now
             else v_period.closed_date
           end,
           closed_by = case
             when p_is_closed = false then null
             when v_period.is_closed = false then p_actor_id
             else v_period.closed_by
           end,
           updated_at = v_now
     where id = p_period_id
    returning * into v_period;
  end if;

  return v_period;
end;
$$;

create or replace function public.delete_billing_period_atomic(
  p_project_id bigint,
  p_period_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner_count bigint;
  v_prime_count bigint;
  v_subcontractor_count bigint;
  v_acumatica_count bigint;
  v_invitation_count bigint;
  v_contract_payment_count bigint;
begin
  perform 1
    from public.billing_periods
   where id = p_period_id
     and project_id = p_project_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Billing period not found for this project.';
  end if;

  select count(*) into v_owner_count
    from public.owner_invoices where billing_period_id = p_period_id;
  select count(*) into v_prime_count
    from public.prime_contract_payment_applications where billing_period_id = p_period_id;
  select count(*) into v_subcontractor_count
    from public.subcontractor_invoices where billing_period_id = p_period_id;
  select count(*) into v_acumatica_count
    from public.acumatica_ar_invoices where billing_period_id = p_period_id;
  select count(*) into v_invitation_count
    from public.billing_invitations where billing_period_id = p_period_id;
  select count(*) into v_contract_payment_count
    from public.contract_payments where billing_period_id = p_period_id;

  if v_owner_count + v_prime_count + v_subcontractor_count + v_acumatica_count
       + v_invitation_count + v_contract_payment_count > 0 then
    raise exception using
      errcode = '23503',
      message = 'This billing period is linked to invoice or payment history and cannot be deleted.',
      detail = json_build_object(
        'owner_invoices', v_owner_count,
        'prime_contract_payment_applications', v_prime_count,
        'subcontractor_invoices', v_subcontractor_count,
        'acumatica_ar_invoices', v_acumatica_count,
        'billing_invitations', v_invitation_count,
        'contract_payments', v_contract_payment_count
      )::text;
  end if;

  delete from public.billing_periods where id = p_period_id;
  return p_period_id;
end;
$$;

create or replace function public.configure_automatic_billing_periods(
  p_project_id bigint,
  p_frequency public.billing_period_frequency,
  p_anchor_start_date date default null,
  p_anchor_end_date date default null,
  p_anchor_due_date date default null
)
returns public.invoicing_settings
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_settings public.invoicing_settings%rowtype;
begin
  perform 1 from public.projects where id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;

  if p_frequency <> 'never' then
    if p_anchor_start_date is null or p_anchor_end_date is null or p_anchor_due_date is null then
      raise exception using
        errcode = '23514',
        message = 'From, To, and Due Date anchors are required for automatic billing periods.';
    end if;

    if p_anchor_start_date > p_anchor_end_date then
      raise exception using
        errcode = '23514',
        message = 'Automatic To date must be on or after From date.';
    end if;

    if not exists (
      select 1 from public.billing_periods where project_id = p_project_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Create the first billing period manually before enabling automatic billing periods.';
    end if;
  end if;

  insert into public.invoicing_settings (
    project_id,
    automatic_billing_frequency,
    automatic_anchor_start_date,
    automatic_anchor_end_date,
    automatic_anchor_due_date,
    automatic_occurrence_cursor,
    updated_at
  ) values (
    p_project_id,
    p_frequency,
    case when p_frequency = 'never' then null else p_anchor_start_date end,
    case when p_frequency = 'never' then null else p_anchor_end_date end,
    case when p_frequency = 'never' then null else p_anchor_due_date end,
    0,
    clock_timestamp()
  )
  on conflict (project_id) do update
    set automatic_billing_frequency = excluded.automatic_billing_frequency,
        automatic_anchor_start_date = excluded.automatic_anchor_start_date,
        automatic_anchor_end_date = excluded.automatic_anchor_end_date,
        automatic_anchor_due_date = excluded.automatic_anchor_due_date,
        automatic_occurrence_cursor = 0,
        updated_at = clock_timestamp()
  returning * into v_settings;

  return v_settings;
end;
$$;

create or replace function public.advance_billing_anchor(
  p_anchor date,
  p_frequency public.billing_period_frequency,
  p_occurrence integer
)
returns date
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select case
    when p_frequency = 'weekly'
      then p_anchor + (p_occurrence * 7)
    when p_frequency = 'monthly'
         and p_anchor = (date_trunc('month', p_anchor)::date + interval '1 month - 1 day')::date
      then (
        date_trunc('month', p_anchor + make_interval(months => p_occurrence))
        + interval '1 month - 1 day'
      )::date
    when p_frequency = 'monthly'
      then (p_anchor + make_interval(months => p_occurrence))::date
    else p_anchor
  end;
$$;

create or replace function public.generate_automatic_billing_periods(
  p_as_of date default current_date
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_settings public.invoicing_settings%rowtype;
  v_start_date date;
  v_end_date date;
  v_due_date date;
  v_existing_due_date date;
  v_generated_count integer := 0;
  v_iteration integer;
begin
  for v_settings in
    select *
      from public.invoicing_settings
     where automatic_billing_frequency <> 'never'
       and automatic_anchor_start_date <= p_as_of
     order by project_id
     for update
  loop
    v_iteration := 0;

    loop
      if v_iteration >= 120 then
        raise exception using
          errcode = '54000',
          message = format(
            'Automatic billing schedule for project %s exceeded the 120-period catch-up limit.',
            v_settings.project_id
          );
      end if;

      v_start_date := public.advance_billing_anchor(
        v_settings.automatic_anchor_start_date,
        v_settings.automatic_billing_frequency,
        v_settings.automatic_occurrence_cursor
      );

      exit when v_start_date > p_as_of;

      v_end_date := public.advance_billing_anchor(
        v_settings.automatic_anchor_end_date,
        v_settings.automatic_billing_frequency,
        v_settings.automatic_occurrence_cursor
      );
      v_due_date := public.advance_billing_anchor(
        v_settings.automatic_anchor_due_date,
        v_settings.automatic_billing_frequency,
        v_settings.automatic_occurrence_cursor
      );

      select due_date into v_existing_due_date
        from public.billing_periods
       where project_id = v_settings.project_id
         and start_date = v_start_date
         and end_date = v_end_date;

      if found then
        if v_existing_due_date is distinct from v_due_date then
          raise exception using
            errcode = '23505',
            message = format(
              'Automatic billing schedule conflicts with an existing period for project %s (%s through %s).',
              v_settings.project_id,
              v_start_date,
              v_end_date
            );
        end if;
      else
        perform public.save_billing_period_atomic(
          v_settings.project_id,
          null,
          v_start_date,
          v_end_date,
          v_due_date,
          null,
          false,
          null
        );
        v_generated_count := v_generated_count + 1;
      end if;

      v_settings.automatic_occurrence_cursor := v_settings.automatic_occurrence_cursor + 1;
      v_iteration := v_iteration + 1;

      update public.invoicing_settings
         set automatic_occurrence_cursor = v_settings.automatic_occurrence_cursor,
             updated_at = clock_timestamp()
       where id = v_settings.id;
    end loop;
  end loop;

  return v_generated_count;
end;
$$;

-- Replace the globally open policies with project-scoped read access. All
-- writes now pass through permission-checked API routes and service-role RPCs.
drop policy if exists "Users can manage billing periods" on public.billing_periods;
drop policy if exists "Users can view billing periods" on public.billing_periods;
drop policy if exists "Authenticated users can manage invoicing_settings" on public.invoicing_settings;

create policy "Project members can view billing periods"
  on public.billing_periods
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_access(project_id)
  );

create policy "Project members can view invoicing settings"
  on public.invoicing_settings
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_access(project_id)
  );

revoke insert, update, delete, truncate on public.billing_periods from anon, authenticated;
revoke insert, update, delete, truncate on public.invoicing_settings from anon, authenticated;

revoke execute on function public.save_billing_period_atomic(bigint, uuid, date, date, date, text, boolean, uuid)
  from public, anon, authenticated;
revoke execute on function public.delete_billing_period_atomic(bigint, uuid)
  from public, anon, authenticated;
revoke execute on function public.configure_automatic_billing_periods(bigint, public.billing_period_frequency, date, date, date)
  from public, anon, authenticated;
revoke execute on function public.generate_automatic_billing_periods(date)
  from public, anon, authenticated;

grant execute on function public.save_billing_period_atomic(bigint, uuid, date, date, date, text, boolean, uuid)
  to service_role;
grant execute on function public.delete_billing_period_atomic(bigint, uuid)
  to service_role;
grant execute on function public.configure_automatic_billing_periods(bigint, public.billing_period_frequency, date, date, date)
  to service_role;
grant execute on function public.generate_automatic_billing_periods(date)
  to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'billing-periods-daily';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end
$$;

select cron.schedule(
  'billing-periods-daily',
  '5 6 * * *',
  $cron$select public.generate_automatic_billing_periods(current_date);$cron$
);

comment on function public.save_billing_period_atomic(bigint, uuid, date, date, date, text, boolean, uuid)
  is 'Atomically creates or updates a billing period and enforces the one-open-period transition.';
comment on function public.delete_billing_period_atomic(bigint, uuid)
  is 'Deletes an unlinked billing period after checking every invoice and payment owner.';
comment on function public.generate_automatic_billing_periods(date)
  is 'Idempotently creates due monthly or weekly billing periods from persisted anchors.';
