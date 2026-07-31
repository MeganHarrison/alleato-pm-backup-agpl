-- Harden AAI-1097 after independent authorization review.
-- A client-settable GUC cannot prove a controlled write boundary, and a caller
-- supplied actor_kind cannot prove a human resolution. Table privileges and
-- Supabase JWT identity are the authoritative boundary instead.

begin;

alter table public.executive_attention_items
  add column if not exists resolved_by_user_id uuid;
alter table public.executive_claim_conflicts
  add column if not exists resolved_by_user_id uuid;
alter table public.executive_conflict_resolution_history
  add column if not exists actor_user_id uuid;

drop trigger if exists executive_attention_items_write_guard on public.executive_attention_items;
drop trigger if exists executive_attention_evidence_write_guard on public.executive_attention_evidence;
drop trigger if exists executive_claim_conflicts_write_guard on public.executive_claim_conflicts;
drop trigger if exists executive_conflict_claims_write_guard on public.executive_conflict_claims;
drop trigger if exists executive_conflict_resolution_history_write_guard on public.executive_conflict_resolution_history;

-- No API role has direct mutation rights. SECURITY DEFINER functions below are
-- the only writer surface; service_role receives creation-only functions and
-- cannot execute outcome functions.
revoke all on public.executive_attention_items from anon, authenticated, service_role;
revoke all on public.executive_attention_evidence from anon, authenticated, service_role;
revoke all on public.executive_claim_conflicts from anon, authenticated, service_role;
revoke all on public.executive_conflict_claims from anon, authenticated, service_role;
revoke all on public.executive_conflict_resolution_history from anon, authenticated, service_role;

drop policy if exists executive_attention_items_service_write on public.executive_attention_items;
drop policy if exists executive_attention_evidence_service_write on public.executive_attention_evidence;
drop policy if exists executive_claim_conflicts_service_write on public.executive_claim_conflicts;
drop policy if exists executive_conflict_claims_service_write on public.executive_conflict_claims;
drop policy if exists executive_conflict_resolution_history_service_write on public.executive_conflict_resolution_history;

create or replace function public.assert_executive_human_resolver()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null or auth.role() <> 'authenticated' then
    raise exception using
      errcode = '42501',
      message = 'Executive resolution requires an authenticated human identity',
      hint = 'Automated services may create open evidence-backed records but cannot resolve, dismiss, or choose an executive outcome.';
  end if;
  return v_user_id;
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
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.assert_executive_human_resolver();
  if p_actor_kind <> 'human' then
    raise exception using errcode = '42501',
      message = 'Executive conflict outcome cannot be attributed to a non-human actor';
  end if;
  if coalesce(length(trim(p_actor_label)), 0) = 0 or coalesce(length(trim(p_resolution_summary)), 0) = 0 then
    raise exception 'Executive conflict resolution requires a human resolver label and non-empty rationale';
  end if;

  update public.executive_claim_conflicts
  set status = case when p_dismiss then 'dismissed' else 'resolved' end,
      resolved_at = timezone('utc', now()), resolved_by_label = p_actor_label,
      resolved_by_user_id = v_user_id, resolution_summary = p_resolution_summary,
      updated_at = timezone('utc', now())
  where id = p_conflict_id and status not in ('resolved', 'dismissed');
  if not found then
    raise exception 'Executive conflict % is missing or already closed', p_conflict_id;
  end if;
  insert into public.executive_conflict_resolution_history (
    conflict_id, action, actor_kind, actor_label, actor_user_id, rationale, resolution
  ) values (
    p_conflict_id, case when p_dismiss then 'dismissed' else 'resolved' end,
    'human', p_actor_label, v_user_id, p_resolution_summary, coalesce(p_resolution, '{}'::jsonb)
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
set search_path = public, auth
as $$
declare
  v_user_id uuid;
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
  where id = p_attention_id and lifecycle not in ('resolved', 'dismissed');
  if not found then
    raise exception 'Executive attention % is missing or already closed', p_attention_id;
  end if;
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
begin
  perform public.assert_executive_human_resolver();
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
  where id = p_attention_id and lifecycle not in ('resolved', 'dismissed');
  if not found then
    raise exception 'Executive attention % is missing or already closed', p_attention_id;
  end if;
end;
$$;

revoke all on function public.assert_executive_human_resolver() from public, anon, authenticated, service_role;
revoke all on function public.create_executive_attention_item(jsonb) from public;
revoke all on function public.create_executive_claim_conflict(jsonb) from public;
revoke all on function public.resolve_executive_attention_item(uuid, text, text, text, boolean) from public, anon, service_role;
revoke all on function public.resolve_executive_claim_conflict(uuid, text, text, text, jsonb, boolean) from public, anon, service_role;
revoke all on function public.transition_executive_attention_item(uuid, text, text, integer, timestamptz) from public, anon, service_role;
grant execute on function public.create_executive_attention_item(jsonb) to authenticated, service_role;
grant execute on function public.create_executive_claim_conflict(jsonb) to authenticated, service_role;
grant execute on function public.resolve_executive_attention_item(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.resolve_executive_claim_conflict(uuid, text, text, text, jsonb, boolean) to authenticated;
grant execute on function public.transition_executive_attention_item(uuid, text, text, integer, timestamptz) to authenticated;

commit;
