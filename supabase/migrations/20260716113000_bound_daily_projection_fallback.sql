-- AAI-1096 follow-up: Daily Deep Read is preferred only while it is fresh.
-- A compiler envelope generated more than 26 hours later is the documented L2
-- fallback and must be allowed to refresh the derived operating record.

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
  v_projected public.project_current_state%rowtype;
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
  if jsonb_typeof(p_projection) is distinct from 'object' or p_projection = '{}'::jsonb then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_projection', 'project_id', p_project_id, 'writer', p_writer);
  end if;
  if jsonb_typeof(p_provenance) is distinct from 'object' then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'provenance_must_be_object', 'project_id', p_project_id, 'writer', p_writer);
  end if;
  select key into v_unknown_key from jsonb_object_keys(p_projection) as key
  where not (key = any(v_allowed_keys)) limit 1;
  if v_unknown_key is not null then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'unsupported_projection_field', 'field', v_unknown_key, 'project_id', p_project_id, 'writer', p_writer);
  end if;
  if (p_projection ? 'health_status') and coalesce(p_projection->>'health_status', '') not in ('on_track', 'watch', 'at_risk', 'critical', 'unknown') then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_health_status', 'project_id', p_project_id, 'writer', p_writer);
  end if;
  if exists (select 1 from unnest(array['what_changed_since_last_update', 'needs_attention', 'open_decisions', 'active_risks']) as key
    where p_projection ? key and jsonb_typeof(p_projection->key) <> 'array') then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_projection_array', 'project_id', p_project_id, 'writer', p_writer);
  end if;
  begin v_generated_at := nullif(p_provenance->>'generated_at', '')::timestamptz;
  exception when others then return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_generated_at', 'project_id', p_project_id, 'writer', p_writer); end;
  if v_generated_at is null then
    return jsonb_build_object('outcome', 'rejected', 'reason', 'missing_generated_at', 'project_id', p_project_id, 'writer', p_writer);
  end if;

  if p_writer = 'daily_deep_read' then
    begin v_packet_id := nullif(p_provenance->>'packet_id', '')::uuid;
    exception when others then return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_packet_lineage', 'project_id', p_project_id, 'writer', p_writer); end;
    if v_packet_id is null or not exists (
      select 1 from public.intelligence_packets packet join public.intelligence_targets target on target.id = packet.target_id
      where packet.id = v_packet_id and target.slug = 'daily-executive-brief' and packet.packet_json->>'kind' = 'daily_deep_read'
    ) then return jsonb_build_object('outcome', 'rejected', 'reason', 'missing_packet_lineage', 'project_id', p_project_id, 'writer', p_writer); end if;
    v_envelope_id := coalesce(nullif(p_provenance->>'envelope_id', ''), v_packet_id::text);
  else
    begin
      v_delta_id := nullif(p_projection->>'last_delta_id', '')::uuid;
      v_snapshot_id := nullif(p_projection->>'last_snapshot_id', '')::uuid;
    exception when others then return jsonb_build_object('outcome', 'rejected', 'reason', 'invalid_compiler_lineage', 'project_id', p_project_id, 'writer', p_writer); end;
    if v_delta_id is null or v_snapshot_id is null then
      return jsonb_build_object('outcome', 'rejected', 'reason', 'missing_compiler_lineage', 'project_id', p_project_id, 'writer', p_writer);
    end if;
    v_envelope_id := coalesce(nullif(p_provenance->>'envelope_id', ''), v_delta_id::text);
  end if;

  select * into v_existing from public.project_current_state where project_id = p_project_id for update;
  v_has_existing := found;
  if exists (select 1 from public.project_current_state_projection_envelopes where project_id = p_project_id and writer = p_writer and envelope_id = v_envelope_id) then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'duplicate_envelope', 'project_id', p_project_id, 'writer', p_writer, 'row', to_jsonb(v_existing));
  end if;
  if v_has_existing and v_existing.projection_writer = 'daily_deep_read' and p_writer = 'compiler'
    and v_generated_at < v_existing.projection_generated_at + interval '26 hours' then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'daily_deep_read_precedence', 'project_id', p_project_id, 'writer', p_writer, 'row', to_jsonb(v_existing));
  end if;
  if v_has_existing and v_existing.projection_generated_at is not null and v_generated_at <= v_existing.projection_generated_at then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'stale_envelope', 'project_id', p_project_id, 'writer', p_writer, 'row', to_jsonb(v_existing));
  end if;

  insert into public.project_current_state_projection_envelopes (project_id, writer, envelope_id, generated_at, projection, provenance)
  values (p_project_id, p_writer, v_envelope_id, v_generated_at, p_projection, p_provenance)
  on conflict (project_id, writer, envelope_id) do nothing returning id into v_envelope_row_id;
  if v_envelope_row_id is null then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'duplicate_envelope', 'project_id', p_project_id, 'writer', p_writer, 'row', to_jsonb(v_existing));
  end if;
  perform set_config('app.project_current_state_projection_boundary', 'true', true);
  if v_has_existing then
    v_projected := jsonb_populate_record(v_existing, p_projection);
    update public.project_current_state set
      current_summary = v_projected.current_summary, health_status = v_projected.health_status,
      what_changed_since_last_update = v_projected.what_changed_since_last_update, needs_attention = v_projected.needs_attention,
      open_decisions = v_projected.open_decisions, active_risks = v_projected.active_risks,
      financial_read = v_projected.financial_read, schedule_read = v_projected.schedule_read, field_read = v_projected.field_read,
      source_confidence = v_projected.source_confidence, last_delta_id = v_projected.last_delta_id,
      last_snapshot_id = v_projected.last_snapshot_id, projection_writer = p_writer,
      projection_generated_at = v_generated_at, projection_envelope_id = v_envelope_id, projection_provenance = p_provenance
    where project_id = p_project_id returning * into v_result;
  else
    v_projected := jsonb_populate_record(null::public.project_current_state,
      jsonb_build_object('project_id', p_project_id, 'health_status', 'unknown', 'what_changed_since_last_update', '[]'::jsonb,
        'needs_attention', '[]'::jsonb, 'open_decisions', '[]'::jsonb, 'active_risks', '[]'::jsonb, 'source_confidence', '{}'::jsonb) || p_projection);
    insert into public.project_current_state (project_id, current_summary, health_status, what_changed_since_last_update, needs_attention,
      open_decisions, active_risks, financial_read, schedule_read, field_read, source_confidence, last_delta_id, last_snapshot_id,
      projection_writer, projection_generated_at, projection_envelope_id, projection_provenance)
    values (p_project_id, v_projected.current_summary, v_projected.health_status, v_projected.what_changed_since_last_update,
      v_projected.needs_attention, v_projected.open_decisions, v_projected.active_risks, v_projected.financial_read,
      v_projected.schedule_read, v_projected.field_read, v_projected.source_confidence, v_projected.last_delta_id, v_projected.last_snapshot_id,
      p_writer, v_generated_at, v_envelope_id, p_provenance) returning * into v_result;
  end if;
  return jsonb_build_object('outcome', 'applied', 'reason', 'accepted_envelope', 'project_id', p_project_id, 'writer', p_writer, 'row', to_jsonb(v_result), 'provenance', p_provenance);
end;
$$;

comment on function public.apply_project_current_state_projection(integer, jsonb, text, jsonb) is
  'AAI-1096 controlled writer for project_current_state. Daily Deep Read is preferred for 26 hours; compiler is the bounded L2 fallback.';
