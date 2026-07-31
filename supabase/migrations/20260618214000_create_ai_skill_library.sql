-- First-class AI Skill Library for reviewed, reusable operating procedures.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.ai_skills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null check (length(trim(title)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  summary text not null check (length(trim(summary)) > 0),
  body text not null check (length(trim(body)) > 0),
  instructions text not null check (length(trim(instructions)) > 0),
  category text not null check (length(trim(category)) > 0),
  scope_type text not null check (scope_type in ('personal','project','team','company')),
  project_id integer null references public.projects(id) on delete set null,
  owner_user_id uuid null references auth.users(id) on delete set null,
  reviewer_user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'candidate' check (
    status in ('draft','candidate','in_review','active','rejected','archived')
  ),
  version integer not null default 1 check (version >= 1),
  supersedes_skill_id uuid null references public.ai_skills(id) on delete set null,
  examples jsonb not null default '[]'::jsonb check (jsonb_typeof(examples) = 'array'),
  source_event_ids uuid[] not null default '{}'::uuid[],
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz null,
  reviewed_at timestamptz null,
  review_notes text null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  constraint ai_skills_project_scope_requires_project check (
    (scope_type = 'project' and project_id is not null)
    or (scope_type <> 'project' and project_id is null)
  ),
  constraint ai_skills_personal_scope_requires_owner check (
    scope_type <> 'personal' or owner_user_id is not null
  )
);

create table if not exists public.ai_skill_usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  skill_id uuid not null references public.ai_skills(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  project_id integer null references public.projects(id) on delete set null,
  session_id uuid null,
  surface text not null,
  outcome text not null default 'used' check (
    outcome in ('used','helpful','unhelpful','blocked','error')
  ),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists ai_skills_scope_slug_version_idx
  on public.ai_skills(
    scope_type,
    slug,
    version,
    coalesce(project_id, 0),
    coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists ai_skills_status_updated_idx
  on public.ai_skills(status, updated_at desc);
create index if not exists ai_skills_scope_status_idx
  on public.ai_skills(scope_type, status, updated_at desc);
create index if not exists ai_skills_project_status_idx
  on public.ai_skills(project_id, status, updated_at desc)
  where project_id is not null;
create index if not exists ai_skills_owner_status_idx
  on public.ai_skills(owner_user_id, status, updated_at desc)
  where owner_user_id is not null;
create index if not exists ai_skills_reviewer_status_idx
  on public.ai_skills(reviewer_user_id, status, updated_at desc)
  where reviewer_user_id is not null;
create index if not exists ai_skills_category_status_idx
  on public.ai_skills(category, status, updated_at desc);
create index if not exists ai_skills_source_events_idx
  on public.ai_skills using gin(source_event_ids);
create index if not exists ai_skills_metadata_idx
  on public.ai_skills using gin(metadata jsonb_path_ops);

create index if not exists ai_skill_usage_events_skill_created_idx
  on public.ai_skill_usage_events(skill_id, created_at desc);
create index if not exists ai_skill_usage_events_user_created_idx
  on public.ai_skill_usage_events(user_id, created_at desc)
  where user_id is not null;
create index if not exists ai_skill_usage_events_project_created_idx
  on public.ai_skill_usage_events(project_id, created_at desc)
  where project_id is not null;
create index if not exists ai_skill_usage_events_outcome_created_idx
  on public.ai_skill_usage_events(outcome, created_at desc);

drop trigger if exists ai_skills_set_updated_at on public.ai_skills;
create trigger ai_skills_set_updated_at
  before update on public.ai_skills
  for each row execute function public.update_updated_at_column();

create or replace function public.ai_skill_usage_events_increment_skill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_skills
  set
    usage_count = usage_count + 1,
    last_used_at = greatest(coalesce(last_used_at, new.created_at), new.created_at)
  where id = new.skill_id;

  if not found then
    raise exception 'ai_skill_usage_events references missing skill %', new.skill_id;
  end if;

  return new;
end;
$$;

drop trigger if exists ai_skill_usage_events_increment_skill on public.ai_skill_usage_events;
create trigger ai_skill_usage_events_increment_skill
  after insert on public.ai_skill_usage_events
  for each row execute function public.ai_skill_usage_events_increment_skill();

alter table public.ai_skills enable row level security;
alter table public.ai_skill_usage_events enable row level security;

drop policy if exists ai_skills_select_visible on public.ai_skills;
create policy ai_skills_select_visible
  on public.ai_skills
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or (
      scope_type = 'personal'
      and owner_user_id = auth.uid()
    )
    or (
      scope_type = 'project'
      and project_id is not null
      and public.current_is_project_member(project_id)
    )
    or scope_type in ('team','company')
  );

drop policy if exists ai_skills_insert_owner_or_admin on public.ai_skills;
create policy ai_skills_insert_owner_or_admin
  on public.ai_skills
  for insert
  to authenticated
  with check (
    public.current_is_app_admin()
    or (
      owner_user_id = auth.uid()
      and status in ('draft','candidate')
    )
  );

drop policy if exists ai_skills_update_owner_reviewer_or_admin on public.ai_skills;
create policy ai_skills_update_owner_reviewer_or_admin
  on public.ai_skills
  for update
  to authenticated
  using (
    public.current_is_app_admin()
    or reviewer_user_id = auth.uid()
    or (
      owner_user_id = auth.uid()
      and status in ('draft','candidate','in_review')
    )
  )
  with check (
    public.current_is_app_admin()
    or reviewer_user_id = auth.uid()
    or (
      owner_user_id = auth.uid()
      and status in ('draft','candidate','in_review')
    )
  );

drop policy if exists ai_skills_service_write on public.ai_skills;
create policy ai_skills_service_write
  on public.ai_skills
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists ai_skill_usage_events_select_visible on public.ai_skill_usage_events;
create policy ai_skill_usage_events_select_visible
  on public.ai_skill_usage_events
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or user_id = auth.uid()
    or exists (
      select 1
      from public.ai_skills s
      where s.id = ai_skill_usage_events.skill_id
        and (
          (s.scope_type = 'personal' and s.owner_user_id = auth.uid())
          or (
            s.scope_type = 'project'
            and s.project_id is not null
            and public.current_is_project_member(s.project_id)
          )
          or s.scope_type in ('team','company')
        )
    )
  );

drop policy if exists ai_skill_usage_events_insert_visible on public.ai_skill_usage_events;
create policy ai_skill_usage_events_insert_visible
  on public.ai_skill_usage_events
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.ai_skills s
      where s.id = skill_id
        and s.status = 'active'
        and (
          (s.scope_type = 'personal' and s.owner_user_id = auth.uid())
          or (
            s.scope_type = 'project'
            and s.project_id is not null
            and public.current_is_project_member(s.project_id)
          )
          or s.scope_type in ('team','company')
        )
    )
  );

drop policy if exists ai_skill_usage_events_service_write on public.ai_skill_usage_events;
create policy ai_skill_usage_events_service_write
  on public.ai_skill_usage_events
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update on public.ai_skills to authenticated;
grant select, insert on public.ai_skill_usage_events to authenticated;
grant all on public.ai_skills, public.ai_skill_usage_events to service_role;
grant execute on function public.ai_skill_usage_events_increment_skill() to service_role;

comment on table public.ai_skills is
  'Reviewed, reusable AI skill library records promoted from Teach Alleato, admin review, and other learning workflows.';
comment on column public.ai_skills.scope_type is
  'Visibility scope: personal owner, project members, team-wide authenticated users, or company-wide authenticated users.';
comment on column public.ai_skills.examples is
  'Array of example input/output objects used by UI and prompt assembly.';
comment on column public.ai_skills.source_event_ids is
  'Feedback event IDs that justify or originated this skill.';
comment on table public.ai_skill_usage_events is
  'Append-only skill usage ledger. Inserts increment ai_skills.usage_count and last_used_at through trigger.';

commit;
