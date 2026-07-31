-- Let automatic billing own the first period as well as future periods.
-- A project-scoped generator keeps immediate creation isolated to the schedule
-- being configured while the existing daily cron can still process all projects.

drop function if exists public.generate_automatic_billing_periods(date);

create or replace function public.generate_automatic_billing_periods(
  p_as_of date default current_date,
  p_project_id bigint default null
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
  v_existing_period_id uuid;
  v_existing_start_date date;
  v_existing_end_date date;
  v_original_open_id uuid;
  v_original_open_start date;
  v_latest_period_id uuid;
  v_latest_start date;
  v_target public.billing_periods%rowtype;
  v_next_period_number integer;
  v_generated_count integer := 0;
  v_project_generated_count integer;
  v_iteration integer;
  v_project_id bigint;
begin
  for v_project_id in
    select settings.project_id
      from public.invoicing_settings
       as settings
     where settings.automatic_billing_frequency <> 'never'
       and settings.automatic_anchor_start_date <= p_as_of
       and (p_project_id is null or settings.project_id = p_project_id)
     order by settings.project_id
  loop
    begin
      v_project_generated_count := 0;

      -- Creation, configuration, and cron generation lock projects before
      -- settings/period rows, avoiding a project/settings deadlock.
      perform 1
        from public.projects
       where id = v_project_id
       for update;

      if not found then
        raise exception using
          errcode = 'P0002',
          message = 'Project not found for automatic billing schedule.';
      end if;

      select *
        into v_settings
        from public.invoicing_settings
       where project_id = v_project_id
         and automatic_billing_frequency <> 'never'
         and automatic_anchor_start_date <= p_as_of
       for update;

      -- The schedule may have been disabled or moved into the future while this
      -- generator waited for the project lock.
      continue when not found;

      select id, start_date
        into v_original_open_id, v_original_open_start
        from public.billing_periods
       where project_id = v_settings.project_id
         and is_closed = false
       for update;

      v_latest_period_id := null;
      v_latest_start := null;
      v_iteration := 0;

      loop
        v_start_date := public.advance_billing_anchor(
          v_settings.automatic_anchor_start_date,
          v_settings.automatic_billing_frequency,
          v_settings.automatic_occurrence_cursor
        );

        exit when v_start_date > p_as_of;

        if v_iteration >= 120 then
          raise exception using
            errcode = '54000',
            message = format(
              'Automatic billing schedule for project %s exceeded the 120-period catch-up limit.',
              v_settings.project_id
            );
        end if;

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

        select id, start_date, end_date, due_date
          into
            v_existing_period_id,
            v_existing_start_date,
            v_existing_end_date,
            v_existing_due_date
          from public.billing_periods
         where project_id = v_settings.project_id
           and start_date <= v_end_date
           and end_date >= v_start_date
         order by
           (start_date = v_start_date and end_date = v_end_date) asc,
           start_date,
           end_date
         limit 1
         for update;

        if found then
          if v_existing_start_date <> v_start_date
             or v_existing_end_date <> v_end_date
             or v_existing_due_date is distinct from v_due_date then
            raise exception using
              errcode = '23505',
              message = format(
                'Automatic billing schedule for project %s (%s through %s) overlaps or conflicts with existing period %s through %s.',
                v_settings.project_id,
                v_start_date,
                v_end_date,
                v_existing_start_date,
                v_existing_end_date
              );
          end if;
        else
          select coalesce(max(period_number), 0) + 1
            into v_next_period_number
            from public.billing_periods
           where project_id = v_settings.project_id;

          insert into public.billing_periods (
            project_id,
            period_number,
            start_date,
            end_date,
            due_date,
            is_closed,
            closed_date,
            updated_at
          ) values (
            v_settings.project_id,
            v_next_period_number,
            v_start_date,
            v_end_date,
            v_due_date,
            true,
            clock_timestamp(),
            clock_timestamp()
          )
          returning id into v_existing_period_id;

          v_project_generated_count := v_project_generated_count + 1;
        end if;

        v_latest_period_id := v_existing_period_id;
        v_latest_start := v_start_date;
        v_settings.automatic_occurrence_cursor :=
          v_settings.automatic_occurrence_cursor + 1;
        v_iteration := v_iteration + 1;

        update public.invoicing_settings
           set automatic_occurrence_cursor =
                 v_settings.automatic_occurrence_cursor,
               updated_at = clock_timestamp()
         where id = v_settings.id;
      end loop;

      -- Catch-up must never replace a newer period that was already open. If
      -- the schedule advances beyond it (or no period was open), activate the
      -- latest generated occurrence through the canonical transition function.
      if v_latest_period_id is not null
         and (
           v_original_open_id is null
           or v_latest_start > v_original_open_start
         ) then
        select *
          into v_target
          from public.billing_periods
         where id = v_latest_period_id;

        perform public.save_billing_period_atomic(
          v_settings.project_id,
          v_target.id,
          v_target.start_date,
          v_target.end_date,
          v_target.due_date,
          v_target.name,
          false,
          null
        );
      end if;

      v_generated_count :=
        v_generated_count + v_project_generated_count;
    exception
      when check_violation
        or unique_violation
        or program_limit_exceeded
        or no_data_found then
        -- An interactive, project-scoped save must remain atomic and surface
        -- the exact failure. The global cron isolates one bad schedule so it
        -- cannot roll back every other project's successfully generated rows.
        if p_project_id is not null then
          raise;
        end if;

        raise warning
          'Automatic billing schedule for project % failed and was rolled back: %',
          v_project_id,
          sqlerrm;
    end;
  end loop;

  return v_generated_count;
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
    if p_anchor_start_date is null
       or p_anchor_end_date is null
       or p_anchor_due_date is null then
      raise exception using
        errcode = '23514',
        message =
          'From, To, and Due Date anchors are required for automatic billing periods.';
    end if;

    if p_anchor_start_date > p_anchor_end_date then
      raise exception using
        errcode = '23514',
        message = 'Automatic To date must be on or after From date.';
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

  if p_frequency <> 'never' then
    perform public.generate_automatic_billing_periods(
      current_date,
      p_project_id
    );

    select *
      into v_settings
      from public.invoicing_settings
     where project_id = p_project_id;
  end if;

  return v_settings;
end;
$$;

revoke execute
  on function public.generate_automatic_billing_periods(date, bigint)
  from public, anon, authenticated;
grant execute
  on function public.generate_automatic_billing_periods(date, bigint)
  to service_role;

comment on function public.generate_automatic_billing_periods(date, bigint)
  is 'Idempotently creates due automatic periods for one project or all projects without letting historical catch-up replace a newer open period.';
comment on function public.configure_automatic_billing_periods(
  bigint,
  public.billing_period_frequency,
  date,
  date,
  date
)
  is 'Atomically saves an automatic billing schedule and immediately creates every occurrence due as of the save date.';
