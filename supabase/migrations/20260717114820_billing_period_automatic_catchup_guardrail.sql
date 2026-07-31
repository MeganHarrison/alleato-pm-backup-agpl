-- Preserve the true current billing period when automatic generation catches up
-- missing historical occurrences. Historical rows are inserted closed; only a
-- generated occurrence newer than the period that was already open is activated.

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
  v_existing_period_id uuid;
  v_original_open_id uuid;
  v_original_open_start date;
  v_latest_period_id uuid;
  v_latest_start date;
  v_target public.billing_periods%rowtype;
  v_next_period_number integer;
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
    -- Serialize with manual create/edit operations for this project.
    perform 1
      from public.projects
     where id = v_settings.project_id
     for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'Project not found for automatic billing schedule.';
    end if;

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

      select id, due_date
        into v_existing_period_id, v_existing_due_date
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

        v_generated_count := v_generated_count + 1;
      end if;

      v_latest_period_id := v_existing_period_id;
      v_latest_start := v_start_date;
      v_settings.automatic_occurrence_cursor := v_settings.automatic_occurrence_cursor + 1;
      v_iteration := v_iteration + 1;

      update public.invoicing_settings
         set automatic_occurrence_cursor = v_settings.automatic_occurrence_cursor,
             updated_at = clock_timestamp()
       where id = v_settings.id;
    end loop;

    -- Catch-up must never replace a newer period that was already open. If the
    -- schedule advances beyond it (or no period was open), activate the latest
    -- generated occurrence through the canonical transition function.
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
  end loop;

  return v_generated_count;
end;
$$;

comment on function public.generate_automatic_billing_periods(date)
  is 'Generates due automatic periods without letting historical catch-up replace a newer open period.';
