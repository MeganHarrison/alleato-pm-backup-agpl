-- AAI-1096: project_current_state is a derived read model, not a shared
-- mutation surface. Both producers submit versioned envelopes to this function;
-- the guarded table only accepts writes made by the boundary below.

alter table public.project_current_state
  add column if not exists projection_writer text,
  add column if not exists projection_generated_at timestamptz,
  add column if not exists projection_envelope_id text,
  add column if not exists projection_provenance jsonb not null default '{}'::jsonb;

alter table public.project_current_state
  drop constraint if exists project_current_state_projection_writer_check;

alter table public.project_current_state
  add constraint project_current_state_projection_writer_check
  check (projection_writer is null or projection_writer in ('compiler', 'daily_deep_read'));

create table if not exists public.project_current_state_projection_envelopes (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on update cascade on delete cascade,
  writer text not null check (writer in ('compiler', 'daily_deep_read')),
  envelope_id text not null,
  generated_at timestamptz not null,
  projection jsonb not null,
  provenance jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default timezone('utc'::text, now()),
  unique (project_id, writer, envelope_id)
);

create index if not exists project_current_state_projection_envelopes_project_generated_idx
  on public.project_current_state_projection_envelopes(project_id, generated_at desc);

alter table public.project_current_state_projection_envelopes enable row level security;

drop policy if exists service_read_project_current_state_projection_envelopes
  on public.project_current_state_projection_envelopes;
create policy service_read_project_current_state_projection_envelopes
  on public.project_current_state_projection_envelopes
  for select
  to service_role
  using (true);

-- A direct mutation means a producer bypassed freshness, duplicate, and lineage
-- checks. The SECURITY DEFINER boundary uses this narrow, transaction-local
-- capability; it is deliberately not a client-controlled API contract.
create or replace function public.guard_project_current_state_direct_write()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if current_setting('app.project_current_state_projection_boundary', true) is distinct from 'true' then
    raise exception using
      errcode = 'P0001',
      message = 'DIRECT_PROJECT_CURRENT_STATE_WRITE_BLOCKED',
      detail = 'Use public.apply_project_current_state_projection with a versioned envelope.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_project_current_state_direct_write on public.project_current_state;
create trigger guard_project_current_state_direct_write
  before insert or update or delete on public.project_current_state
  for each row execute function public.guard_project_current_state_direct_write();

