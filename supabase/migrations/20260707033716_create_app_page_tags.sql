-- Site-map page tags: a small tag catalog plus a route↔tag join table.
-- Mirrors app_page_access_policies (admin-managed, keyed by the generated route
-- inventory). Lets admins tag any page from the site map and build curated views
-- (e.g. "Megan's Dashboard") that filter the route inventory by an applied tag.

-- 1. Tag catalog — the set of tags that can be applied to pages. Slug is the
--    stable key; label is the human name shown in the UI.
CREATE TABLE IF NOT EXISTS public.app_page_tags (
  slug text PRIMARY KEY,
  label text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT app_page_tags_slug_format_check CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT app_page_tags_label_not_blank_check CHECK (length(btrim(label)) > 0)
);

COMMENT ON TABLE public.app_page_tags IS
  'Admin-managed catalog of page tags applied from the site map. Reusable across pages; drives curated tagged-page views.';
COMMENT ON COLUMN public.app_page_tags.slug IS
  'Stable kebab-case identifier for the tag, e.g. megans-dashboard.';
COMMENT ON COLUMN public.app_page_tags.label IS
  'Human-readable display name for the tag.';
COMMENT ON COLUMN public.app_page_tags.color IS
  'Optional semantic color token name used to style the tag badge.';

-- 2. Assignments — which routes carry which tags. Route mirrors the value used
--    by app_page_access_policies (concrete route pattern from the inventory).
CREATE TABLE IF NOT EXISTS public.app_page_tag_assignments (
  route text NOT NULL,
  tag_slug text NOT NULL REFERENCES public.app_page_tags(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT app_page_tag_assignments_route_check CHECK (route ~ '^/'),
  PRIMARY KEY (route, tag_slug)
);

COMMENT ON TABLE public.app_page_tag_assignments IS
  'Join table mapping a route from the app route inventory to a tag in app_page_tags.';

CREATE INDEX IF NOT EXISTS idx_app_page_tag_assignments_tag_slug
  ON public.app_page_tag_assignments (tag_slug);

CREATE INDEX IF NOT EXISTS idx_app_page_tag_assignments_route
  ON public.app_page_tag_assignments (route);

DROP TRIGGER IF EXISTS update_app_page_tags_updated_at ON public.app_page_tags;
CREATE TRIGGER update_app_page_tags_updated_at
  BEFORE UPDATE ON public.app_page_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS — admin read/write, service role full access (same posture as page access).
ALTER TABLE public.app_page_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_page_tag_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_page_tags_select_admin ON public.app_page_tags;
CREATE POLICY app_page_tags_select_admin
  ON public.app_page_tags
  FOR SELECT
  TO authenticated
  USING (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_tags_write_admin ON public.app_page_tags;
CREATE POLICY app_page_tags_write_admin
  ON public.app_page_tags
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_tags_service_role ON public.app_page_tags;
CREATE POLICY app_page_tags_service_role
  ON public.app_page_tags
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS app_page_tag_assignments_select_admin ON public.app_page_tag_assignments;
CREATE POLICY app_page_tag_assignments_select_admin
  ON public.app_page_tag_assignments
  FOR SELECT
  TO authenticated
  USING (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_tag_assignments_write_admin ON public.app_page_tag_assignments;
CREATE POLICY app_page_tag_assignments_write_admin
  ON public.app_page_tag_assignments
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_tag_assignments_service_role ON public.app_page_tag_assignments;
CREATE POLICY app_page_tag_assignments_service_role
  ON public.app_page_tag_assignments
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Seed the megans-dashboard tag so the curated view can be queried immediately.
INSERT INTO public.app_page_tags (slug, label, color)
VALUES ('megans-dashboard', 'Megan''s Dashboard', 'primary')
ON CONFLICT (slug) DO NOTHING;
