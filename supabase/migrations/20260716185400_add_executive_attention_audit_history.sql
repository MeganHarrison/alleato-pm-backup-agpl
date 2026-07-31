-- AAI-1102: make the Executive Attention lifecycle auditable at the same
-- controlled RPC boundary as the AAI-1097 evidence and human-resolution rules.

begin;

create table if not exists public.executive_attention_history (
  id uuid primary key default gen_random_uuid(),
  attention_id uuid not null references public.executive_attention_items(id) on delete cascade,
  action text not null check (action in (
    'created', 'acknowledged', 'in_progress', 'escalated', 'resolved', 'dismissed'
  )),
  actor_kind text not null check (actor_kind in ('human', 'ai', 'system')),
  actor_label text not null check (length(trim(actor_label)) > 0),
  actor_user_id uuid,
  rationale text not null check (length(trim(rationale)) > 0),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (action not in ('resolved', 'dismissed') or actor_kind = 'human')
);

create index if not exists executive_attention_history_attention_idx
  on public.executive_attention_history (attention_id, created_at asc);

create or replace function public.prevent_executive_attention_history_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception using
      errcode = '55000',
      message = 'Executive attention history is append-only',
      hint = 'Record a new lifecycle event; do not rewrite or delete prior executive actions.';
  end if;
  return new;
end;
$$;

drop trigger if exists executive_attention_history_append_only on public.executive_attention_history;
create trigger executive_attention_history_append_only
before update or delete on public.executive_attention_history
for each row execute function public.prevent_executive_attention_history_mutation();

alter table public.executive_attention_history enable row level security;
revoke all on public.executive_attention_history from anon, authenticated, service_role;

