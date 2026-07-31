create or replace function public.persist_durable_ai_turn_transition_v2(
  p_turn_id uuid,
  p_actor_id uuid,
  p_expected_version bigint,
  p_expected_status text,
  p_changes jsonb,
  p_events jsonb,
  p_approval_operation jsonb
)
returns setof public.durable_ai_turns
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.durable_ai_turns%rowtype;
  v_approval_operation jsonb := p_approval_operation;
  v_approval public.durable_ai_turn_approvals%rowtype;
  v_transition_count integer;
begin
  if v_approval_operation is not null
    and jsonb_typeof(v_approval_operation) <> 'null'
    and jsonb_typeof(v_approval_operation) <> 'object'
  then
    raise exception 'durable AI turn approval operation must be a JSON object or null';
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

  if v_approval_operation is not null
    and jsonb_typeof(v_approval_operation) <> 'null'
  then
    case v_approval_operation ->> 'action'
      when 'insert' then
        if nullif(v_approval_operation ->> 'request_id', '') is null
          or nullif(v_approval_operation ->> 'payload_identity', '') is null
          or nullif(v_approval_operation ->> 'prompt', '') is null
          or nullif(v_approval_operation ->> 'created_at', '') is null
        then
          raise exception 'durable AI turn approval insert is incomplete';
        end if;

        insert into public.durable_ai_turn_approvals (
          turn_id,
          request_id,
          payload_identity,
          prompt,
          status,
          created_at
        )
        values (
          p_turn_id,
          v_approval_operation ->> 'request_id',
          v_approval_operation ->> 'payload_identity',
          v_approval_operation ->> 'prompt',
          'pending',
          (v_approval_operation ->> 'created_at')::timestamptz
        )
        returning * into v_approval;

      when 'resolve' then
        if nullif(v_approval_operation ->> 'request_id', '') is null
          or nullif(v_approval_operation ->> 'payload_identity', '') is null
          or (v_approval_operation ->> 'decision') not in ('approved', 'rejected')
          or nullif(v_approval_operation ->> 'decision_at', '') is null
        then
          raise exception 'durable AI turn approval resolution is incomplete';
        end if;

        update public.durable_ai_turn_approvals
        set
          status = v_approval_operation ->> 'decision',
          decision_by = p_actor_id,
          decision_at =
            (v_approval_operation ->> 'decision_at')::timestamptz
        where turn_id = p_turn_id
          and request_id = v_approval_operation ->> 'request_id'
          and payload_identity =
            v_approval_operation ->> 'payload_identity'
          and status = 'pending'
        returning * into v_approval;

        if not found then
          return;
        end if;

      else
        raise exception 'unsupported durable AI turn approval operation';
    end case;
  end if;

  return query
  select *
  from public.persist_durable_ai_turn_transition(
    p_turn_id,
    p_actor_id,
    p_expected_version,
    p_expected_status,
    p_changes,
    p_events
  );

  get diagnostics v_transition_count = row_count;
  if v_transition_count <> 1 then
    raise exception 'durable AI turn transition did not persist exactly one row';
  end if;
end;
$$;

revoke all on function public.persist_durable_ai_turn_transition_v2(
  uuid,
  uuid,
  bigint,
  text,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_durable_ai_turn_transition_v2(
  uuid,
  uuid,
  bigint,
  text,
  jsonb,
  jsonb,
  jsonb
) to service_role;

comment on function public.persist_durable_ai_turn_transition_v2(
  uuid,
  uuid,
  bigint,
  text,
  jsonb,
  jsonb,
  jsonb
) is
  'Atomically persists an approval insert or resolution with its durable AI turn version and replay events.';
