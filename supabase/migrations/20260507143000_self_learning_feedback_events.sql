-- Self-learning feedback event ledger.
--
-- Adds the normalized feedback, promotion, and retrieval-scoring tables for
-- Slice 1 of the Self-Learning Intelligence Architecture.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.ai_feedback_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  project_id integer null references public.projects(id) on delete set null,
  target_id uuid null references public.intelligence_targets(id) on delete set null,
  session_id uuid null,
  source_table text null,
  source_record_id text null,
  event_type text not null,
  event_family text not null check (
    event_family in (
      'retrieval',
      'attribution',
      'assistant_response',
      'tool_action',
      'task_generation',
      'packet_quality',
      'document_review',
      'user_preference',
      'workflow_outcome',
      'eval_failure'
    )
  ),
  surface text not null,
  subject_type text not null,
  subject_id text null,
  signal text not null check (
    signal in (
      'positive',
      'negative',
      'corrected',
      'accepted',
      'ignored',
      'completed',
      'failed',
      'needs_review',
      'stale',
      'conflicting'
    )
  ),
  reason_category text null,
  free_text text null,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  source_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ai_learning_promotions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  status text not null default 'candidate' check (
    status in ('candidate','approved','rejected','applied','expired','superseded')
  ),
  promotion_type text not null check (
    promotion_type in (
      'agent_prevention_prompt',
      'positive_task_example',
      'user_preference',
      'project_lesson',
      'retrieval_weight',
      'attribution_rule',
      'packet_rule',
      'workflow_rule'
    )
  ),
  project_id integer null references public.projects(id) on delete set null,
  target_id uuid null references public.intelligence_targets(id) on delete set null,
  source_event_ids uuid[] not null default '{}'::uuid[],
  destination_table text null,
  destination_record_id text null,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  proposed_learning jsonb not null,
  review_notes text null,
  expires_at timestamptz null,
  superseded_by uuid null references public.ai_learning_promotions(id) on delete set null
);

create table if not exists public.ai_retrieval_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  project_id integer null references public.projects(id) on delete set null,
  target_id uuid null references public.intelligence_targets(id) on delete set null,
  session_id uuid null,
  tool_name text not null,
  query_text text not null,
  source_document_id text null references public.document_metadata(id) on delete set null,
  source_chunk_id text null,
  rank integer null check (rank is null or rank >= 0),
  score numeric null,
  cited boolean not null default false,
  user_referenced boolean not null default false,
  used_in_answer boolean not null default false,
  outcome text not null default 'unknown' check (
    outcome in ('helpful','unhelpful','wrong_project','stale','unsupported','unknown')
  ),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_feedback_events_project_family_created_idx
  on public.ai_feedback_events(project_id, event_family, created_at desc);
create index if not exists ai_feedback_events_target_family_created_idx
  on public.ai_feedback_events(target_id, event_family, created_at desc);
create index if not exists ai_feedback_events_subject_created_idx
  on public.ai_feedback_events(subject_type, subject_id, created_at desc);
create index if not exists ai_feedback_events_source_record_idx
  on public.ai_feedback_events(source_table, source_record_id);
create index if not exists ai_feedback_events_type_signal_created_idx
  on public.ai_feedback_events(event_type, signal, created_at desc);
create index if not exists ai_feedback_events_user_created_idx
  on public.ai_feedback_events(user_id, created_at desc)
  where user_id is not null;

create index if not exists ai_learning_promotions_status_created_idx
  on public.ai_learning_promotions(status, created_at desc);
create index if not exists ai_learning_promotions_project_type_idx
  on public.ai_learning_promotions(project_id, promotion_type, status);
create index if not exists ai_learning_promotions_target_type_idx
  on public.ai_learning_promotions(target_id, promotion_type, status);
create index if not exists ai_learning_promotions_source_events_idx
  on public.ai_learning_promotions using gin(source_event_ids);

create index if not exists ai_retrieval_feedback_project_created_idx
  on public.ai_retrieval_feedback(project_id, created_at desc);
create index if not exists ai_retrieval_feedback_target_created_idx
  on public.ai_retrieval_feedback(target_id, created_at desc);