create or replace function public.create_executive_attention_item(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_evidence jsonb;
  v_evidence_item jsonb;
  v_priority text;
  v_actor_kind text;
  v_actor_label text;
begin
  if jsonb_typeof(p_input) <> 'object' then
    raise exception 'Executive attention input must be a JSON object';
  end if;
  if coalesce(nullif(trim(p_input->>'title'), ''), '') = ''
    or coalesce(nullif(trim(p_input->>'summary'), ''), '') = '' then
    raise exception 'Executive attention requires non-empty title and summary';
  end if;
  v_evidence := p_input->'evidence';
  if jsonb_typeof(v_evidence) <> 'array' or jsonb_array_length(v_evidence) = 0 then
    raise exception 'Executive attention requires at least one immutable evidence link';
  end if;
  if coalesce(p_input->>'lifecycle', 'open') <> 'open' then
    raise exception 'Executive attention must be created open; resolution requires an explicit human RPC';
  end if;
  v_priority := p_input->>'priority';
  if v_priority in ('critical', 'high') then
    if coalesce(nullif(trim(p_input->>'accountable_owner_label'), ''), '') = ''
      or nullif(p_input->>'due_at', '') is null then
      raise exception 'Critical and High executive attention requires an accountable owner and due date';
    end if;
    if coalesce(p_input->'metadata'->>'canonical_packet_freshness', '') <> 'fresh' then
      raise exception 'Critical and High executive attention requires fresh canonical packet evidence';
    end if;
  end if;

  v_actor_kind := coalesce(p_input->>'actor_kind', 'system');
  v_actor_label := coalesce(nullif(trim(p_input->'metadata'->>'created_by_label'), ''), 'Executive operating system');

  insert into public.executive_attention_items (
    project_id, category, title, summary, priority, lifecycle,
    accountable_owner_person_id, accountable_owner_label, due_at,
    escalation_level, assigned_at, created_by_actor_kind, metadata
  ) values (
    nullif(p_input->>'project_id', '')::integer,
    p_input->>'category', p_input->>'title', p_input->>'summary', v_priority, 'open',
    nullif(p_input->>'accountable_owner_person_id', '')::uuid,
    p_input->>'accountable_owner_label', nullif(p_input->>'due_at', '')::timestamptz,
    coalesce((p_input->>'escalation_level')::integer, 0),
    nullif(p_input->>'assigned_at', '')::timestamptz,
    v_actor_kind, coalesce(p_input->'metadata', '{}'::jsonb)
  ) returning id into v_id;

  for v_evidence_item in select value from jsonb_array_elements(v_evidence)
  loop
    if coalesce(nullif(trim(v_evidence_item->>'source_type'), ''), '') = ''
      or coalesce(nullif(trim(v_evidence_item->>'source_id'), ''), '') = ''
      or coalesce(nullif(trim(v_evidence_item->>'source_hash'), ''), '') = '' then
      raise exception 'Every executive attention evidence link requires source_type, source_id, and source_hash';
    end if;
    insert into public.executive_attention_evidence (
      attention_id, source_type, source_id, source_hash, source_url, source_excerpt,
      source_occurred_at, metadata
    ) values (
      v_id, v_evidence_item->>'source_type', v_evidence_item->>'source_id',
      v_evidence_item->>'source_hash', nullif(v_evidence_item->>'source_url', ''),
      nullif(v_evidence_item->>'source_excerpt', ''), nullif(v_evidence_item->>'source_occurred_at', '')::timestamptz,
      coalesce(v_evidence_item->'metadata', '{}'::jsonb)
    );
  end loop;

  insert into public.executive_attention_history (
    attention_id, action, actor_kind, actor_label, rationale, snapshot
  ) values (
    v_id, 'created', v_actor_kind, v_actor_label,
    'Evidence-backed executive attention item created.',
    jsonb_build_object('priority', v_priority, 'category', p_input->>'category', 'evidence_count', jsonb_array_length(v_evidence))
  );
  return v_id;
end;
$$;

create or replace function public.resolve_executive_attention_item(
  p_attention_id uuid,
  p_actor_label text,
  p_actor_kind text,
  p_resolution_summary text,
  p_dismiss boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_lifecycle text;
begin
  v_user_id := public.assert_executive_human_resolver();
  if p_actor_kind <> 'human' then
    raise exception using errcode = '42501',
      message = 'Executive attention outcome cannot be attributed to a non-human actor';
  end if;
  if coalesce(length(trim(p_actor_label)), 0) = 0 or coalesce(length(trim(p_resolution_summary)), 0) = 0 then
    raise exception 'Executive attention resolution requires a human resolver label and non-empty rationale';
  end if;
  update public.executive_attention_items
  set lifecycle = case when p_dismiss then 'dismissed' else 'resolved' end,
      resolved_at = timezone('utc', now()), resolved_by_label = p_actor_label,
      resolved_by_user_id = v_user_id, resolution_summary = p_resolution_summary,
      updated_at = timezone('utc', now())
  where id = p_attention_id and lifecycle not in ('resolved', 'dismissed')
  returning lifecycle into v_lifecycle;
  if not found then
    raise exception 'Executive attention % is missing or already closed', p_attention_id;
  end if;
  insert into public.executive_attention_history (
    attention_id, action, actor_kind, actor_label, actor_user_id, rationale, snapshot
  ) values (
    p_attention_id, v_lifecycle, 'human', p_actor_label, v_user_id, p_resolution_summary,
    jsonb_build_object('lifecycle', v_lifecycle)
  );
end;
$$;

create or replace function public.transition_executive_attention_item(
  p_attention_id uuid,
  p_actor_label text,
  p_lifecycle text,
  p_escalation_level integer default null,
  p_assigned_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_escalation_level integer;
begin
  v_user_id := public.assert_executive_human_resolver();
  if p_lifecycle not in ('acknowledged', 'in_progress', 'escalated') then
    raise exception 'Use the explicit resolution function to close executive attention';
  end if;
  if coalesce(length(trim(p_actor_label)), 0) = 0 then
    raise exception 'Executive attention transition requires a named human actor';
  end if;
  update public.executive_attention_items
  set lifecycle = p_lifecycle,
      escalation_level = coalesce(p_escalation_level, escalation_level),
      assigned_at = coalesce(p_assigned_at, assigned_at),
      updated_at = timezone('utc', now())
  where id = p_attention_id and lifecycle not in ('resolved', 'dismissed')
  returning escalation_level into v_escalation_level;
  if not found then
    raise exception 'Executive attention % is missing or already closed', p_attention_id;
  end if;
  insert into public.executive_attention_history (
    attention_id, action, actor_kind, actor_label, actor_user_id, rationale, snapshot
  ) values (
    p_attention_id, p_lifecycle, 'human', p_actor_label, v_user_id,
    case when p_lifecycle = 'escalated' then 'Executive attention escalated.' else 'Executive attention triaged.' end,
    jsonb_build_object('lifecycle', p_lifecycle, 'escalation_level', v_escalation_level, 'assigned_at', p_assigned_at)
  );
end;
$$;

revoke all on function public.create_executive_attention_item(jsonb) from public;
revoke all on function public.resolve_executive_attention_item(uuid, text, text, text, boolean) from public, anon, service_role;
revoke all on function public.transition_executive_attention_item(uuid, text, text, integer, timestamptz) from public, anon, service_role;
grant execute on function public.create_executive_attention_item(jsonb) to authenticated, service_role;
grant execute on function public.resolve_executive_attention_item(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.transition_executive_attention_item(uuid, text, text, integer, timestamptz) to authenticated;

commit;
