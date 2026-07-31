-- ============================================================
-- Council Mode Data Enrichment
-- Adds structured classification columns to meeting_segments
-- and a risk trajectory snapshot table for the CRO specialist.
-- ============================================================

-- ─── 1. Enrich meeting_segments ───────────────────────────────

-- data_class: what kind of intelligence is in this segment
-- Examples: ['decision','risk_signal','financial_event','action_item','relationship_signal','lesson_learned']
ALTER TABLE public.meeting_segments
  ADD COLUMN IF NOT EXISTS data_class       text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sentiment        text      CHECK (sentiment IN ('positive','neutral','negative','escalation')),
  ADD COLUMN IF NOT EXISTS project_impact   text[]    DEFAULT '{}', -- ['schedule','cost','quality','relationship','safety']
  ADD COLUMN IF NOT EXISTS mentioned_people text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enriched_at      timestamp with time zone,
  ADD COLUMN IF NOT EXISTS enrichment_model text;
-- track which model version enriched this row

-- Index for agent queries: "find all risk signals for project X"
CREATE INDEX IF NOT EXISTS idx_meeting_segments_data_class
  ON public.meeting_segments USING GIN (data_class);
CREATE INDEX IF NOT EXISTS idx_meeting_segments_sentiment
  ON public.meeting_segments (sentiment)
  WHERE sentiment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_segments_project_impact
  ON public.meeting_segments USING GIN (project_impact);
-- Index for enrichment backfill job: find un-enriched segments efficiently
CREATE INDEX IF NOT EXISTS idx_meeting_segments_unenriched
  ON public.meeting_segments (created_at)
  WHERE enriched_at IS NULL;
COMMENT ON COLUMN public.meeting_segments.data_class IS
  'AI-classified content types. Values: decision, risk_signal, financial_event, action_item, relationship_signal, lesson_learned, schedule_event, change_event';
COMMENT ON COLUMN public.meeting_segments.sentiment IS
  'Overall tone of this segment. Escalation = raised voices / dispute signals detected.';
COMMENT ON COLUMN public.meeting_segments.project_impact IS
  'Which project dimensions are affected. Values: schedule, cost, quality, relationship, safety, scope';
COMMENT ON COLUMN public.meeting_segments.mentioned_people IS
  'Names of people mentioned or speaking in this segment, extracted during enrichment.';
-- ─── 2. Project risk snapshots (CRO trajectory data) ──────────

CREATE TABLE IF NOT EXISTS public.project_risk_snapshots (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_date   date    NOT NULL DEFAULT CURRENT_DATE,

  -- Core risk signals (mirrors what getProjectsWithRisks returns)
  risk_score            numeric(5,2),   -- 0–100 composite score
  open_risks            integer DEFAULT 0,
  critical_risks        integer DEFAULT 0,
  open_issues           integer DEFAULT 0,
  overdue_tasks         integer DEFAULT 0,
  aging_rfis            integer DEFAULT 0,  -- RFIs open > 14 days
  unresolved_insights   integer DEFAULT 0,

  -- Trend derived from comparing to prior snapshot
  trend           text CHECK (trend IN ('improving','stable','deteriorating','new')),

  -- Narrative: the CRO's one-sentence take this week (filled by enrichment job)
  risk_narrative  text,

  created_at      timestamp with time zone DEFAULT now() NOT NULL,

  -- One snapshot per project per day
  UNIQUE (project_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_project_date
  ON public.project_risk_snapshots (project_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_trend
  ON public.project_risk_snapshots (trend, snapshot_date DESC)
  WHERE trend = 'deteriorating';
COMMENT ON TABLE public.project_risk_snapshots IS
  'Daily risk health snapshots per project. Powers CRO trend analysis: "Goodwill Tremont has been deteriorating for 6 weeks."';
COMMENT ON COLUMN public.project_risk_snapshots.trend IS
  'Compared to the previous snapshot. New = first snapshot for this project.';
COMMENT ON COLUMN public.project_risk_snapshots.risk_narrative IS
  'One-sentence AI-generated summary of the dominant risk signal this day.';
-- ─── 3. Convenience view: latest snapshot per project ─────────

CREATE OR REPLACE VIEW public.project_risk_current AS
SELECT DISTINCT ON (project_id)
  s.*,
  p.name AS project_name
FROM public.project_risk_snapshots s
JOIN public.projects p ON p.id = s.project_id
ORDER BY project_id, snapshot_date DESC;
COMMENT ON VIEW public.project_risk_current IS
  'Latest risk snapshot per project. Primary query target for CRO agent.';
-- ─── 4. Convenience view: deteriorating projects ──────────────

CREATE OR REPLACE VIEW public.project_risk_deteriorating AS
SELECT
  s.project_id,
  p.name AS project_name,
  s.snapshot_date,
  s.risk_score,
  s.trend,
  s.risk_narrative,
  -- How many consecutive deteriorating days
  COUNT(*) FILTER (WHERE s2.trend = 'deteriorating') AS deteriorating_days
FROM public.project_risk_snapshots s
JOIN public.projects p ON p.id = s.project_id
-- Self-join to count consecutive deteriorating days
LEFT JOIN public.project_risk_snapshots s2
  ON s2.project_id = s.project_id
  AND s2.snapshot_date >= (CURRENT_DATE - INTERVAL '30 days')
  AND s2.trend = 'deteriorating'
WHERE s.snapshot_date = (
  SELECT MAX(snapshot_date)
  FROM public.project_risk_snapshots
  WHERE project_id = s.project_id
)
AND s.trend = 'deteriorating'
GROUP BY s.project_id, p.name, s.snapshot_date, s.risk_score, s.trend, s.risk_narrative;
COMMENT ON VIEW public.project_risk_deteriorating IS
  'Projects currently in deteriorating trend, with count of consecutive deteriorating days.';
