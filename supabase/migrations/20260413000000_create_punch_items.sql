-- ============================================================================
-- CREATE PUNCH ITEMS TABLES
-- ============================================================================
-- punch_items: core punch list item entity (one per project, auto-numbered)
-- punch_item_comments: threaded comments on punch items
--
-- Both tables use project-scoped RLS via project_directory_memberships.
-- Mapping chain: auth.uid() → users_auth.auth_user_id → person_id
--                → project_directory_memberships.person_id + project_id
-- ============================================================================

-- ----------------------------------------------------------------------------
-- punch_items
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.punch_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Auto-incrementing number per project (not globally unique)
  number                INTEGER NOT NULL,

  -- Core fields
  title                 TEXT NOT NULL,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'work_required', 'initiated', 'closed')),
  priority              TEXT CHECK (priority IN ('low', 'medium', 'high')),

  -- Assignment
  assignee_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_company      TEXT,
  punch_item_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  final_approver_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ball_in_court         TEXT,

  -- Dates
  due_date              DATE,
  date_notified         TIMESTAMPTZ,
  date_closed           TIMESTAMPTZ,
  date_resolved         TIMESTAMPTZ,

  -- Categorisation
  location              TEXT,
  trade                 TEXT,
  type                  TEXT,
  reference             TEXT,
  drawing_reference     TEXT,
  cost_code             TEXT,
  cost_impact           NUMERIC(12, 2),

  -- Visibility / soft delete
  is_private            BOOLEAN NOT NULL DEFAULT false,
  is_deleted            BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (project_id, number)
);
-- Indexes for common filter/sort patterns
CREATE INDEX IF NOT EXISTS idx_punch_items_project_id
  ON public.punch_items(project_id);
CREATE INDEX IF NOT EXISTS idx_punch_items_status
  ON public.punch_items(project_id, status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_punch_items_assignee
  ON public.punch_items(project_id, assignee_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_punch_items_active
  ON public.punch_items(project_id, number DESC) WHERE is_deleted = false;
-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_punch_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_punch_items_updated_at ON public.punch_items;
CREATE TRIGGER trg_punch_items_updated_at
  BEFORE UPDATE ON public.punch_items
  FOR EACH ROW EXECUTE FUNCTION public.set_punch_items_updated_at();
-- RLS
ALTER TABLE public.punch_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "punch_items_select" ON public.punch_items;
DROP POLICY IF EXISTS "punch_items_insert" ON public.punch_items;
DROP POLICY IF EXISTS "punch_items_update" ON public.punch_items;
DROP POLICY IF EXISTS "punch_items_delete" ON public.punch_items;
CREATE POLICY "punch_items_select" ON public.punch_items
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
    )
  );
CREATE POLICY "punch_items_insert" ON public.punch_items
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
    )
  );
CREATE POLICY "punch_items_update" ON public.punch_items
  FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
    )
  );
CREATE POLICY "punch_items_delete" ON public.punch_items
  FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
    )
  );
-- ----------------------------------------------------------------------------
-- punch_item_comments
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.punch_item_comments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_item_id  UUID NOT NULL REFERENCES public.punch_items(id) ON DELETE CASCADE,
  project_id     INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content        TEXT NOT NULL,
  mentions       UUID[],
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ,
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_punch_item_comments_item
  ON public.punch_item_comments(punch_item_id);
ALTER TABLE public.punch_item_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "punch_item_comments_select" ON public.punch_item_comments;
DROP POLICY IF EXISTS "punch_item_comments_insert" ON public.punch_item_comments;
DROP POLICY IF EXISTS "punch_item_comments_update" ON public.punch_item_comments;
CREATE POLICY "punch_item_comments_select" ON public.punch_item_comments
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
    )
  );
CREATE POLICY "punch_item_comments_insert" ON public.punch_item_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
    )
  );
CREATE POLICY "punch_item_comments_update" ON public.punch_item_comments
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());
