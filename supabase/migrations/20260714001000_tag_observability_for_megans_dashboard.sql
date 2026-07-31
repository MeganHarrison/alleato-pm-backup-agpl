-- Add the Operational Logs page to Megan's curated dashboard.
-- This mirrors the live admin tag assignment so the link is durable in repo history.

insert into public.app_page_tag_assignments (route, tag_slug, created_by)
values (
  '/observability',
  'megans-dashboard',
  (
    select id
    from public.user_profiles
    where lower(email) = lower('megan@megankharrison.com')
    limit 1
  )
)
on conflict (route, tag_slug) do nothing;
