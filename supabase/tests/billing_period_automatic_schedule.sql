-- Transactional contract for automatic first-period creation and calendar
-- month boundaries. Run against local or disposable staging databases only:
-- row writes are rolled back, but PostgreSQL sequence increments are not.

begin;

do $$
begin
  if public.advance_billing_anchor(date '2026-01-01', 'monthly', 1)
       <> date '2026-02-01' then
    raise exception 'Monthly first-day anchors drifted from the first day';
  end if;

  if public.advance_billing_anchor(date '2026-01-31', 'monthly', 1)
       <> date '2026-02-28' then
    raise exception 'Monthly last-day anchors did not use February 28';
  end if;

  if public.advance_billing_anchor(date '2028-01-31', 'monthly', 1)
       <> date '2028-02-29' then
    raise exception 'Monthly last-day anchors did not use leap-day February 29';
  end if;

  if public.advance_billing_anchor(date '2026-01-31', 'monthly', 3)
       <> date '2026-04-30' then
    raise exception 'Monthly last-day anchors did not use April 30';
  end if;
end
$$;

create temporary table automatic_billing_contract_context (
  test_index integer not null unique,
  project_id bigint not null
) on commit drop;

insert into automatic_billing_contract_context (test_index, project_id)
select row_number() over (order by candidate.id)::integer, candidate.id
from (
  select project.id
  from public.projects project
  where not exists (
    select 1
    from public.billing_periods period
    where period.project_id = project.id
  )
    and not exists (
    select 1
    from public.invoicing_settings settings
    where settings.project_id = project.id
  )
  order by project.id
  limit 2
) candidate;

do $$
declare
  v_project_id bigint;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date :=
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_generated integer;
begin
  select project_id
    into v_project_id
    from automatic_billing_contract_context
   where test_index = 1;

  if (
    select count(*)
    from automatic_billing_contract_context
  ) <> 2 then
    raise exception
      'Automatic billing contract requires two projects without periods or settings';
  end if;

  perform public.configure_automatic_billing_periods(
    v_project_id,
    'monthly',
    v_month_start,
    v_month_end,
    v_month_end
  );

  if (
    select count(*)
    from public.billing_periods
    where project_id = v_project_id
      and start_date = v_month_start
      and end_date = v_month_end
      and due_date = v_month_end
      and is_closed = false
  ) <> 1 then
    raise exception
      'Saving an automatic schedule did not create its first due open period';
  end if;

  if not exists (
    select 1
    from public.invoicing_settings
    where project_id = v_project_id
      and automatic_billing_frequency = 'monthly'
      and automatic_anchor_start_date = v_month_start
      and automatic_anchor_end_date = v_month_end
      and automatic_anchor_due_date = v_month_end
      and automatic_occurrence_cursor = 1
  ) then
    raise exception
      'Automatic schedule did not persist the anchors and advance its cursor';
  end if;

  begin
    perform public.configure_automatic_billing_periods(
      v_project_id,
      'monthly',
      v_month_start,
      v_month_end,
      v_month_end + 1
    );
    raise exception
      'A conflicting automatic schedule did not fail loudly';
  exception
    when unique_violation then
      null;
  end;

  if not exists (
    select 1
    from public.invoicing_settings
    where project_id = v_project_id
      and automatic_anchor_due_date = v_month_end
      and automatic_occurrence_cursor = 1
  ) then
    raise exception
      'A conflicting automatic schedule changed the prior saved schedule';
  end if;

  begin
    perform public.configure_automatic_billing_periods(
      v_project_id,
      'monthly',
      v_month_start + 1,
      v_month_end,
      v_month_end
    );
    raise exception
      'A partially overlapping automatic schedule did not fail loudly';
  exception
    when unique_violation then
      null;
  end;

  if not exists (
    select 1
    from public.invoicing_settings
    where project_id = v_project_id
      and automatic_anchor_start_date = v_month_start
      and automatic_anchor_end_date = v_month_end
      and automatic_anchor_due_date = v_month_end
      and automatic_occurrence_cursor = 1
  ) then
    raise exception
      'A partially overlapping schedule changed the prior saved schedule';
  end if;

  v_generated := public.generate_automatic_billing_periods(
    current_date,
    v_project_id
  );

  if v_generated <> 0 then
    raise exception
      'Re-running the automatic generator was not idempotent';
  end if;

  if (
    select count(*)
    from public.billing_periods
    where project_id = v_project_id
  ) <> 1 then
    raise exception
      'Idempotent generation created a duplicate billing period';
  end if;
end
$$;

do $$
declare
  v_project_id bigint;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date :=
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_next_month_start date :=
    (date_trunc('month', current_date) + interval '1 month')::date;
  v_next_month_end date :=
    (date_trunc('month', current_date) + interval '2 months - 1 day')::date;
