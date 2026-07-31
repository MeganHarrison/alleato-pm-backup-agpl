-- Add social media columns to people table
alter table public.people
  add column if not exists facebook text,
  add column if not exists x_handle text;
