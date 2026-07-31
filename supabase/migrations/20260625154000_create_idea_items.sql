create table if not exists public.idea_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.user_profiles(id) on delete set null,
  project_id integer null references public.projects(id) on delete set null,
  title text not null,
  body text not null,
  status text not null default 'captured' check (
    status in (
      'captured',
      'reviewing',
      'routed',
      'in_progress',
      'done',
      'deferred',
      'blocked'
    )
  ),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  route_type text not null default 'unrouted' check (
    route_type in (
      'unrouted',
      'linear',
      'codex',
      'sub_agent',
      'ai_process',
      'project',
      'manual'
    )
  ),
  route_target text null,
  ai_summary text null,
  ai_next_action text null,
  linked_linear_issue_id text null,
  linked_linear_issue_url text null,
  source text not null default 'manual' check (
    source in (
      'manual',
      'slash_command',
      'ai_assistant',
      'teams',
      'email',
      'screenshot',
      'seed'
    )
  ),
  source_context text null,
  source_url text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_idea_items_status_updated
  on public.idea_items(status, updated_at desc);

create index if not exists idx_idea_items_route_type_updated
  on public.idea_items(route_type, updated_at desc);

create index if not exists idx_idea_items_created_by_updated
  on public.idea_items(created_by, updated_at desc);

create index if not exists idx_idea_items_project_id_updated
  on public.idea_items(project_id, updated_at desc)
  where project_id is not null;

drop trigger if exists set_idea_items_updated_at on public.idea_items;
create trigger set_idea_items_updated_at
  before update on public.idea_items
  for each row
  execute function public.update_updated_at_column();

alter table public.idea_items enable row level security;

drop policy if exists idea_items_select_authenticated on public.idea_items;
create policy idea_items_select_authenticated
  on public.idea_items
  for select
  to authenticated
  using (true);

drop policy if exists idea_items_insert_own on public.idea_items;
create policy idea_items_insert_own
  on public.idea_items
  for insert
  to authenticated
  with check (created_by is null or created_by = auth.uid());

drop policy if exists idea_items_update_own_or_admin on public.idea_items;
create policy idea_items_update_own_or_admin
  on public.idea_items
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.current_is_app_admin()
  )
  with check (
    created_by is null
    or created_by = auth.uid()
    or public.current_is_app_admin()
  );

drop policy if exists idea_items_delete_own_or_admin on public.idea_items;
create policy idea_items_delete_own_or_admin
  on public.idea_items
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.current_is_app_admin()
  );

drop policy if exists idea_items_service_write on public.idea_items;
create policy idea_items_service_write
  on public.idea_items
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.idea_items is
  'Lightweight editable idea inbox for quick capture, AI routing review, and later promotion to Linear/Codex/sub-agent work.';
comment on column public.idea_items.status is
  'Human-readable lifecycle status for the idea table.';
comment on column public.idea_items.route_type is
  'Where AI or a human believes the idea should go next; routing remains inspectable before automation acts.';

insert into public.idea_items (
  title,
  body,
  status,
  priority,
  route_type,
  route_target,
  ai_next_action,
  source,
  source_context,
  metadata
)
select
  'Auto-login links for RFI email actions',
  'When transactional emails include actions like View RFI, make the link a secure auto-login/deep link so subcontractors do not have to remember a password before responding. Brandon forwarded the RFI response email screenshot and asked, "Did you mean to send this to my Gmail?", which surfaced the friction around external recipients and email routing.',
  'captured',
  'high',
  'project',
  'RFI email response workflow',
  'Review the RFI notification/link flow and decide whether secure magic-link tokens should be attached to action URLs for external recipients.',
  'teams',
  'Brandon Teams message about RFI response email sent to Gmail',
  jsonb_build_object('seed_key', '2026-06-25-rfi-email-auto-login')
where not exists (
  select 1
  from public.idea_items
  where metadata ->> 'seed_key' = '2026-06-25-rfi-email-auto-login'
);
