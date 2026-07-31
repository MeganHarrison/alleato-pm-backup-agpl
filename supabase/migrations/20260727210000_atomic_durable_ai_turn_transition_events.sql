create or replace function public.persist_durable_ai_turn_transition(
  p_turn_id uuid,
  p_actor_id uuid,
  p_expected_version bigint,
  p_expected_status text,
  p_changes jsonb,
  p_events jsonb
)
returns setof public.durable_ai_turns
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.durable_ai_turns%rowtype;
  v_updated public.durable_ai_turns%rowtype;
  v_changes jsonb := coalesce(p_changes, '{}'::jsonb);
  v_events jsonb := coalesce(p_events, '[]'::jsonb);
  v_first_sequence integer;
  v_event record;
begin
  if jsonb_typeof(v_changes) <> 'object' then
    raise exception 'durable AI turn changes must be a JSON object';
  end if;
  if jsonb_typeof(v_events) <> 'array' then
    raise exception 'durable AI turn events must be a JSON array';
  end if;

  select *
  into v_current
  from public.durable_ai_turns
  where id = p_turn_id
    and user_id = p_actor_id
  for update;

  if not found
    or v_current.version <> p_expected_version
    or v_current.status <> p_expected_status
  then
    return;
  end if;

  select *
  into v_updated
  from jsonb_populate_record(v_current, v_changes);

  update public.durable_ai_turns
  set
    status = v_updated.status,
    stage = v_updated.stage,
    terminal_outcome = v_updated.terminal_outcome,
    source_receipts = v_updated.source_receipts,
    warning_messages = v_updated.warning_messages,
    cancellation_requested_at = v_updated.cancellation_requested_at,
    runtime_kind = v_updated.runtime_kind,
    runtime_locator = v_updated.runtime_locator,
    started_at = v_updated.started_at,
    completed_at = v_updated.completed_at,
    error_message = v_updated.error_message,
    updated_at = v_updated.updated_at,
    version = v_current.version + 1
  where id = v_current.id
  returning * into v_updated;

  select coalesce(max(sequence), 0) + 1
  into v_first_sequence
  from public.durable_ai_turn_events
  where turn_id = p_turn_id;

  for v_event in
    select value, ordinality
    from jsonb_array_elements(v_events) with ordinality
  loop
    if nullif(v_event.value ->> 'event_type', '') is null
      or nullif(v_event.value ->> 'occurred_at', '') is null
    then
      raise exception 'durable AI turn events require event_type and occurred_at';
    end if;

    insert into public.durable_ai_turn_events (
      turn_id,
      sequence,
      event_type,
      durability,
      occurred_at,
      data
    )
    values (
      p_turn_id,
      v_first_sequence + v_event.ordinality::integer - 1,
      v_event.value ->> 'event_type',
      'durable',
      (v_event.value ->> 'occurred_at')::timestamptz,
      coalesce(v_event.value -> 'data', '{}'::jsonb)
    );
  end loop;

  return next v_updated;
end;
$$;

revoke all on function public.persist_durable_ai_turn_transition(
  uuid,
  uuid,
  bigint,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_durable_ai_turn_transition(
  uuid,
  uuid,
  bigint,
  text,
  jsonb,
  jsonb
) to service_role;

comment on function public.persist_durable_ai_turn_transition(
  uuid,
  uuid,
  bigint,
  text,
  jsonb,
  jsonb
) is
  'Atomically persists one optimistic durable AI turn version and its contiguous replay events.';
