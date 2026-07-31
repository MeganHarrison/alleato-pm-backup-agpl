-- AAI-1103: expose an explicit service-only conflict read boundary and align
-- conflict resolution with the published AAI-1102 server-capability pattern.
-- Browser clients never receive table access or choose the resolving actor.

begin;

create or replace function public.read_executive_conflict_feed()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(conflict.payload order by conflict.resolution_due_at asc, conflict.created_at asc), '[]'::jsonb)
  from (
    select item.resolution_due_at, item.created_at,
      jsonb_build_object(
        'id', item.id,
        'attention_id', item.attention_id,
        'project_id', item.project_id,
        'subject', item.subject,
        'status', item.status,
        'priority', item.priority,
        'resolution_due_at', item.resolution_due_at,
        'accountable_resolver_label', item.accountable_resolver_label,
        'resolved_at', item.resolved_at,
        'resolved_by_label', item.resolved_by_label,
        'resolution_summary', item.resolution_summary,
        'metadata', item.metadata,
        'created_at', item.created_at,
        'claims', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', claim.id,
            'claim_label', claim.claim_label,
            'claim_value', claim.claim_value,
            'source_type', claim.source_type,
            'source_id', claim.source_id,
            'source_hash', claim.source_hash,
            'source_url', claim.source_url,
            'source_excerpt', claim.source_excerpt,
            'asserted_at', claim.asserted_at,
            'created_at', claim.created_at
          ) order by claim.created_at asc)
          from public.executive_conflict_claims claim
          where claim.conflict_id = item.id
        ), '[]'::jsonb),
        'history', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', history.id,
            'action', history.action,
            'actor_kind', history.actor_kind,
            'actor_label', history.actor_label,
            'actor_user_id', history.actor_user_id,
            'rationale', history.rationale,
            'resolution', history.resolution,
            'created_at', history.created_at
          ) order by history.created_at asc)
          from public.executive_conflict_resolution_history history
          where history.conflict_id = item.id
        ), '[]'::jsonb)
      ) as payload
    from public.executive_claim_conflicts item
  ) conflict;
$$;

-- The original resolver relied on auth.uid(), which is absent for a
-- service-role server call. The route capability gate supplies a verified user
-- id, and this function records that id immutably with the human outcome.
drop function if exists public.resolve_executive_claim_conflict(uuid, text, text, text, jsonb, boolean);

create function public.resolve_executive_claim_conflict(
  p_conflict_id uuid,
  p_actor_label text,
  p_actor_user_id uuid,
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
declare
  v_status text;
begin
  if p_actor_kind <> 'human' then
    raise exception using
      errcode = '42501',
      message = 'Executive conflict outcome cannot be attributed to a non-human actor';
  end if;
  if p_actor_user_id is null
    or coalesce(length(trim(p_actor_label)), 0) = 0
    or coalesce(length(trim(p_resolution_summary)), 0) = 0 then
    raise exception 'Executive conflict resolution requires a server-verified human resolver and non-empty rationale';
  end if;

  update public.executive_claim_conflicts
  set status = case when p_dismiss then 'dismissed' else 'resolved' end,
      resolved_at = timezone('utc', now()),
      resolved_by_label = p_actor_label,
      resolved_by_user_id = p_actor_user_id,
      resolution_summary = p_resolution_summary,
      updated_at = timezone('utc', now())
  where id = p_conflict_id
    and status not in ('resolved', 'dismissed')
  returning status into v_status;

  if not found then
    raise exception 'Executive conflict % is missing or already closed', p_conflict_id;
  end if;

  insert into public.executive_conflict_resolution_history (
    conflict_id, action, actor_kind, actor_label, actor_user_id, rationale, resolution
  ) values (
    p_conflict_id, v_status, 'human', p_actor_label, p_actor_user_id,
    p_resolution_summary,
    coalesce(p_resolution, '{}'::jsonb) || jsonb_build_object('authorization_boundary', 'server_capability_gate')
  );
end;
$$;

revoke all on function public.read_executive_conflict_feed() from public, anon, authenticated;
grant execute on function public.read_executive_conflict_feed() to service_role;

revoke all on function public.resolve_executive_claim_conflict(uuid, text, uuid, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.resolve_executive_claim_conflict(uuid, text, uuid, text, text, jsonb, boolean)
  to service_role;

commit;
