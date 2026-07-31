-- AAI-1107 follow-up: month review issuance, approval, and supersession must
-- be atomic and the rendered review must only read its persisted snapshots.

begin;

alter table public.executive_monthly_reviews
  add column if not exists portfolio_snapshot jsonb;

create unique index if not exists executive_monthly_review_events_once_idx
  on public.executive_monthly_review_events(review_id, action);

create or replace function public.issue_executive_monthly_review(
  p_artifact_version_id uuid,
  p_review_period date,
  p_source_coverage jsonb,
  p_financial_readiness jsonb,
  p_delivery_snapshot jsonb,
  p_portfolio_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_previous uuid;
  v_review uuid;
begin
  select id into v_existing
  from public.executive_monthly_reviews
  where artifact_version_id = p_artifact_version_id;
  if v_existing is not null then
    return v_existing;
  end if;

  if not exists (
    select 1 from public.executive_artifact_versions
    where id = p_artifact_version_id and artifact_kind = 'monthly'
  ) then
    raise exception 'Monthly review issuance requires a monthly governed artifact version.';
  end if;

  select id into v_previous
  from public.executive_monthly_reviews
  where review_period = p_review_period
  order by created_at desc
  limit 1
  for update;

  insert into public.executive_monthly_reviews (
    artifact_version_id, review_period, source_coverage, financial_readiness,
    delivery_snapshot, portfolio_snapshot, supersedes_review_id
  ) values (
    p_artifact_version_id, p_review_period, p_source_coverage, p_financial_readiness,
    p_delivery_snapshot, p_portfolio_snapshot, v_previous
  ) returning id into v_review;

  insert into public.executive_monthly_review_events (review_id, action, actor_label)
  values (v_review, 'issued', 'Governed monthly review issuer');

  if v_previous is not null then
    insert into public.executive_monthly_review_events (review_id, action, actor_label, rationale)
    values (v_previous, 'superseded', 'Governed monthly review issuer', format('Superseded by immutable monthly review %s.', v_review));
  end if;

  return v_review;
exception when unique_violation then
  select id into v_existing
  from public.executive_monthly_reviews
  where artifact_version_id = p_artifact_version_id;
  if v_existing is not null then return v_existing; end if;
  raise;
end;
$$;

create or replace function public.record_executive_monthly_review_governance(
  p_review_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_actor_label text,
  p_rationale text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_financial jsonb;
begin
  if p_action not in ('finance_closed', 'executive_approved') then
    raise exception 'Unsupported monthly governance action: %', p_action;
  end if;
  select financial_readiness into v_financial
  from public.executive_monthly_reviews
  where id = p_review_id
  for update;
  if v_financial is null then
    raise exception 'Monthly review % does not exist.', p_review_id;
  end if;
  if p_action = 'finance_closed' and coalesce(v_financial->>'state', 'awaiting_close') <> 'ready' then
    raise exception 'Finance close requires ready financial source coverage.';
  end if;
  if p_action = 'executive_approved' and not exists (
    select 1 from public.executive_monthly_review_events where review_id = p_review_id and action = 'finance_closed'
  ) then
    raise exception 'Executive approval requires recorded finance close.';
  end if;
  if exists (select 1 from public.executive_monthly_review_events where review_id = p_review_id and action = p_action) then
    raise exception 'Monthly governance action % is already recorded for review %.', p_action, p_review_id;
  end if;
  insert into public.executive_monthly_review_events (review_id, action, actor_user_id, actor_label, rationale)
  values (p_review_id, p_action, p_actor_user_id, p_actor_label, nullif(btrim(p_rationale), ''));
end;
$$;

revoke all on function public.issue_executive_monthly_review(uuid, date, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.record_executive_monthly_review_governance(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.issue_executive_monthly_review(uuid, date, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.record_executive_monthly_review_governance(uuid, text, uuid, text, text) to service_role;

comment on function public.issue_executive_monthly_review(uuid, date, jsonb, jsonb, jsonb, jsonb) is
  'Atomically issues an immutable monthly review, its issued audit event, and predecessor supersession audit.';
comment on function public.record_executive_monthly_review_governance(uuid, text, uuid, text, text) is
  'Atomically records a one-time finance-close or executive-approval event for a monthly review.';

commit;
