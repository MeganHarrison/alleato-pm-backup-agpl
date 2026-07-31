-- Seed Brandon's curated dashboard tag. Route assignments remain admin-managed
-- from the site map and are intentionally not copied from Megan's dashboard.
INSERT INTO public.app_page_tags (slug, label, color)
VALUES ('brandons-dashboard', 'Brandon''s Dashboard', 'primary')
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    color = EXCLUDED.color;
