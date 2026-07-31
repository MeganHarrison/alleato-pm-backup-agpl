create table if not exists public.admin_feedback_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null references public.user_profiles(id) on delete cascade,
  project_id integer null references public.projects(id) on delete set null,
  page_url text not null,
  page_path text not null,
  page_title text null,
  target_id text null,
  target_selector text not null,
  target_text text null,
  target_tag text null,
  dom_path text null,
  target_rect jsonb null,
  title text not null,
  comment text not null,
  request_type text not null default 'change_request',
  severity text null,
  status text not null default 'open',
  screenshot_url text null,
  screenshot_path text null,
  github_issue_number integer null,
  github_issue_url text null,
  github_issue_state text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint admin_feedback_items_request_type_check
    check (request_type in ('bug', 'change_request', 'copy', 'question')),
  constraint admin_feedback_items_severity_check
    check (severity is null or severity in ('low', 'medium', 'high')),
  constraint admin_feedback_items_status_check
    check (status in ('open', 'submitted', 'github_failed', 'closed'))
);
create index if not exists idx_admin_feedback_items_created_by
  on public.admin_feedback_items(created_by, created_at desc);
create index if not exists idx_admin_feedback_items_page_path
  on public.admin_feedback_items(page_path);
create index if not exists idx_admin_feedback_items_status
  on public.admin_feedback_items(status, created_at desc);
alter table public.admin_feedback_items enable row level security;
drop trigger if exists set_admin_feedback_items_updated_at on public.admin_feedback_items;
create trigger set_admin_feedback_items_updated_at
  before update on public.admin_feedback_items
  for each row
  execute function public.update_updated_at_column();
