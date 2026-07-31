-- Recurring business issues tracking system.
-- Two tables: recurring_issues (master patterns) and recurring_issue_evidence
-- (source-backed examples tied to meetings/emails/Teams messages).
-- Junction table recurring_issue_projects links issues to projects (bigint FK).

-- ─── 1. Master issues table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recurring_issues (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  issue_title             TEXT NOT NULL,
  issue_category          TEXT NOT NULL CHECK (issue_category IN (
                            'change_management',
                            'financial_controls',
                            'procurement',
                            'reporting',
                            'accountability',
                            'scheduling',
                            'owner_relations',
                            'safety',
                            'other'
                          )),
  issue_summary           TEXT NOT NULL,

  business_impact         TEXT[] DEFAULT '{}' CHECK (
                            business_impact <@ ARRAY[
                              'margin_leakage',
                              'cash_flow_delay',
                              'schedule_risk',
                              'owner_confidence_risk',
                              'compliance_risk',
                              'team_friction',
                              'rework',
                              'other'
                            ]::TEXT[]
                          ),

  severity                TEXT NOT NULL DEFAULT 'medium' CHECK (
                            severity IN ('low', 'medium', 'high', 'critical')
                          ),

  -- 1–5 rolling frequency within configurable window
  frequency_score         SMALLINT DEFAULT 1 CHECK (frequency_score BETWEEN 1 AND 5),

  first_seen_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  last_seen_date          DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Which functional area owns resolution
  functional_owner        TEXT CHECK (functional_owner IN (
                            'operations',
                            'finance',
                            'project_management',
                            'precon',
                            'leadership',
                            'it',
                            'hr',
                            'unassigned'
                          )) DEFAULT 'unassigned',

  status                  TEXT NOT NULL DEFAULT 'open' CHECK (
                            status IN ('open', 'monitoring', 'improving', 'resolved')
                          ),

  recommended_countermeasure TEXT,

  -- Denormalized count; incremented by trigger when evidence is added
  evidence_count          INTEGER NOT NULL DEFAULT 0,

  -- Optional link to an external playbook or doc URL
  playbook_url            TEXT,

  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Evidence table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recurring_issue_evidence (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  recurring_issue_id   UUID NOT NULL REFERENCES public.recurring_issues(id) ON DELETE CASCADE,

  source_type          TEXT NOT NULL CHECK (source_type IN (
                         'meeting', 'email', 'teams', 'document', 'manual'
                       )),
  source_date          DATE,
  source_title         TEXT,

  -- Optional linkable foreign keys back to source records
  meeting_id           UUID,   -- references meetings(id) if source_type = 'meeting'
  email_id             UUID,   -- references emails(id) if source_type = 'email'
  document_id          UUID,   -- references documents(id) if source_type = 'document'

  project_id           BIGINT REFERENCES public.projects(id) ON DELETE SET NULL,

  people_involved      TEXT[],
  excerpt              TEXT,   -- Relevant quote or summary from the source

  confidence           TEXT NOT NULL DEFAULT 'medium' CHECK (
                         confidence IN ('low', 'medium', 'high')
                       ),

  tagged_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. Project junction table ────────────────────────────────────────────────
-- Tracks which projects a recurring issue has appeared in (separate from
-- per-evidence project linkage, which is optional).

CREATE TABLE IF NOT EXISTS public.recurring_issue_projects (
  recurring_issue_id  UUID    NOT NULL REFERENCES public.recurring_issues(id)   ON DELETE CASCADE,
  project_id          BIGINT  NOT NULL REFERENCES public.projects(id)           ON DELETE CASCADE,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (recurring_issue_id, project_id)
);

-- ─── 4. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_recurring_issues_category
  ON public.recurring_issues (issue_category);

CREATE INDEX IF NOT EXISTS idx_recurring_issues_status
  ON public.recurring_issues (status);

CREATE INDEX IF NOT EXISTS idx_recurring_issues_severity
  ON public.recurring_issues (severity);

CREATE INDEX IF NOT EXISTS idx_recurring_issues_last_seen
  ON public.recurring_issues (last_seen_date DESC);

CREATE INDEX IF NOT EXISTS idx_recurring_issue_evidence_issue
  ON public.recurring_issue_evidence (recurring_issue_id);

CREATE INDEX IF NOT EXISTS idx_recurring_issue_evidence_project
  ON public.recurring_issue_evidence (project_id);

CREATE INDEX IF NOT EXISTS idx_recurring_issue_evidence_source_date
  ON public.recurring_issue_evidence (source_date DESC);

CREATE INDEX IF NOT EXISTS idx_recurring_issue_projects_project
  ON public.recurring_issue_projects (project_id);

-- ─── 5. updated_at trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_recurring_issues_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recurring_issues_updated_at ON public.recurring_issues;
CREATE TRIGGER trg_recurring_issues_updated_at
  BEFORE UPDATE ON public.recurring_issues
  FOR EACH ROW EXECUTE FUNCTION public.set_recurring_issues_updated_at();

-- ─── 6. Evidence count maintenance trigger ───────────────────────────────────
-- Keeps recurring_issues.evidence_count in sync without a COUNT(*) subquery.

CREATE OR REPLACE FUNCTION public.sync_recurring_issue_evidence_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recurring_issues
    SET evidence_count = evidence_count + 1,
        last_seen_date = COALESCE(NEW.source_date, CURRENT_DATE)
    WHERE id = NEW.recurring_issue_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.recurring_issues
    SET evidence_count = GREATEST(evidence_count - 1, 0)
    WHERE id = OLD.recurring_issue_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_evidence_count ON public.recurring_issue_evidence;
CREATE TRIGGER trg_sync_evidence_count
  AFTER INSERT OR DELETE ON public.recurring_issue_evidence
  FOR EACH ROW EXECUTE FUNCTION public.sync_recurring_issue_evidence_count();

-- ─── 7. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.recurring_issues         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_issue_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_issue_projects ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
DROP POLICY IF EXISTS "auth read recurring_issues"         ON public.recurring_issues;
DROP POLICY IF EXISTS "auth read recurring_issue_evidence" ON public.recurring_issue_evidence;
DROP POLICY IF EXISTS "auth read recurring_issue_projects" ON public.recurring_issue_projects;

CREATE POLICY "auth read recurring_issues"
  ON public.recurring_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read recurring_issue_evidence"
  ON public.recurring_issue_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read recurring_issue_projects"
  ON public.recurring_issue_projects FOR SELECT TO authenticated USING (true);

-- All authenticated users can insert/update/delete
DROP POLICY IF EXISTS "auth write recurring_issues"         ON public.recurring_issues;
DROP POLICY IF EXISTS "auth write recurring_issue_evidence" ON public.recurring_issue_evidence;
DROP POLICY IF EXISTS "auth write recurring_issue_projects" ON public.recurring_issue_projects;

CREATE POLICY "auth write recurring_issues"
  ON public.recurring_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth write recurring_issue_evidence"
  ON public.recurring_issue_evidence FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth write recurring_issue_projects"
  ON public.recurring_issue_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 8. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.recurring_issues IS
  'Master table of recurring business patterns and operational issues. Each row is a distinct pattern, not a one-time incident.';

COMMENT ON TABLE public.recurring_issue_evidence IS
  'Source-backed examples tied to a recurring issue. Links back to meetings, emails, or Teams messages so patterns are traceable, not opinion.';

COMMENT ON TABLE public.recurring_issue_projects IS
  'Junction table: which projects a recurring issue has been observed in.';

COMMENT ON COLUMN public.recurring_issues.evidence_count IS
  'Denormalized count maintained by trigger. Do not update manually.';

COMMENT ON COLUMN public.recurring_issues.frequency_score IS
  '1 = rare / isolated. 5 = constant / systemic. Update manually or via a scheduled rollup.';

COMMENT ON COLUMN public.recurring_issues.playbook_url IS
  'Optional link to a Notion doc, Google Doc, or internal playbook describing the countermeasure in detail.';