begin
  select project_id
    into v_project_id
    from automatic_billing_contract_context
   where test_index = 1;

  delete from public.billing_periods where project_id = v_project_id;
  delete from public.invoicing_settings where project_id = v_project_id;

  perform public.save_billing_period_atomic(
    v_project_id,
    null,
    v_next_month_start,
    v_next_month_end,
    v_next_month_end,
    null,
    false,
    null
  );

  perform public.configure_automatic_billing_periods(
    v_project_id,
    'monthly',
    v_month_start,
    v_month_end,
    v_month_end
  );

  if not exists (
    select 1
    from public.billing_periods
    where project_id = v_project_id
      and start_date = v_next_month_start
      and end_date = v_next_month_end
      and is_closed = false
  ) then
    raise exception
      'Historical catch-up replaced a newer manually opened period';
  end if;

  if not exists (
    select 1
    from public.billing_periods
    where project_id = v_project_id
      and start_date = v_month_start
      and end_date = v_month_end
      and is_closed = true
  ) then
    raise exception
      'Historical catch-up did not preserve its generated row as closed';
  end if;
end
$$;

do $$
declare
  v_project_id bigint;
  v_anchor_start date :=
    (date_trunc('month', current_date) - interval '119 months')::date;
  v_anchor_end date :=
    (
      date_trunc(
        'month',
        date_trunc('month', current_date) - interval '119 months'
      )
      + interval '1 month - 1 day'
    )::date;
begin
  select project_id
    into v_project_id
    from automatic_billing_contract_context
   where test_index = 1;

  delete from public.billing_periods where project_id = v_project_id;
  delete from public.invoicing_settings where project_id = v_project_id;

  perform public.configure_automatic_billing_periods(
    v_project_id,
    'monthly',
    v_anchor_start,
    v_anchor_end,
    v_anchor_end
  );

  if (
    select count(*)
    from public.billing_periods
    where project_id = v_project_id
  ) <> 120 then
    raise exception
      'The 120-period catch-up boundary rejected or skipped a due occurrence';
  end if;

  if not exists (
    select 1
    from public.invoicing_settings
    where project_id = v_project_id
      and automatic_occurrence_cursor = 120
  ) then
    raise exception
      'The 120-period catch-up boundary did not advance the cursor to 120';
  end if;
end
$$;

do $$
declare
  v_success_project_id bigint;
  v_failure_project_id bigint;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date :=
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_future_start date :=
    (date_trunc('month', current_date) + interval '1 month')::date;
  v_future_end date :=
    (date_trunc('month', current_date) + interval '2 months - 1 day')::date;
  v_too_old_start date :=
    (date_trunc('month', current_date) - interval '120 months')::date;
  v_too_old_end date :=
    (
      date_trunc(
        'month',
        date_trunc('month', current_date) - interval '120 months'
      )
      + interval '1 month - 1 day'
    )::date;
  v_generated integer;
begin
  select project_id
    into v_success_project_id
    from automatic_billing_contract_context
   where test_index = 1;
  select project_id
    into v_failure_project_id
    from automatic_billing_contract_context
   where test_index = 2;

  delete from public.billing_periods
   where project_id in (v_success_project_id, v_failure_project_id);
  delete from public.invoicing_settings
   where project_id in (v_success_project_id, v_failure_project_id);

  perform public.configure_automatic_billing_periods(
    v_success_project_id,
    'monthly',
    v_future_start,
    v_future_end,
    v_future_end
  );
  perform public.configure_automatic_billing_periods(
    v_failure_project_id,
    'monthly',
    v_future_start,
    v_future_end,
    v_future_end
  );

  update public.invoicing_settings
     set automatic_anchor_start_date = v_month_start,
         automatic_anchor_end_date = v_month_end,
         automatic_anchor_due_date = v_month_end,
         automatic_occurrence_cursor = 0
   where project_id = v_success_project_id;
  update public.invoicing_settings
     set automatic_anchor_start_date = v_too_old_start,
         automatic_anchor_end_date = v_too_old_end,
         automatic_anchor_due_date = v_too_old_end,
         automatic_occurrence_cursor = 0
   where project_id = v_failure_project_id;

  v_generated := public.generate_automatic_billing_periods(current_date);

  if v_generated <> 1 then
    raise exception
      'Global generation included rolled-back rows in its generated count';
  end if;

  if (
    select count(*)
    from public.billing_periods
    where project_id = v_success_project_id
      and start_date = v_month_start
      and end_date = v_month_end
  ) <> 1 then
    raise exception
      'One invalid project prevented another project from generating';
  end if;

  if exists (
    select 1
    from public.billing_periods
    where project_id = v_failure_project_id
  ) then
    raise exception
      'Failed-project rows were not rolled back in global generation';
  end if;

  if not exists (
    select 1
    from public.invoicing_settings
    where project_id = v_failure_project_id
      and automatic_occurrence_cursor = 0
  ) then
    raise exception
      'Failed-project cursor advancement was not rolled back';
  end if;
end
$$;

rollback;
