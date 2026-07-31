-- Dev annotations table
-- Used by the in-app dev bridge overlay.
-- Megan annotates any page in dev mode; Claude Code polls, diagnoses, replies.
-- This table is dev-only — do not expose to clients or production UI.

create table if not exists dev_annotations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  route text not null,
  comment text not null,
  screenshot_url text,
  element_selector text,
  component_hint text,
  status text default 'open' check (status in ('open', 'in_progress', 'replied', 'resolved')),
  ai_reply text,
  ai_replied_at timestamptz,
  resolved_at timestamptz,
  created_by uuid references auth.users(id)
);
-- Only authenticated users can insert/read their own annotations
alter table dev_annotations enable row level security;
create policy "Users can manage own annotations"
  on dev_annotations
  for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);
-- Service role (used by Claude Code watcher script) can read and update all
-- This is handled by the service client — no additional policy needed.;