create index if not exists ai_retrieval_feedback_source_document_idx
  on public.ai_retrieval_feedback(source_document_id, outcome, created_at desc)
  where source_document_id is not null;
create index if not exists ai_retrieval_feedback_source_chunk_idx
  on public.ai_retrieval_feedback(source_chunk_id, outcome, created_at desc)
  where source_chunk_id is not null;
create index if not exists ai_retrieval_feedback_tool_outcome_idx
  on public.ai_retrieval_feedback(tool_name, outcome, created_at desc);

drop trigger if exists ai_learning_promotions_set_updated_at
  on public.ai_learning_promotions;
create trigger ai_learning_promotions_set_updated_at
  before update on public.ai_learning_promotions
  for each row execute function public.set_updated_at();

alter table public.ai_feedback_events enable row level security;
alter table public.ai_learning_promotions enable row level security;
alter table public.ai_retrieval_feedback enable row level security;

drop policy if exists ai_feedback_events_insert_own on public.ai_feedback_events;
create policy ai_feedback_events_insert_own
  on public.ai_feedback_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists ai_feedback_events_select on public.ai_feedback_events;
create policy ai_feedback_events_select
  on public.ai_feedback_events
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or user_id = auth.uid()
    or (
      project_id is not null
      and event_family <> 'user_preference'
      and coalesce(metadata->>'visibility', 'team') <> 'private'
      and public.current_is_project_member(project_id)
    )
    or exists (
      select 1
      from public.intelligence_targets t
      where t.id = ai_feedback_events.target_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and event_family <> 'user_preference'
        and coalesce(metadata->>'visibility', 'team') <> 'private'
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists ai_feedback_events_service_write on public.ai_feedback_events;
create policy ai_feedback_events_service_write
  on public.ai_feedback_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists ai_learning_promotions_select on public.ai_learning_promotions;
create policy ai_learning_promotions_select
  on public.ai_learning_promotions
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or (
      project_id is not null
      and public.current_is_project_member(project_id)
    )
    or exists (
      select 1
      from public.intelligence_targets t
      where t.id = ai_learning_promotions.target_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists ai_learning_promotions_service_write on public.ai_learning_promotions;
create policy ai_learning_promotions_service_write
  on public.ai_learning_promotions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists ai_retrieval_feedback_select on public.ai_retrieval_feedback;
create policy ai_retrieval_feedback_select
  on public.ai_retrieval_feedback
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or user_id = auth.uid()
    or (
      project_id is not null
      and coalesce(metadata->>'visibility', 'team') <> 'private'
      and public.current_is_project_member(project_id)
    )
    or exists (
      select 1
      from public.intelligence_targets t
      where t.id = ai_retrieval_feedback.target_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and coalesce(metadata->>'visibility', 'team') <> 'private'
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists ai_retrieval_feedback_insert_own on public.ai_retrieval_feedback;
create policy ai_retrieval_feedback_insert_own
  on public.ai_retrieval_feedback
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists ai_retrieval_feedback_service_write on public.ai_retrieval_feedback;
create policy ai_retrieval_feedback_service_write
  on public.ai_retrieval_feedback
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert on public.ai_feedback_events to authenticated;
grant select, insert on public.ai_retrieval_feedback to authenticated;
grant select on public.ai_learning_promotions to authenticated;

grant all on
  public.ai_feedback_events,
  public.ai_learning_promotions,
  public.ai_retrieval_feedback
to service_role;

comment on table public.ai_feedback_events is
  'Append-only normalized event stream for AI feedback, corrections, actions, and workflow outcomes.';
comment on table public.ai_learning_promotions is
  'Review and promotion ledger that turns repeated or approved feedback into durable AI learning destinations.';
comment on table public.ai_retrieval_feedback is
  'Retrieval-specific usage and outcome signals for source documents and chunks.';
comment on column public.ai_retrieval_feedback.source_chunk_id is
  'Soft reference to document_chunks.chunk_id. No FK until chunk ID uniqueness is enforced globally.';
comment on column public.ai_feedback_events.metadata is
  'Use metadata.visibility = private for user-private preference or memory events.';

commit;
