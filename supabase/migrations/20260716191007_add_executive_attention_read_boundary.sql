-- AAI-1102: the AAI-1097 tables intentionally have no direct API privileges.
-- Expose one service-only, security-definer read boundary for the capability-
-- gated executive route instead of weakening table permissions.

begin;

create or replace function public.read_executive_attention_feed()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(item.payload order by item.created_at desc), '[]'::jsonb)
  from (
    select attention.created_at,
      jsonb_build_object(
        'id', attention.id,
        'category', attention.category,
        'title', attention.title,
        'summary', attention.summary,
        'priority', attention.priority,
        'lifecycle', attention.lifecycle,
        'accountable_owner_label', attention.accountable_owner_label,
        'due_at', attention.due_at,
        'escalation_level', attention.escalation_level,
        'assigned_at', attention.assigned_at,
        'resolved_at', attention.resolved_at,
        'resolution_summary', attention.resolution_summary,
        'created_at', attention.created_at,
        'metadata', attention.metadata,
        'evidence', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', evidence.id,
            'source_type', evidence.source_type,
            'source_id', evidence.source_id,
            'source_hash', evidence.source_hash,
            'source_excerpt', evidence.source_excerpt,
            'source_occurred_at', evidence.source_occurred_at
          ) order by evidence.captured_at asc)
          from public.executive_attention_evidence evidence
          where evidence.attention_id = attention.id
        ), '[]'::jsonb),
        'history', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', history.id,
            'action', history.action,
            'actor_kind', history.actor_kind,
            'actor_label', history.actor_label,
            'rationale', history.rationale,
            'created_at', history.created_at
          ) order by history.created_at asc)
          from public.executive_attention_history history
          where history.attention_id = attention.id
        ), '[]'::jsonb)
      ) as payload
    from public.executive_attention_items attention
  ) item;
$$;

revoke all on function public.read_executive_attention_feed() from public, anon, authenticated;
grant execute on function public.read_executive_attention_feed() to service_role;

commit;
