-- Add updated_at trigger for roadmap_items
-- public.set_updated_at() already exists from earlier migrations
create trigger roadmap_items_set_updated_at
  before update on public.roadmap_items
  for each row
  execute function public.set_updated_at();

-- Add indexes for common query patterns
create index roadmap_items_phase_idx on roadmap_items (phase);
create index roadmap_items_phase_sort_idx on roadmap_items (phase, sort_order);;
