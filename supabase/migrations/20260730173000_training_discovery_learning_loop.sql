-- Human-gated, auditable learning loop for training-resource discovery.
-- Discovery may improve search and ranking, but only an app admin can publish.

begin;

create table public.training_discovery_policy (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid null references public.user_profiles(id) on delete set null,
  version text not null unique,
  status text not null default 'shadow',
  weights jsonb not null default '{}'::jsonb,
  exploration_rate numeric(5,4) not null default 0.15,
  evaluation jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz null,
  activated_at timestamptz null,
  retired_at timestamptz null,
  supersedes_id uuid null
    references public.training_discovery_policy(id) on delete set null,
  constraint training_discovery_policy_version_check
    check (version ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint training_discovery_policy_status_check
    check (status in ('shadow', 'active', 'retired')),
  constraint training_discovery_policy_weights_check
    check (jsonb_typeof(weights) = 'object'),
  constraint training_discovery_policy_exploration_check
    check (exploration_rate between 0 and 0.5),
  constraint training_discovery_policy_evaluation_check
    check (jsonb_typeof(evaluation) = 'object'),
  constraint training_discovery_policy_active_evidence_check
    check (
      status <> 'active'
      or (
        evaluated_at is not null
        and activated_at is not null
        and evaluation ? 'sampleSize'
      )
    )
);

create unique index training_discovery_policy_one_active_idx
  on public.training_discovery_policy ((status))
  where status = 'active';

insert into public.training_discovery_policy (
  version,
  status,
  weights,
  exploration_rate,
  evaluation,
  evaluated_at,
  activated_at
)
values (
  'feedback-ranking-v2',
  'active',
  '{
    "search": 0.20,
    "topicRelevance": 0.25,
    "approvedSimilarity": 0.20,
    "providerApproval": 0.15,
    "strategyApproval": 0.15,
    "contentDepth": 0.05,
    "archivedSimilarityPenalty": 0.35
  }'::jsonb,
  0.15,
  '{
    "sampleSize": 0,
    "baseline": true,
    "beatsActive": true,
    "note": "Initial measured policy; historical review outcomes provide live priors."
  }'::jsonb,
  now(),
  now()
)
on conflict (version) do nothing;

create table public.training_discovery_run (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  role_id uuid not null references public.training_role(id) on delete restrict,
  topic_id uuid not null references public.training_topic(id) on delete restrict,
  policy_id uuid not null
    references public.training_discovery_policy(id) on delete restrict,
  trigger_source text not null,
  status text not null default 'running',
  query_plan jsonb not null,
  limits jsonb not null,
  counts jsonb not null default '{}'::jsonb,
  error text null,
  constraint training_discovery_run_trigger_check
    check (trigger_source in ('admin', 'weekly', 'manual', 'test')),
  constraint training_discovery_run_status_check
    check (status in ('running', 'completed', 'partial', 'failed')),
  constraint training_discovery_run_query_plan_check
    check (jsonb_typeof(query_plan) = 'array' and jsonb_array_length(query_plan) > 0),
  constraint training_discovery_run_limits_check
    check (jsonb_typeof(limits) = 'object'),
  constraint training_discovery_run_counts_check
    check (jsonb_typeof(counts) = 'object'),
  constraint training_discovery_run_completion_check
    check (
      (status = 'running' and completed_at is null)
      or (status <> 'running' and completed_at is not null)
    ),
  constraint training_discovery_run_error_check
    check (status <> 'failed' or nullif(btrim(error), '') is not null)
);

