alter table public.user_table_views
add column if not exists column_widths jsonb;

comment on column public.user_table_views.column_widths is
  'Optional per-column width overrides keyed by column id for saved table views.';
