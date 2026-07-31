begin;

-- Lifecycle mutations are authorized by the application capability gate. Direct
-- authenticated RPC calls would bypass that decision, so only the server-side
-- service client may invoke these functions. The actor label and user ID are
-- derived from the authenticated user before the server client is created.
drop function if exists public.resolve_executive_attention_item(uuid, text, text, text, boolean);
drop function if exists public.transition_executive_attention_item(uuid, text, text, integer, timestamptz);

create or replace function public.resolve_executive_attention_item(
  p_attention_id uuid,
  p_actor_label text,
  p_actor_user_id uuid,
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
  v_lifecycle text;
begin
  if p_actor_kind <> 'human' then
    raise exception using errcode = '42501',
      message = 'Executive attention outcome cannot be attributed to a non-human actor';
  end if;
  if p_actor_user_id is null or coalesce(length(trim(p_actor_label)), 0) = 0 or coalesce(length(trim(p_resolution_summary)), 0) = 0 then
    raise exception 'Executive attention resolution requires a server-verified human resolver and non-empty rationale';
  end if;
  update public.executive_attention_items
  set lifecycle = case when p_dismiss then 'dismissed' else 'resolved' end,
      resolved_at = timezone('utc', now()), resolved_by_label = p_actor_label,
      resolved_by_user_id = p_actor_user_id, resolution_summary = p_resolution_summary,
      updated_at = timezone('utc', now())
  where id = p_attention_id and lifecycle not in ('resolved', 'dismissed')
  returning lifecycle into v_lifecycle;
  if not found then
    raise exception 'Executive attention % is missing or already closed', p_attention_id;
  end if;
  insert into public.executive_attention_history (
    attention_id, action, actor_kind, actor_label, actor_user_id, rationale, snapshot
  ) values (
    p_attention_id, v_lifecycle, 'human', p_actor_label, p_actor_user_id, p_resolution_summary,
    jsonb_build_object('lifecycle', v_lifecycle, 'authorization_boundary', 'server_capability_gate')
  );
end;
$$;

create or replace function public.transition_executive_attention_item(
  p_attention_id uuid,
  p_actor_label text,
  p_actor_user_id uuid,
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
  v_escalation_level integer;
begin
  if p_lifecycle not in ('acknowledged', 'in_progress', 'escalated') then
    raise exception 'Use the explicit resolution function to close executive attention';
  end if;
  if p_actor_user_id is null or coalesce(length(trim(p_actor_label)), 0) = 0 then
    raise exception 'Executive attention transition requires a server-verified human actor';
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
    p_attention_id, p_lifecycle, 'human', p_actor_label, p_actor_user_id,
    case when p_lifecycle = 'escalated' then 'Executive attention escalated.' else 'Executive attention triaged.' end,
    jsonb_build_object('lifecycle', p_lifecycle, 'escalation_level', v_escalation_level, 'assigned_at', p_assigned_at, 'authorization_boundary', 'server_capability_gate')
  );
end;
$$;

revoke all on function public.resolve_executive_attention_item(uuid, text, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.transition_executive_attention_item(uuid, text, uuid, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_executive_attention_item(uuid, text, uuid, text, text, boolean) to service_role;
grant execute on function public.transition_executive_attention_item(uuid, text, uuid, text, integer, timestamptz) to service_role;

commit;