create table public.training_discovery_candidate (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id uuid not null
    references public.training_discovery_run(id) on delete cascade,
  resource_id uuid null
    references public.training_resource(id) on delete set null,
  title text not null,
  canonical_url text null,
  provider text null,
  external_id text null,
  strategy text not null,
  original_rank integer not null,
  learned_rank integer null,
  score numeric(6,5) null,
  decision text not null,
  reason_code text not null,
  detail text not null,
  features jsonb not null default '{}'::jsonb,
  explanation jsonb not null default '[]'::jsonb,
  content_fingerprint text null,
  fingerprint_source text null,
  duplicate_resource_id uuid null
    references public.training_resource(id) on delete set null,
  constraint training_discovery_candidate_title_check
    check (nullif(btrim(title), '') is not null),
  constraint training_discovery_candidate_url_check
    check (canonical_url is null or canonical_url ~* '^https://'),
  constraint training_discovery_candidate_strategy_check
    check (strategy ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'),
  constraint training_discovery_candidate_rank_check
    check (original_rank > 0 and (learned_rank is null or learned_rank > 0)),
  constraint training_discovery_candidate_score_check
    check (score is null or score between 0 and 1),
  constraint training_discovery_candidate_decision_check
    check (
      decision in (
        'inserted',
        'would_insert',
        'duplicate',
        'rejected',
        'failed'
      )
    ),
  constraint training_discovery_candidate_reason_check
    check (reason_code ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'),
  constraint training_discovery_candidate_features_check
    check (jsonb_typeof(features) = 'object'),
  constraint training_discovery_candidate_explanation_check
    check (jsonb_typeof(explanation) = 'array'),
  constraint training_discovery_candidate_fingerprint_check
    check (
      content_fingerprint is null
      or content_fingerprint ~ '^[0-9a-f]{16}$'
    )
);

create unique index training_discovery_candidate_resource_idx
  on public.training_discovery_candidate (resource_id)
  where resource_id is not null;

create index training_discovery_candidate_run_rank_idx
  on public.training_discovery_candidate (run_id, learned_rank, original_rank);

create index training_discovery_candidate_strategy_idx
  on public.training_discovery_candidate (strategy, created_at desc);

create table public.training_resource_fingerprint (
  resource_id uuid primary key
    references public.training_resource(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canonical_url text not null,
  provider text not null,
  external_id text null,
  content_fingerprint text null,
  fingerprint_source text not null,
  evidence jsonb not null default '{}'::jsonb,
  constraint training_resource_fingerprint_url_check
    check (canonical_url ~* '^https?://'),
  constraint training_resource_fingerprint_provider_check
    check (nullif(btrim(provider), '') is not null),
  constraint training_resource_fingerprint_content_check
    check (
      content_fingerprint is null
      or content_fingerprint ~ '^[0-9a-f]{16}$'
    ),
  constraint training_resource_fingerprint_source_check
    check (fingerprint_source in ('raw_content', 'search_evidence', 'legacy_backfill')),
  constraint training_resource_fingerprint_evidence_check
    check (jsonb_typeof(evidence) = 'object')
);

create index training_resource_fingerprint_external_idx
  on public.training_resource_fingerprint (provider, external_id)
  where external_id is not null;

create index training_resource_fingerprint_content_idx
  on public.training_resource_fingerprint (content_fingerprint)
  where content_fingerprint is not null;

drop trigger if exists update_training_resource_fingerprint_updated_at
  on public.training_resource_fingerprint;
create trigger update_training_resource_fingerprint_updated_at
  before update on public.training_resource_fingerprint
  for each row
  execute function public.update_updated_at_column();

insert into public.training_resource_fingerprint (
  resource_id,
  canonical_url,
  provider,
  external_id,
  fingerprint_source,
  evidence
)
select
  resource.id,
  resource.url,
  lower(
    regexp_replace(
      coalesce(substring(resource.url from '^https?://([^/]+)'), 'unknown'),
      '^www\.',
      ''
    )
  ),
  case
    when resource.url ~* '^https?://(www\.)?(m\.|music\.)?youtube\.com/watch'
      then substring(resource.url from '[?&]v=([^&#]+)')
    when resource.url ~* '^https?://(www\.)?youtu\.be/'
      then substring(resource.url from 'youtu\.be/([^?&#/]+)')
    else null
  end,
  'legacy_backfill',
  jsonb_build_object('backfilledAt', now())
from public.training_resource resource
on conflict (resource_id) do nothing;

create function public.seed_training_resource_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_provider text;
  normalized_external_id text;
begin
  normalized_provider := lower(
    regexp_replace(
      coalesce(substring(new.url from '^https?://([^/]+)'), 'unknown'),
      '^www\.',
      ''
    )
  );
  normalized_external_id :=
    case
      when new.url ~* '^https?://(www\.)?(m\.|music\.)?youtube\.com/watch'
        then substring(new.url from '[?&]v=([^&#]+)')
      when new.url ~* '^https?://(www\.)?youtu\.be/'
        then substring(new.url from 'youtu\.be/([^?&#/]+)')
      else null
    end;

  insert into public.training_resource_fingerprint (
    resource_id,
    canonical_url,
    provider,
    external_id,
    fingerprint_source,
    evidence
  )
  values (
    new.id,
    new.url,
    normalized_provider,
    normalized_external_id,
    'legacy_backfill',
    jsonb_build_object('seededAt', now())
  )
  on conflict (resource_id) do nothing;

  return new;
end;
$$;

drop trigger if exists seed_training_resource_fingerprint
  on public.training_resource;
create trigger seed_training_resource_fingerprint
  after insert on public.training_resource
  for each row
  execute function public.seed_training_resource_fingerprint();

create table public.training_resource_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  resource_id uuid not null
    references public.training_resource(id) on delete cascade,
  reviewer_id uuid not null
    references public.user_profiles(id) on delete restrict,
  discovery_candidate_id uuid null
    references public.training_discovery_candidate(id) on delete set null,
  decision text not null,
  reason_codes text[] not null,
  ratings jsonb not null default '{}'::jsonb,
  notes text null,
  source text not null default 'candidate_review',
  constraint training_resource_feedback_decision_check
    check (decision in ('publish', 'archive', 'keep')),
  constraint training_resource_feedback_reasons_check
    check (
      cardinality(reason_codes) between 1 and 8
      and array_position(reason_codes, null) is null
      and array_to_string(reason_codes, E'\n') ~
        '^[a-z0-9_-]+(\n[a-z0-9_-]+)*$'
    ),
  constraint training_resource_feedback_ratings_check
    check (jsonb_typeof(ratings) = 'object'),
  constraint training_resource_feedback_notes_check
    check (
      notes is null
      or (
        char_length(notes) between 8 and 1000
        and notes = btrim(notes)
      )
    ),
  constraint training_resource_feedback_source_check
    check (source in ('candidate_review', 'freshness_review'))
);

create unique index training_resource_feedback_candidate_once_idx
  on public.training_resource_feedback (resource_id)
  where source = 'candidate_review';

create index training_resource_feedback_decision_idx
  on public.training_resource_feedback (decision, created_at desc);

create function public.capture_training_candidate_review_feedback()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  effective_reviewer_id uuid := coalesce(new.reviewed_by, auth.uid());
  effective_notes text :=
    case
      when char_length(coalesce(btrim(new.reviewer_notes), '')) between 8 and 1000
        then btrim(new.reviewer_notes)
      else null
    end;
begin
  if old.status = 'review'
    and new.status in ('published', 'archived')
  then
    if effective_reviewer_id is null then
      raise exception
        using
          errcode = '23502',
          message = 'Training candidate review requires a reviewer identity.';
    end if;

    insert into public.training_resource_feedback (
      resource_id,
      reviewer_id,
      decision,
      reason_codes,
      ratings,
      notes
    )
    values (
      new.id,
      effective_reviewer_id,
      case when new.status = 'published' then 'publish' else 'archive' end,
      array['legacy_unstructured'],
      '{}'::jsonb,
      effective_notes
    )
    on conflict (resource_id)
      where source = 'candidate_review'
      do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_training_candidate_review_feedback
  on public.training_resource;
create trigger capture_training_candidate_review_feedback
  after update of status on public.training_resource
  for each row
  execute function public.capture_training_candidate_review_feedback();

create function public.review_training_resource_candidate(
  p_resource_id uuid,
  p_decision text,
  p_reason_codes text[],
  p_ratings jsonb default '{}'::jsonb,
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_notes text := nullif(btrim(p_notes), '');
  normalized_reasons text[];
  target_status public.training_resource_status;
  candidate_id uuid;
  rating record;
  allowed_positive constant text[] := array[
    'field_applicable',
    'trusted_provider',
    'right_depth',
    'clear_instruction',
    'current_content'
  ];
  allowed_negative constant text[] := array[
    'wrong_role_topic',
    'too_basic',
    'too_advanced',
    'outdated',
    'poor_quality',
    'promotional',
    'too_short',
    'duplicate_similar',
    'unsafe_inaccurate'
  ];
begin
  if auth.uid() is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Training resource review requires app admin access.';
  end if;

  if p_decision not in ('publish', 'archive') then
    raise exception
      using
        errcode = '22023',
        message = 'Training resource decision must be publish or archive.';
  end if;

  select array_agg(distinct btrim(reason_code) order by btrim(reason_code))
  into normalized_reasons
  from unnest(coalesce(p_reason_codes, '{}'::text[])) reason_code
  where nullif(btrim(reason_code), '') is not null;

  if coalesce(cardinality(normalized_reasons), 0) = 0 then
    raise exception
      using
        errcode = '22023',
        message = 'Select at least one structured review reason.';
  end if;

  if p_decision = 'publish'
    and not (normalized_reasons <@ allowed_positive)
  then
    raise exception
      using
        errcode = '22023',
        message = 'Published resources require approved positive reason codes.';
  end if;

  if p_decision = 'archive'
    and not (normalized_reasons <@ allowed_negative)
  then
    raise exception
      using
        errcode = '22023',
        message = 'Archived resources require approved negative reason codes.';
  end if;

  if p_decision = 'archive'
    and (
      normalized_notes is null
      or char_length(normalized_notes) not between 8 and 1000
    )
  then
    raise exception
      using
        errcode = '22023',
        message = 'Archive feedback must be between 8 and 1000 characters.';
  end if;

  if jsonb_typeof(coalesce(p_ratings, '{}'::jsonb)) <> 'object' then
    raise exception
      using
        errcode = '22023',
        message = 'Training review ratings must be a JSON object.';
  end if;

  for rating in
    select key, value
    from jsonb_each(coalesce(p_ratings, '{}'::jsonb))
  loop
    if rating.key not in ('relevance', 'depth', 'quality')
      or jsonb_typeof(rating.value) <> 'number'
      or (rating.value #>> '{}')::numeric not between 1 and 5
    then
      raise exception
        using
          errcode = '22023',
          message = 'Training review ratings must use relevance, depth, or quality with values from 1 to 5.';
    end if;
  end loop;

  select candidate.id
  into candidate_id
  from public.training_discovery_candidate candidate
  where candidate.resource_id = p_resource_id
  limit 1;

  target_status :=
    case when p_decision = 'publish' then 'published' else 'archived' end;

  perform 1
  from public.training_resource resource
  where resource.id = p_resource_id
    and resource.status = 'review'
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Training resource is no longer pending review.';
  end if;

  insert into public.training_resource_feedback (
    resource_id,
    reviewer_id,
    discovery_candidate_id,
    decision,
    reason_codes,
    ratings,
    notes
  )
  values (
    p_resource_id,
    auth.uid(),
    candidate_id,
    p_decision,
    normalized_reasons,
    coalesce(p_ratings, '{}'::jsonb),
    normalized_notes
  );

  update public.training_resource
  set
    status = target_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewer_notes = normalized_notes,
    updated_by = auth.uid(),
    published_by =
      case when p_decision = 'publish' then auth.uid() else null end,
    published_at =
      case when p_decision = 'publish' then now() else null end
  where id = p_resource_id
    and status = 'review';

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Training resource is no longer pending review.';
  end if;

  return target_status::text;
end;
$$;

create function public.get_training_discovery_context(
  p_role_id uuid,
  p_topic_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  context jsonb;
begin
  if auth.role() <> 'service_role'
    and (auth.uid() is null or not public.current_is_app_admin())
  then
    raise exception
      using
        errcode = '42501',
        message = 'Training discovery context requires service role or app admin access.';
  end if;

  select jsonb_build_object(
    'policy',
    (
      select jsonb_build_object(
        'id', policy.id,
        'version', policy.version,
        'weights', policy.weights,
        'explorationRate', policy.exploration_rate,
        'evaluation', policy.evaluation
      )
      from public.training_discovery_policy policy
      where policy.status = 'active'
      limit 1
    ),
    'strategyStats',
    coalesce(
      (
        select jsonb_agg(to_jsonb(strategy_stat) order by strategy_stat.strategy)
        from (
          select
            candidate.strategy,
            count(feedback.id)::integer as reviewed_count,
            count(feedback.id)
              filter (where feedback.decision = 'publish')::integer
              as published_count
          from public.training_discovery_candidate candidate
          join public.training_discovery_run run on run.id = candidate.run_id
          left join public.training_resource_feedback feedback
            on feedback.discovery_candidate_id = candidate.id
          where run.role_id = p_role_id
            and run.topic_id = p_topic_id
          group by candidate.strategy
        ) strategy_stat
      ),
      '[]'::jsonb
    ),
    'providerStats',
    coalesce(
      (
        select jsonb_agg(to_jsonb(provider_stat) order by provider_stat.provider)
        from (
          select
            candidate.provider,
            count(feedback.id)::integer as reviewed_count,
            count(feedback.id)
              filter (where feedback.decision = 'publish')::integer
              as published_count
          from public.training_discovery_candidate candidate
          join public.training_discovery_run run on run.id = candidate.run_id
          left join public.training_resource_feedback feedback
            on feedback.discovery_candidate_id = candidate.id
          where run.topic_id = p_topic_id
            and candidate.provider is not null
          group by candidate.provider
        ) provider_stat
      ),
      '[]'::jsonb
    ),
    'reasonStats',
    coalesce(
      (
        select jsonb_agg(to_jsonb(reason_stat) order by reason_stat.reason_code)
        from (
          select
            reason_code,
            count(*)::integer as occurrence_count
          from public.training_resource_feedback feedback
          join public.training_discovery_candidate candidate
            on candidate.id = feedback.discovery_candidate_id
          join public.training_discovery_run run on run.id = candidate.run_id
          cross join lateral unnest(feedback.reason_codes) reason_code
          where run.topic_id = p_topic_id
          group by reason_code
        ) reason_stat
      ),
      '[]'::jsonb
    ),
    'fingerprints',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'resource_id', resource.id,
            'title', resource.title,
            'status', resource.status,
            'provider', fingerprint.provider,
            'external_id', fingerprint.external_id,
            'content_fingerprint', fingerprint.content_fingerprint
          )
        )
        from public.training_resource resource
        join public.training_resource_fingerprint fingerprint
          on fingerprint.resource_id = resource.id
        where resource.topic_id = p_topic_id
      ),
      '[]'::jsonb
    ),
    'trustedProviders',
    coalesce(
      (
        select jsonb_agg(provider_stat.provider order by provider_stat.approval_rate desc)
        from (
          select
            candidate.provider,
            count(feedback.id)
              filter (where feedback.decision = 'publish')::numeric
              / nullif(count(feedback.id), 0) as approval_rate
          from public.training_discovery_candidate candidate
          join public.training_discovery_run run on run.id = candidate.run_id
          join public.training_resource_feedback feedback
            on feedback.discovery_candidate_id = candidate.id
          where run.topic_id = p_topic_id
            and candidate.provider is not null
          group by candidate.provider
          having count(feedback.id) >= 2
            and count(feedback.id)
              filter (where feedback.decision = 'publish')::numeric
              / count(feedback.id) >= 0.6
          order by approval_rate desc
          limit 5
        ) provider_stat
      ),
      '[]'::jsonb
    )
  )
  into context;

  if context -> 'policy' = 'null'::jsonb then
    raise exception
      using
        errcode = 'P0002',
        message = 'No active training discovery policy is configured.';
  end if;

  return context;
end;
$$;

create function public.get_training_discovery_admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  metrics jsonb;
begin
  if auth.uid() is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Training discovery metrics require app admin access.';
  end if;

  select jsonb_build_object(
    'activePolicy',
    (
      select jsonb_build_object(
        'version', version,
        'explorationRate', exploration_rate,
        'evaluation', evaluation,
        'activatedAt', activated_at
      )
      from public.training_discovery_policy
      where status = 'active'
      limit 1
    ),
    'runs', count(distinct run.id),
    'candidates', count(distinct candidate.id),
    'reviewed', count(distinct feedback.id),
    'published',
      count(distinct feedback.id) filter (where feedback.decision = 'publish'),
    'archived',
      count(distinct feedback.id) filter (where feedback.decision = 'archive'),
    'duplicates',
      count(distinct candidate.id) filter (where candidate.decision = 'duplicate'),
    'approvalRate',
      coalesce(
        round(
          count(distinct feedback.id)
            filter (where feedback.decision = 'publish')::numeric
          / nullif(count(distinct feedback.id), 0),
          4
        ),
        0
      ),
    'strategyPerformance',
    coalesce(
      (
        select jsonb_agg(to_jsonb(strategy_metric) order by strategy_metric.approval_rate desc)
        from (
          select
            candidate_inner.strategy,
            count(feedback_inner.id)::integer as reviewed,
            count(feedback_inner.id)
              filter (where feedback_inner.decision = 'publish')::integer
              as published,
            coalesce(
              round(
                count(feedback_inner.id)
                  filter (where feedback_inner.decision = 'publish')::numeric
                / nullif(count(feedback_inner.id), 0),
                4
              ),
              0
            ) as approval_rate
          from public.training_discovery_candidate candidate_inner
          left join public.training_resource_feedback feedback_inner
            on feedback_inner.discovery_candidate_id = candidate_inner.id
          group by candidate_inner.strategy
        ) strategy_metric
      ),
      '[]'::jsonb
    )
  )
  into metrics
  from public.training_discovery_run run
  left join public.training_discovery_candidate candidate
    on candidate.run_id = run.id
  left join public.training_resource_feedback feedback
    on feedback.discovery_candidate_id = candidate.id;

  return metrics;
end;
$$;

create function public.activate_training_discovery_policy(p_policy_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.training_discovery_policy%rowtype;
begin
  if auth.uid() is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Training discovery policy activation requires app admin access.';
  end if;

  select *
  into target
  from public.training_discovery_policy
  where id = p_policy_id
    and status in ('shadow', 'retired')
  for update;

  if target.id is null then
    raise exception
      using
        errcode = 'P0002',
        message = 'Shadow or retired training discovery policy was not found.';
  end if;

  if target.status = 'shadow'
    and (
      target.evaluated_at is null
      or coalesce((target.evaluation ->> 'sampleSize')::integer, 0) < 20
      or coalesce((target.evaluation ->> 'beatsActive')::boolean, false) is not true
    )
  then
    raise exception
      using
        errcode = '22023',
        message = 'A training discovery policy needs at least 20 evaluated decisions and must beat the active policy before activation.';
  end if;

  update public.training_discovery_policy
  set status = 'retired', retired_at = now()
  where status = 'active';

  update public.training_discovery_policy
  set status = 'active', activated_at = now(), retired_at = null
  where id = target.id;

  return target.version;
end;
$$;

alter table public.training_discovery_policy enable row level security;
alter table public.training_discovery_run enable row level security;
alter table public.training_discovery_candidate enable row level security;
alter table public.training_resource_fingerprint enable row level security;
alter table public.training_resource_feedback enable row level security;

revoke all on table
  public.training_discovery_policy,
  public.training_discovery_run,
  public.training_discovery_candidate,
  public.training_resource_fingerprint,
  public.training_resource_feedback
from anon, authenticated, service_role;

grant select on table
  public.training_discovery_policy,
  public.training_discovery_run,
  public.training_discovery_candidate,
  public.training_resource_fingerprint,
  public.training_resource_feedback
to authenticated;

grant select on table
  public.training_discovery_policy,
  public.training_discovery_run,
  public.training_discovery_candidate,
  public.training_resource_fingerprint,
  public.training_resource_feedback
to service_role;

grant insert, update on table
  public.training_discovery_run,
  public.training_discovery_candidate,
  public.training_resource_fingerprint
to service_role;

create policy training_discovery_policy_admin_select
  on public.training_discovery_policy
  for select
  to authenticated
  using (public.current_is_app_admin());

create policy training_discovery_run_admin_select
  on public.training_discovery_run
  for select
  to authenticated
  using (public.current_is_app_admin());

create policy training_discovery_candidate_admin_select
  on public.training_discovery_candidate
  for select
  to authenticated
  using (public.current_is_app_admin());

create policy training_resource_fingerprint_admin_select
  on public.training_resource_fingerprint
  for select
  to authenticated
  using (public.current_is_app_admin());

create policy training_resource_feedback_admin_select
  on public.training_resource_feedback
  for select
  to authenticated
  using (public.current_is_app_admin());

revoke all on function public.review_training_resource_candidate(
  uuid,
  text,
  text[],
  jsonb,
  text
) from public, anon, service_role;
grant execute on function public.review_training_resource_candidate(
  uuid,
  text,
  text[],
  jsonb,
  text
) to authenticated;

revoke all on function public.get_training_discovery_context(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_training_discovery_context(uuid, uuid)
  to service_role;

revoke all on function public.get_training_discovery_admin_metrics()
  from public, anon, service_role;
grant execute on function public.get_training_discovery_admin_metrics()
  to authenticated;

revoke all on function public.activate_training_discovery_policy(uuid)
  from public, anon, service_role;
grant execute on function public.activate_training_discovery_policy(uuid)
  to authenticated;

revoke all on function public.seed_training_resource_fingerprint()
  from public, anon, authenticated, service_role;
revoke all on function public.capture_training_candidate_review_feedback()
  from public, anon, authenticated, service_role;

comment on table public.training_discovery_policy is
  'Versioned and reversible discovery ranking policy. New activation requires evaluation evidence; a retired policy can be restored.';
comment on table public.training_discovery_run is
  'Auditable finder execution with the exact policy, query plan, limits, and outcome counts.';
comment on table public.training_discovery_candidate is
  'Per-result evidence, learned score, explanation, decision, and optional review resource link.';
comment on table public.training_resource_fingerprint is
  'Stable external identity and content fingerprint used for exact and near-duplicate detection.';
comment on table public.training_resource_feedback is
  'Structured administrator decisions that improve later discovery and ranking.';
comment on function public.review_training_resource_candidate(
  uuid,
  text,
  text[],
  jsonb,
  text
) is
  'Atomic app-admin review decision that updates lifecycle state and records structured learning feedback.';

notify pgrst, 'reload schema';

commit;
