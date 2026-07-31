-- Add tool_id FK and agent_context to admin_feedback_items
-- Allows feedback items to be linked to a specific procore_tools row
-- and stores the resolved context bundle for agent consumption.

alter table public.admin_feedback_items
  add column if not exists tool_id integer references public.procore_tools(id) on delete set null,
  add column if not exists agent_context jsonb default null;
-- Index for filtering feedback by tool
create index if not exists idx_feedback_items_tool_id
  on public.admin_feedback_items(tool_id)
  where tool_id is not null;
comment on column public.admin_feedback_items.tool_id is
  'FK to procore_tools — the Procore tool this feedback relates to (auto-matched or manually assigned).';
comment on column public.admin_feedback_items.agent_context is
  'Resolved context bundle (PRP path, research folder, Procore URL, crawl command, resolution steps) for agents working on this item.';
