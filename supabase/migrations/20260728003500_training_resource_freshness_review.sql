-- Human-gated freshness review for already-published training resources.
--
-- Discovery candidates keep using training_resource.status='review'. Existing
-- published resources stay visible and searchable while automation records
-- freshness evidence in this sidecar ledger. Only an authenticated app admin
-- can accept an archive recommendation.

begin;

create table public.training_resource_freshness_checks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null
    references public.training_resource(id) on delete cascade,
  checked_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  outcome text not null,
  evidence_fingerprint text not null,
  occurrence_count integer not null default 1,
  review_status text not null default 'observing',
  recommended_action text not null default 'keep',
  http_status integer null,
  final_url text null,
  observed_title text null,
  evidence jsonb not null default '{}'::jsonb,
  reviewed_by uuid null references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz null,
  reviewer_notes text null,
  constraint training_resource_freshness_outcome_check
    check (
      outcome in (
        'healthy',
        'unavailable',
        'redirected',
        'title_changed',
        'free_unproven',
        'paid',
        'blocked'
      )
    ),
  constraint training_resource_freshness_fingerprint_check
    check (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint training_resource_freshness_occurrence_check
    check (occurrence_count > 0),
  constraint training_resource_freshness_review_status_check
    check (
      review_status in (
        'not_required',
        'observing',
        'pending',
        'accepted',
        'rejected'
      )
    ),
  constraint training_resource_freshness_action_check
    check (recommended_action in ('keep', 'archive')),
  constraint training_resource_freshness_http_status_check
    check (http_status is null or http_status between 100 and 599),
  constraint training_resource_freshness_final_url_check
    check (final_url is null or final_url ~* '^https?://'),
  constraint training_resource_freshness_evidence_object_check
    check (jsonb_typeof(evidence) = 'object'),
  constraint training_resource_freshness_review_audit_check
    check (
      (review_status in ('accepted', 'rejected')
        and reviewed_by is not null
        and reviewed_at is not null
        and nullif(btrim(reviewer_notes), '') is not null)
      or
      (review_status not in ('accepted', 'rejected')
        and reviewed_by is null
        and reviewed_at is null
        and reviewer_notes is null)
    ),
  constraint training_resource_freshness_resource_fingerprint_unique
    unique (resource_id, evidence_fingerprint)
);

create index idx_training_resource_freshness_rotation
  on public.training_resource_freshness_checks (resource_id, last_seen_at desc);

create index idx_training_resource_freshness_review
  on public.training_resource_freshness_checks (
    review_status,
    last_seen_at desc
  );

create unique index idx_training_resource_one_pending_freshness_review
  on public.training_resource_freshness_checks (resource_id)
  where review_status = 'pending';