create or replace function public.apply_project_current_state_projection(
  p_project_id integer,
  p_projection jsonb,
  p_writer text,
  p_provenance jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_existing public.project_current_state%rowtype;
  v_result public.project_current_state%rowtype;
  v_generated_at timestamptz;
  v_envelope_id text;
  v_envelope_row_id uuid;
  v_packet_id uuid;
  v_delta_id uuid;
  v_snapshot_id uuid;
  v_unknown_key text;
  v_has_existing boolean := false;
  v_allowed_keys constant text[] := array[
    'current_summary', 'health_status', 'what_changed_since_last_update',
    'needs_attention', 'open_decisions', 'active_risks', 'financial_read',
    'schedule_read', 'field_read', 'source_confidence', 'last_delta_id',
    'last_snapshot_id'
  ];
begin
  if p_project_id is null or p_project_id <= 0 then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_project_id', 'project_id', p_project_id);
  end if;
  if p_writer is null or p_writer not in ('compiler', 'daily_deep_read') then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'unsupported_writer', 'project_id', p_project_id, 'writer', p_writer);
  end if;
  if jsonb_typeof(p_projection) is distinct from 'object' then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'projection_must_be_object', 'project_id', p_project_id, 'writer', p_writer);
  end if;
  if jsonb_typeof(p_provenance) is distinct from 'object' then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'provenance_must_be_object', 'project_id', p_project_id, 'writer', p_writer);
  end if;
  if p_projection = '{}'::jsonb then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'empty_projection', 'project_id', p_project_id, 'writer', p_writer);
  end if;

  select key into v_unknown_key
  from jsonb_object_keys(p_projection) as key
  where not (key = any(v_allowed_keys))
  limit 1;
  if v_unknown_key is not null then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'unsupported_projection_field', 'field', v_unknown_key, 'project_id', p_project_id, 'writer', p_writer);
  end if;
  if (p_projection ? 'health_status')
    and coalesce(p_projection->>'health_status', '') not in ('on_track', 'watch', 'at_risk', 'critical', 'unknown') then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_health_status', 'project_id', p_project_id, 'writer', p_writer);
  end if;
  if exists (
    select 1
    from unnest(array['what_changed_since_last_update', 'needs_attention', 'open_decisions', 'active_risks']) as key
    where p_projection ? key and jsonb_typeof(p_projection->key) <> 'array'
  ) then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_projection_array', 'project_id', p_project_id, 'writer', p_writer);
  end if;

  begin
    v_generated_at := nullif(p_provenance->>'generated_at', '')::timestamptz;
  exception when others then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_generated_at', 'project_id', p_project_id, 'writer', p_writer);
  end;
  if v_generated_at is null then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'missing_generated_at', 'project_id', p_project_id, 'writer', p_writer);
  end if;

  if p_writer = 'daily_deep_read' then
    begin
      v_packet_id := nullif(p_provenance->>'packet_id', '')::uuid;
    exception when others then
      return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_packet_lineage', 'project_id', p_project_id, 'writer', p_writer);
    end;
    if v_packet_id is null or not exists (
      select 1
      from public.intelligence_packets packet
      join public.intelligence_targets target on target.id = packet.target_id
      where packet.id = v_packet_id
        and target.slug = 'daily-executive-brief'
        and packet.packet_json->>'kind' = 'daily_deep_read'
    ) then
      return jsonb_build_object('outcome', 'rejected', 'reason', 'missing_packet_lineage', 'project_id', p_project_id, 'writer', p_writer);
    end if;
    v_envelope_id := coalesce(nullif(p_provenance->>'envelope_id', ''), v_packet_id::text);
  else
    begin
      v_delta_id := nullif(p_projection->>'last_delta_id', '')::uuid;
      v_snapshot_id := nullif(p_projection->>'last_snapshot_id', '')::uuid;
    exception when others then
      return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_compiler_lineage', 'project_id', p_project_id, 'writer', p_writer);
    end;
    if v_delta_id is null or v_snapshot_id is null then
      return jsonb_build_object('outcome', 'rejected', 'reason', 'missing_compiler_lineage', 'project_id', p_project_id, 'writer', p_writer);
    end if;
    v_envelope_id := coalesce(nullif(p_provenance->>'envelope_id', ''), v_delta_id::text);
  end if;

  select * into v_existing
  from public.project_current_state
  where project_id = p_project_id
  for update;
  v_has_existing := found;

  if exists (
    select 1 from public.project_current_state_projection_envelopes
    where project_id = p_project_id and writer = p_writer and envelope_id = v_envelope_id
  ) then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'duplicate_envelope', 'project_id', p_project_id, 'writer', p_writer, 'row', to_jsonb(v_existing));
  end if;

  -- A Daily Deep Read is the preferred packet-derived read. Compiler output is
  -- L2 fallback only, and a Daily envelope may not travel backwards in time.
  if v_has_existing and v_existing.projection_writer = 'daily_deep_read' and p_writer = 'compiler' then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'daily_deep_read_precedence', 'project_id', p_project_id, 'writer', p_writer, 'row', to_jsonb(v_existing));
  end if;
  if v_has_existing and v_existing.projection_generated_at is not null and v_generated_at <= v_existing.projection_generated_at then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'stale_envelope', 'project_id', p_project_id, 'writer', p_writer, 'row', to_jsonb(v_existing));
  end if;

  insert into public.project_current_state_projection_envelopes (
    project_id, writer, envelope_id, generated_at, projection, provenance
  ) values (
    p_project_id, p_writer, v_envelope_id, v_generated_at, p_projection, p_provenance
  ) on conflict (project_id, writer, envelope_id) do nothing
  returning id into v_envelope_row_id;

  if v_envelope_row_id is null then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'duplicate_envelope', 'project_id', p_project_id, 'writer', p_writer, 'row', to_jsonb(v_existing));
  end if;

  perform set_config('app.project_current_state_projection_boundary', 'true', true);

  if v_has_existing then
    update public.project_current_state
    set current_summary = case when p_projection ? 'current_summary' then p_projection->>'current_summary' else current_summary end,
        health_status = case when p_projection ? 'health_status' then p_projection->>'health_status' else health_status end,
        what_changed_since_last_update = case when p_projection ? 'what_changed_since_last_update' then p_projection->'what_changed_since_last_update' else what_changed_since_last_update end,
        needs_attention = case when p_projection ? 'needs_attention' then p_projection->'needs_attention' else needs_attention end,
        open_decisions = case when p_projection ? 'open_decisions' then p_projection->'open_decisions' else open_decisions end,
        active_risks = case when p_projection ? 'active_risks' then p_projection->'active_risks' else active_risks end,
        financial_read = case when p_projection ? 'financial_read' then p_projection->>'financial_read' else financial_read end,
        schedule_read = case when p_projection ? 'schedule_read' then p_projection->>'schedule_read' else schedule_read end,
        field_read = case when p_projection ? 'field_read' then p_projection->>'field_read' else field_read end,
        source_confidence = case when p_projection ? 'source_confidence' then p_projection->'source_confidence' else source_confidence end,
        last_delta_id = case when p_projection ? 'last_delta_id' then nullif(p_projection->>'last_delta_id', '')::uuid else last_delta_id end,
        last_snapshot_id = case when p_projection ? 'last_snapshot_id' then nullif(p_projection->>'last_snapshot_id', '')::uuid else last_snapshot_id end,
        projection_writer = p_writer,
        projection_generated_at = v_generated_at,
        projection_envelope_id = v_envelope_id,
        projection_provenance = p_provenance
    where project_id = p_project_id
    returning * into v_result;
  else
    insert into public.project_current_state (
      project_id, current_summary, health_status, what_changed_since_last_update,
      needs_attention, open_decisions, active_risks, financial_read, schedule_read,
      field_read, source_confidence, last_delta_id, last_snapshot_id,
      projection_writer, projection_generated_at, projection_envelope_id, projection_provenance
    ) values (
      p_project_id,
      case when p_projection ? 'current_summary' then p_projection->>'current_summary' else null end,
      coalesce(nullif(p_projection->>'health_status', ''), 'unknown'),
      coalesce(p_projection->'what_changed_since_last_update', '[]'::jsonb),
      coalesce(p_projection->'needs_attention', '[]'::jsonb),
      coalesce(p_projection->'open_decisions', '[]'::jsonb),
      coalesce(p_projection->'active_risks', '[]'::jsonb),
      case when p_projection ? 'financial_read' then p_projection->>'financial_read' else null end,
      case when p_projection ? 'schedule_read' then p_projection->>'schedule_read' else null end,
      case when p_projection ? 'field_read' then p_projection->>'field_read' else null end,
      coalesce(p_projection->'source_confidence', '{}'::jsonb),
      case when p_projection ? 'last_delta_id' then nullif(p_projection->>'last_delta_id', '')::uuid else null end,
      case when p_projection ? 'last_snapshot_id' then nullif(p_projection->>'last_snapshot_id', '')::uuid else null end,
      p_writer, v_generated_at, v_envelope_id, p_provenance
    ) returning * into v_result;
  end if;

  return jsonb_build_object(
    'outcome', 'applied', 'reason', 'accepted_envelope', 'project_id', p_project_id,
    'writer', p_writer, 'row', to_jsonb(v_result), 'provenance', p_provenance
  );
end;
$$;

revoke all on function public.apply_project_current_state_projection(integer, jsonb, text, jsonb) from public;
grant execute on function public.apply_project_current_state_projection(integer, jsonb, text, jsonb) to service_role;

comment on function public.apply_project_current_state_projection(integer, jsonb, text, jsonb) is
  'AAI-1096 controlled writer for project_current_state. Daily Deep Read is preferred; compiler is L2 fallback.';
