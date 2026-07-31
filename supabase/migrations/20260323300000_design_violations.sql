-- Design violation tracker
-- Megan right-clicks any element in dev mode, flags the violation type.
-- Claude Code reads this file at session start and fixes before new work.

create table if not exists design_violations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  route text not null,
  element_description text,        -- human label: "Submit button", "Budget card"
  element_selector text,           -- CSS selector for agent-browser

  violation_type text not null
    check (violation_type in (
      'wrong_button',
      'bg_white',
      'card_trap',
      'wrong_text_hierarchy',
      'hardcoded_color',
      'arbitrary_spacing',
      'missing_token',
      'wrong_component',
      'inconsistent_pattern',
      'other'
    )),

  notes text,                      -- optional extra context from Megan
  screenshot_url text,

  status text default 'open'
    check (status in ('open', 'in_progress', 'fixed', 'wont_fix')),

  fixed_in_file text,              -- which file Claude Code fixed it in
  fixed_at timestamptz,
  priority text default 'normal'
    check (priority in ('low', 'normal', 'high')),

  submitted_by uuid references auth.users(id)
);
create index design_violations_status_idx on design_violations(status, created_at desc);
-- RLS: authenticated users manage their own violations, service role sees all
alter table design_violations enable row level security;
create policy "Users manage own violations"
  on design_violations for all
  using (auth.uid() = submitted_by)
  with check (auth.uid() = submitted_by);