-- Automation can only record evidence for a published resource. Repeated
-- identical evidence increments one ledger row. Two matching observations
-- promote a non-healthy finding to the admin queue unless another finding for
-- that resource is already pending. Final human decisions are never reopened
-- by automation.
create function public.record_training_resource_freshness_check(
  p_resource_id uuid,
  p_outcome text,
  p_evidence_fingerprint text,
  p_recommended_action text default 'keep',
  p_http_status integer default null,
  p_final_url text default null,
  p_observed_title text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  freshness_check public.training_resource_freshness_checks%rowtype;
begin
  if not exists (
    select 1
    from public.training_resource resource
    where resource.id = p_resource_id
      and resource.status = 'published'
  ) then
    raise exception
      using
        errcode = '23503',
        message = 'Training freshness checks require a published resource.';
  end if;

  insert into public.training_resource_freshness_checks (
    resource_id,
    outcome,
    evidence_fingerprint,
    review_status,
    recommended_action,
    http_status,
    final_url,
    observed_title,
    evidence
  )
  values (
    p_resource_id,
    p_outcome,
    p_evidence_fingerprint,
    case when p_outcome = 'healthy' then 'not_required' else 'observing' end,
    p_recommended_action,
    p_http_status,
    p_final_url,
    p_observed_title,
    coalesce(p_evidence, '{}'::jsonb)
  )
  on conflict (resource_id, evidence_fingerprint)
  do update set
    checked_at = now(),
    last_seen_at = now(),
    occurrence_count =
      public.training_resource_freshness_checks.occurrence_count + 1,
    http_status = excluded.http_status,
    final_url = excluded.final_url,
    observed_title = excluded.observed_title,
    evidence = excluded.evidence
  returning * into freshness_check;

  if freshness_check.outcome <> 'healthy'
    and freshness_check.review_status = 'observing'
    and freshness_check.occurrence_count >= 2
    and not exists (
      select 1
      from public.training_resource_freshness_checks pending
      where pending.resource_id = freshness_check.resource_id
        and pending.review_status = 'pending'
        and pending.id <> freshness_check.id
    )
  then
    update public.training_resource_freshness_checks
    set review_status = 'pending'
    where id = freshness_check.id
    returning * into freshness_check;
  end if;

  return freshness_check.id;
end;
$$;

-- The decision is atomic and admin-only. "keep" records explicit corrective
-- feedback without changing the approved resource. "archive" is the only
-- freshness path that can remove a published resource from the library/RAG
-- corpus.
create function public.review_training_resource_freshness_check(
  p_check_id uuid,
  p_decision text,
  p_notes text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  freshness_check public.training_resource_freshness_checks%rowtype;
begin
  if auth.uid() is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Training freshness review requires app admin access.';
  end if;

  if p_decision not in ('keep', 'archive') then
    raise exception
      using
        errcode = '22023',
        message = 'Training freshness decision must be keep or archive.';
  end if;

  if nullif(btrim(p_notes), '') is null then
    raise exception
      using
        errcode = '22023',
        message = 'Training freshness review notes are required.';
  end if;

  select *
  into freshness_check
  from public.training_resource_freshness_checks
  where id = p_check_id
    and review_status = 'pending'
  for update;

  if freshness_check.id is null then
    raise exception
      using
        errcode = 'P0002',
        message = 'Training freshness finding is no longer pending review.';
  end if;

  if p_decision = 'archive' then
    update public.training_resource
    set
      status = 'archived',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_by = auth.uid()
    where id = freshness_check.resource_id
      and status = 'published';

    if not found then
      raise exception
        using
          errcode = 'P0002',
          message = 'Published training resource is no longer available to archive.';
    end if;
  end if;

  update public.training_resource_freshness_checks
  set
    review_status =
      case when p_decision = 'archive' then 'accepted' else 'rejected' end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewer_notes = btrim(p_notes)
  where id = freshness_check.id;

  return p_decision;
end;
$$;

alter table public.training_resource_freshness_checks enable row level security;

revoke all
  on table public.training_resource_freshness_checks
  from public, anon, authenticated, service_role;

grant select
  on table public.training_resource_freshness_checks
  to authenticated, service_role;

drop policy if exists training_resource_freshness_admin_select
  on public.training_resource_freshness_checks;
create policy training_resource_freshness_admin_select
  on public.training_resource_freshness_checks
  for select
  to authenticated
  using (public.current_is_app_admin());

revoke all
  on function public.record_training_resource_freshness_check(
    uuid,
    text,
    text,
    text,
    integer,
    text,
    text,
    jsonb
  )
  from public, anon, authenticated;

grant execute
  on function public.record_training_resource_freshness_check(
    uuid,
    text,
    text,
    text,
    integer,
    text,
    text,
    jsonb
  )
  to service_role;

revoke all
  on function public.review_training_resource_freshness_check(
    uuid,
    text,
    text
  )
  from public, anon, service_role;

grant execute
  on function public.review_training_resource_freshness_check(
    uuid,
    text,
    text
  )
  to authenticated;

comment on table public.training_resource_freshness_checks is
  'Sidecar evidence and human-review ledger for already-published training resources.';
comment on function public.record_training_resource_freshness_check(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text,
  jsonb
) is
  'Service-only idempotent freshness evidence writer. Never changes training_resource lifecycle state.';
comment on function public.review_training_resource_freshness_check(
  uuid,
  text,
  text
) is
  'App-admin-only atomic keep/archive decision for a pending freshness finding.';

commit;
