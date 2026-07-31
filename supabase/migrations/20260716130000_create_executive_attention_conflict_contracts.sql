-- Executive Operating System Phase 0B.
--
-- Attention and conflict records are a distinct, evidence-linked domain. They
-- deliberately do not reuse project tasks, source-signal candidates, or the
-- normalized-event ownership boundary. Lifecycle writes go through the RPCs
-- below so an automated actor cannot silently resolve, dismiss, suppress, or
-- downgrade an item or choose a conflict outcome.

begin;

create table if not exists public.executive_attention_items (
  id uuid primary key default gen_random_uuid(),
  project_id integer references public.projects(id) on update cascade on delete set null,
  category text not null check (category in (
    'decision', 'risk', 'blocker', 'commitment', 'financial', 'schedule', 'delivery', 'process'
  )),
  title text not null check (length(trim(title)) > 0),
  summary text not null check (length(trim(summary)) > 0),
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  lifecycle text not null default 'open' check (lifecycle in (
    'open', 'acknowledged', 'in_progress', 'escalated', 'resolved', 'dismissed'
  )),
  accountable_owner_person_id uuid references public.people(id) on delete set null,
  accountable_owner_label text not null check (length(trim(accountable_owner_label)) > 0),
  due_at timestamptz,
  escalation_level integer not null default 0 check (escalation_level between 0 and 3),
  assigned_at timestamptz,
  resolved_at timestamptz,
  resolved_by_label text,
  resolution_summary text,
  created_by_actor_kind text not null check (created_by_actor_kind in ('human', 'ai', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (lifecycle in ('resolved', 'dismissed')) = (resolved_at is not null)
    and (lifecycle not in ('resolved', 'dismissed') or length(trim(coalesce(resolution_summary, ''))) > 0)
    and (lifecycle not in ('resolved', 'dismissed') or length(trim(coalesce(resolved_by_label, ''))) > 0)
  )
);

create table if not exists public.executive_attention_evidence (
  id uuid primary key default gen_random_uuid(),
  attention_id uuid not null references public.executive_attention_items(id) on delete cascade,
  source_type text not null check (source_type in (
    'source_signal_candidate', 'intelligence_packet', 'document', 'meeting', 'email',
    'transactional_record', 'project_current_state', 'manual_attestation'
  )),
  source_id text not null check (length(trim(source_id)) > 0),
  source_hash text not null check (length(trim(source_hash)) > 0),
  source_url text,
  source_excerpt text,
  source_occurred_at timestamptz,
  captured_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (attention_id, source_type, source_id, source_hash)
);

create table if not exists public.executive_claim_conflicts (
  id uuid primary key default gen_random_uuid(),
  attention_id uuid references public.executive_attention_items(id) on delete set null,
  project_id integer references public.projects(id) on update cascade on delete set null,
  subject text not null check (length(trim(subject)) > 0),
  status text not null default 'open' check (status in ('open', 'in_review', 'escalated', 'resolved', 'dismissed')),
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  resolution_due_at timestamptz not null,
  accountable_resolver_person_id uuid references public.people(id) on delete set null,
  accountable_resolver_label text not null check (length(trim(accountable_resolver_label)) > 0),
  resolved_at timestamptz,
  resolved_by_label text,
  resolution_summary text,
  created_by_actor_kind text not null check (created_by_actor_kind in ('human', 'ai', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (status in ('resolved', 'dismissed')) = (resolved_at is not null)
    and (status not in ('resolved', 'dismissed') or length(trim(coalesce(resolution_summary, ''))) > 0)
    and (status not in ('resolved', 'dismissed') or length(trim(coalesce(resolved_by_label, ''))) > 0)
  )
);

create table if not exists public.executive_conflict_claims (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.executive_claim_conflicts(id) on delete cascade,
  claim_label text not null check (length(trim(claim_label)) > 0),
  claim_value jsonb not null,
  source_type text not null check (source_type in (
    'source_signal_candidate', 'intelligence_packet', 'document', 'meeting', 'email',
    'transactional_record', 'project_current_state', 'manual_attestation'
  )),
  source_id text not null check (length(trim(source_id)) > 0),
  source_hash text not null check (length(trim(source_hash)) > 0),
  source_url text,
  source_excerpt text,
  asserted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (conflict_id, source_type, source_id, source_hash)
);

create table if not exists public.executive_conflict_resolution_history (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.executive_claim_conflicts(id) on delete cascade,
  action text not null check (action in ('created', 'escalated', 'reopened', 'resolved', 'dismissed')),
  actor_kind text not null check (actor_kind in ('human', 'ai', 'system')),
  actor_label text not null check (length(trim(actor_label)) > 0),
  rationale text not null check (length(trim(rationale)) > 0),
  resolution jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (action not in ('resolved', 'dismissed') or actor_kind = 'human')
);

create index if not exists executive_attention_items_open_idx
  on public.executive_attention_items (project_id, lifecycle, priority, due_at)
  where lifecycle not in ('resolved', 'dismissed');
create index if not exists executive_attention_evidence_attention_idx
  on public.executive_attention_evidence (attention_id, source_occurred_at desc);
create index if not exists executive_claim_conflicts_open_idx
  on public.executive_claim_conflicts (project_id, status, priority, resolution_due_at)
  where status not in ('resolved', 'dismissed');
create index if not exists executive_conflict_claims_conflict_idx
  on public.executive_conflict_claims (conflict_id, created_at);
create index if not exists executive_conflict_resolution_history_conflict_idx
  on public.executive_conflict_resolution_history (conflict_id, created_at);

create or replace function public.guard_executive_domain_write()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.executive_domain_write_boundary', true) is distinct from 'true' then
    raise exception using
      errcode = '42501',
      message = 'Executive domain writes must use controlled RPCs',
      hint = 'Use create_executive_attention_item, create_executive_claim_conflict, or resolve_executive_claim_conflict with the required evidence and human resolution actor.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.prevent_executive_conflict_history_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception using
      errcode = '55000',
      message = 'Executive conflict resolution history is append-only',
      hint = 'Record a new history event; do not rewrite or delete a prior human resolution.';
  end if;
  return new;
end;
$$;

drop trigger if exists executive_attention_items_write_guard on public.executive_attention_items;
create trigger executive_attention_items_write_guard
before insert or update or delete on public.executive_attention_items
for each row execute function public.guard_executive_domain_write();
drop trigger if exists executive_attention_evidence_write_guard on public.executive_attention_evidence;
create trigger executive_attention_evidence_write_guard
before insert or update or delete on public.executive_attention_evidence
for each row execute function public.guard_executive_domain_write();
drop trigger if exists executive_claim_conflicts_write_guard on public.executive_claim_conflicts;
create trigger executive_claim_conflicts_write_guard
before insert or update or delete on public.executive_claim_conflicts
for each row execute function public.guard_executive_domain_write();
drop trigger if exists executive_conflict_claims_write_guard on public.executive_conflict_claims;
create trigger executive_conflict_claims_write_guard
before insert or update or delete on public.executive_conflict_claims
for each row execute function public.guard_executive_domain_write();
drop trigger if exists executive_conflict_resolution_history_write_guard on public.executive_conflict_resolution_history;
create trigger executive_conflict_resolution_history_write_guard
before insert on public.executive_conflict_resolution_history
for each row execute function public.guard_executive_domain_write();
drop trigger if exists executive_conflict_resolution_history_append_only on public.executive_conflict_resolution_history;
create trigger executive_conflict_resolution_history_append_only
before update or delete on public.executive_conflict_resolution_history
for each row execute function public.prevent_executive_conflict_history_mutation();

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

  perform set_config('app.executive_domain_write_boundary', 'true', true);
  insert into public.executive_attention_items (
    project_id, category, title, summary, priority, lifecycle,
    accountable_owner_person_id, accountable_owner_label, due_at,
    escalation_level, assigned_at, created_by_actor_kind, metadata
  ) values (
    nullif(p_input->>'project_id', '')::integer,
    p_input->>'category', p_input->>'title', p_input->>'summary', p_input->>'priority', 'open',
    nullif(p_input->>'accountable_owner_person_id', '')::uuid,
    p_input->>'accountable_owner_label', nullif(p_input->>'due_at', '')::timestamptz,
    coalesce((p_input->>'escalation_level')::integer, 0),
    nullif(p_input->>'assigned_at', '')::timestamptz,
    coalesce(p_input->>'actor_kind', 'system'), coalesce(p_input->'metadata', '{}'::jsonb)
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
  return v_id;
end;
$$;

create or replace function public.create_executive_claim_conflict(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_claims jsonb;
  v_claim jsonb;
begin
  if jsonb_typeof(p_input) <> 'object' then
    raise exception 'Executive conflict input must be a JSON object';
  end if;
  v_claims := p_input->'claims';
  if jsonb_typeof(v_claims) <> 'array' or jsonb_array_length(v_claims) < 2 then
    raise exception 'Executive conflict requires at least two competing evidence-backed claims';
  end if;
  if nullif(p_input->>'resolution_due_at', '') is null then
    raise exception 'Executive conflict requires a resolution deadline';
  end if;

  perform set_config('app.executive_domain_write_boundary', 'true', true);
  insert into public.executive_claim_conflicts (
    attention_id, project_id, subject, priority, resolution_due_at,
    accountable_resolver_person_id, accountable_resolver_label, created_by_actor_kind, metadata
  ) values (
    nullif(p_input->>'attention_id', '')::uuid, nullif(p_input->>'project_id', '')::integer,
    p_input->>'subject', p_input->>'priority', (p_input->>'resolution_due_at')::timestamptz,
    nullif(p_input->>'accountable_resolver_person_id', '')::uuid,
    p_input->>'accountable_resolver_label', coalesce(p_input->>'actor_kind', 'system'),
    coalesce(p_input->'metadata', '{}'::jsonb)
  ) returning id into v_id;

  for v_claim in select value from jsonb_array_elements(v_claims)
  loop
    if coalesce(nullif(trim(v_claim->>'claim_label'), ''), '') = ''
      or coalesce(nullif(trim(v_claim->>'source_type'), ''), '') = ''
      or coalesce(nullif(trim(v_claim->>'source_id'), ''), '') = ''
      or coalesce(nullif(trim(v_claim->>'source_hash'), ''), '') = '' then
      raise exception 'Every executive conflict claim requires claim_label, source_type, source_id, and source_hash';
    end if;
    insert into public.executive_conflict_claims (
      conflict_id, claim_label, claim_value, source_type, source_id, source_hash,
      source_url, source_excerpt, asserted_at
    ) values (
      v_id, v_claim->>'claim_label', coalesce(v_claim->'claim_value', '{}'::jsonb),
      v_claim->>'source_type', v_claim->>'source_id', v_claim->>'source_hash',
      nullif(v_claim->>'source_url', ''), nullif(v_claim->>'source_excerpt', ''),
      nullif(v_claim->>'asserted_at', '')::timestamptz
    );
  end loop;
  insert into public.executive_conflict_resolution_history (
    conflict_id, action, actor_kind, actor_label, rationale
  ) values (
    v_id, 'created', coalesce(p_input->>'actor_kind', 'system'),
    coalesce(p_input->>'actor_label', 'Executive operating system'), 'Competing claims recorded for human review.'
  );
  return v_id;
end;
$$;

create or replace function public.resolve_executive_claim_conflict(
  p_conflict_id uuid,
  p_actor_label text,
  p_actor_kind text,
  p_resolution_summary text,
  p_resolution jsonb default '{}'::jsonb,
  p_dismiss boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_kind <> 'human' then
    raise exception using
      errcode = '42501',
      message = 'Only a human may resolve or dismiss an executive conflict',
      hint = 'Record competing claims for review, then call this function with actor_kind=human and an explicit rationale.';
  end if;
  if coalesce(length(trim(p_actor_label)), 0) = 0 or coalesce(length(trim(p_resolution_summary)), 0) = 0 then
    raise exception 'Executive conflict resolution requires a human resolver label and non-empty rationale';
  end if;

  perform set_config('app.executive_domain_write_boundary', 'true', true);
  update public.executive_claim_conflicts
  set status = case when p_dismiss then 'dismissed' else 'resolved' end,
      resolved_at = timezone('utc', now()),
      resolved_by_label = p_actor_label,
      resolution_summary = p_resolution_summary,
      updated_at = timezone('utc', now())
  where id = p_conflict_id and status not in ('resolved', 'dismissed');
  if not found then
    raise exception 'Executive conflict % is missing or already closed', p_conflict_id;
  end if;
  insert into public.executive_conflict_resolution_history (
    conflict_id, action, actor_kind, actor_label, rationale, resolution
  ) values (
    p_conflict_id, case when p_dismiss then 'dismissed' else 'resolved' end,
    p_actor_kind, p_actor_label, p_resolution_summary, coalesce(p_resolution, '{}'::jsonb)
  );
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
set search_path = public
as $$
begin
  if p_actor_kind <> 'human' then
    raise exception using
      errcode = '42501',
      message = 'Only a human may resolve or dismiss executive attention',
      hint = 'Keep the item open/escalated until a named human confirms the outcome.';
  end if;
  if coalesce(length(trim(p_actor_label)), 0) = 0 or coalesce(length(trim(p_resolution_summary)), 0) = 0 then
    raise exception 'Executive attention resolution requires a human resolver label and non-empty rationale';
  end if;
  perform set_config('app.executive_domain_write_boundary', 'true', true);
  update public.executive_attention_items
  set lifecycle = case when p_dismiss then 'dismissed' else 'resolved' end,
      resolved_at = timezone('utc', now()), resolved_by_label = p_actor_label,
      resolution_summary = p_resolution_summary, updated_at = timezone('utc', now())
  where id = p_attention_id and lifecycle not in ('resolved', 'dismissed');
  if not found then
    raise exception 'Executive attention % is missing or already closed', p_attention_id;
  end if;
end;
$$;

alter table public.executive_attention_items enable row level security;
alter table public.executive_attention_evidence enable row level security;
alter table public.executive_claim_conflicts enable row level security;
alter table public.executive_conflict_claims enable row level security;
alter table public.executive_conflict_resolution_history enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'executive_attention_items', 'executive_attention_evidence', 'executive_claim_conflicts',
    'executive_conflict_claims', 'executive_conflict_resolution_history'
  ] loop
    execute format('drop policy if exists %I on public.%I', v_table || '_service_write', v_table);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', v_table || '_service_write', v_table);
  end loop;
end;
$$;

commit;
