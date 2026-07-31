-- Migration: Change Workflow Tables
-- Creates the new Alito change management system tables (PCOs, versions, timeline, notifications, comments)
-- Adds columns to existing change_events for the new workflow
-- Preserves existing tables and data

-- ============================================================================
-- 1. POTENTIAL CHANGE ORDERS (PCOs) — Parent table for existing pco_line_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.potential_change_orders (
  id bigserial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES public.projects(id),
  number text NOT NULL,                           -- Auto-incremented: "PCO-001"
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'CLIENT_REQUESTED'   -- CLIENT_REQUESTED | INTERNAL | MIXED
    CHECK (type IN ('CLIENT_REQUESTED', 'INTERNAL', 'MIXED')),
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'VOID')),
  current_version integer NOT NULL DEFAULT 1,
  created_by_id text REFERENCES auth.users(id),

  -- Financial
  estimated_value numeric(14,2),
  approved_value numeric(14,2),
  markup_percentage numeric(5,2) DEFAULT 0,

  -- Schedule
  schedule_impact_days integer,
  schedule_impact_description text,

  -- RFQ tracking
  rfq_required boolean NOT NULL DEFAULT false,
  rfq_status text CHECK (rfq_status IN ('NOT_SENT', 'SENT', 'RECEIVED')),

  -- Annotation (post-execution tagging)
  annotation text CHECK (annotation IN ('POSITIVE', 'NEGATIVE', 'LESSON_LEARNED')),
  annotation_note text,

  -- Root cause
  root_cause text,

  -- Link to official CO once approved
  prime_change_order_id bigint,                   -- FK added after prime_change_orders_v2 created

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  approved_at timestamptz
);
-- Index for project-level queries
CREATE INDEX IF NOT EXISTS idx_pco_project_id ON public.potential_change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_pco_status ON public.potential_change_orders(status);
-- Unique PCO number per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_pco_number_project
  ON public.potential_change_orders(project_id, number);
-- ============================================================================
-- 2. ADD FK FROM pco_line_items → potential_change_orders
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pco_line_items_pco_id_fkey'
    AND table_name = 'pco_line_items'
  ) THEN
    ALTER TABLE public.pco_line_items
      ADD CONSTRAINT pco_line_items_pco_id_fkey
      FOREIGN KEY (pco_id) REFERENCES public.potential_change_orders(id);
  END IF;
END $$;
-- Add category and type columns to pco_line_items if missing
ALTER TABLE public.pco_line_items
  ADD COLUMN IF NOT EXISTS line_type text DEFAULT 'COST'
    CHECK (line_type IN ('COST', 'CREDIT')),
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'OTHER'
    CHECK (category IN ('LABOR', 'MATERIAL', 'EQUIPMENT', 'OTHER')),
  ADD COLUMN IF NOT EXISTS subcontractor_id text;
-- ============================================================================
-- 3. PCO VERSIONS — Snapshot on each submission
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pco_versions (
  id bigserial PRIMARY KEY,
  pco_id bigint NOT NULL REFERENCES public.potential_change_orders(id),
  version integer NOT NULL,
  snapshot_data jsonb NOT NULL,                    -- Full PCO state at time of submission
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by_id text REFERENCES auth.users(id),
  client_decision text CHECK (client_decision IN ('APPROVED', 'REVISION_REQUESTED')),
  client_decision_at timestamptz,
  client_decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pco_versions_pco_id ON public.pco_versions(pco_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pco_versions_unique
  ON public.pco_versions(pco_id, version);
-- ============================================================================
-- 4. PCO ↔ CHANGE EVENT JUNCTION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pco_change_events (
  id bigserial PRIMARY KEY,
  pco_id bigint NOT NULL REFERENCES public.potential_change_orders(id),
  change_event_id text NOT NULL REFERENCES public.change_events(id),
  estimated_amount numeric(14,2),
  sort_order integer DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by_id text REFERENCES auth.users(id),
  UNIQUE(pco_id, change_event_id)
);
CREATE INDEX IF NOT EXISTS idx_pco_ce_pco_id ON public.pco_change_events(pco_id);
CREATE INDEX IF NOT EXISTS idx_pco_ce_change_event_id ON public.pco_change_events(change_event_id);
-- ============================================================================
-- 5. ADD COLUMNS TO EXISTING change_events TABLE
-- ============================================================================
ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS internal_subtype text
    CHECK (internal_subtype IN (
      'ERROR', 'EFFICIENCY', 'WEATHER_DELAY', 'SAFETY_INCIDENT',
      'VALUE_ENGINEERING', 'SCHEDULE_DELAY', 'OTHER'
    )),
  ADD COLUMN IF NOT EXISTS originator_role text
    CHECK (originator_role IN ('SUPER', 'PM', 'VP', 'LEADERSHIP')),
  ADD COLUMN IF NOT EXISTS potential_change_order_id bigint
    REFERENCES public.potential_change_orders(id);
CREATE INDEX IF NOT EXISTS idx_ce_pco_id
  ON public.change_events(potential_change_order_id);
-- ============================================================================
-- 6. TIMELINE EVENTS — Cross-entity append-only audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id bigserial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES public.projects(id),
  parent_type text NOT NULL
    CHECK (parent_type IN ('CHANGE_EVENT', 'PCO', 'PRIME_CO', 'COMMITMENT_CO')),
  parent_id text NOT NULL,                        -- text to support both UUID and bigint parents
  event_type text NOT NULL
    CHECK (event_type IN (
      'CREATED', 'UPDATED', 'DOCUMENT_LINKED', 'GROUPED_INTO_PCO',
      'UNGROUPED_FROM_PCO', 'RFQ_SENT', 'RFQ_RECEIVED',
      'PCO_SUBMITTED', 'CLIENT_REVISION_REQUESTED', 'PCO_REVISED',
      'PCO_APPROVED', 'CO_CREATED', 'CCO_CREATED',
      'SIGNATURE_RECEIVED', 'CO_EXECUTED',
      'COMMENT_ADDED', 'ANNOTATION_SET', 'STATUS_CHANGED'
    )),
  actor_id text REFERENCES auth.users(id),
  actor_role text,
  summary text NOT NULL,
  metadata jsonb,                                 -- Extra structured data per event type
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No updates or deletes — append-only
CREATE INDEX IF NOT EXISTS idx_timeline_project ON public.timeline_events(project_id);
CREATE INDEX IF NOT EXISTS idx_timeline_parent ON public.timeline_events(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON public.timeline_events(created_at);
-- ============================================================================
-- 7. CHANGE WORKFLOW COMMENTS — Threaded comments with client visibility
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.change_workflow_comments (
  id bigserial PRIMARY KEY,
  parent_type text NOT NULL
    CHECK (parent_type IN ('CHANGE_EVENT', 'PCO', 'PRIME_CO', 'COMMITMENT_CO')),
  parent_id text NOT NULL,
  author_id text NOT NULL REFERENCES auth.users(id),
  author_role text,
  body text NOT NULL,
  visible_to_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cwc_parent ON public.change_workflow_comments(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_cwc_author ON public.change_workflow_comments(author_id);
-- ============================================================================
-- 8. CHANGE WORKFLOW NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.change_workflow_notifications (
  id bigserial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES public.projects(id),
  recipient_id text NOT NULL REFERENCES auth.users(id),
  type text NOT NULL
    CHECK (type IN (
      'PCO_CREATED', 'PCO_SUBMITTED_TO_CLIENT', 'CLIENT_APPROVED',
      'CLIENT_REVISION_REQUESTED', 'PCO_REVISED', 'RFQ_RECEIVED',
      'CO_EXECUTED', 'COMMENT_ADDED'
    )),
  reference_type text NOT NULL
    CHECK (reference_type IN ('PCO', 'CO', 'CCO', 'RFQ', 'CHANGE_EVENT')),
  reference_id text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cwn_recipient ON public.change_workflow_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_cwn_unread
  ON public.change_workflow_notifications(recipient_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cwn_project ON public.change_workflow_notifications(project_id);
-- ============================================================================
-- 9. PROJECT NOTIFICATION GROUPS — Leadership distribution per project
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_notification_groups (
  id bigserial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES public.projects(id),
  group_type text NOT NULL DEFAULT 'LEADERSHIP_DIST'
    CHECK (group_type IN ('LEADERSHIP_DIST', 'PM_TEAM', 'EXECUTIVE')),
  user_id text NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, group_type, user_id)
);
CREATE INDEX IF NOT EXISTS idx_png_project ON public.project_notification_groups(project_id);
-- ============================================================================
-- 10. COMMITMENT CHANGE ORDERS V2 — Enhanced for PRP workflow
-- ============================================================================
-- Add parallel_mode column to existing contract_change_orders if not present
ALTER TABLE public.contract_change_orders
  ADD COLUMN IF NOT EXISTS parallel_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prime_change_order_id bigint,
  ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'SUBCONTRACT'
    CHECK (contract_type IN ('SUBCONTRACT', 'PURCHASE_ORDER'));
-- ============================================================================
-- 11. RLS POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.potential_change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pco_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pco_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_workflow_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_workflow_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notification_groups ENABLE ROW LEVEL SECURITY;
-- PCOs: authenticated users can read, insert, update
CREATE POLICY "pco_select" ON public.potential_change_orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pco_insert" ON public.potential_change_orders
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pco_update" ON public.potential_change_orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- PCO Versions: authenticated users can read and insert (no update/delete — snapshots are immutable)
CREATE POLICY "pco_versions_select" ON public.pco_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pco_versions_insert" ON public.pco_versions
  FOR INSERT TO authenticated WITH CHECK (true);
-- PCO Change Events junction: full CRUD for authenticated
CREATE POLICY "pco_ce_select" ON public.pco_change_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pco_ce_insert" ON public.pco_change_events
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pco_ce_delete" ON public.pco_change_events
  FOR DELETE TO authenticated USING (true);
-- Timeline Events: read all, insert only (append-only, no update/delete)
CREATE POLICY "timeline_select" ON public.timeline_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "timeline_insert" ON public.timeline_events
  FOR INSERT TO authenticated WITH CHECK (true);
-- Comments: read all, insert, update own
CREATE POLICY "cwc_select" ON public.change_workflow_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cwc_insert" ON public.change_workflow_comments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cwc_update" ON public.change_workflow_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid()::text)
  WITH CHECK (author_id = auth.uid()::text);
CREATE POLICY "cwc_delete" ON public.change_workflow_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid()::text);
-- Notifications: users see only their own
CREATE POLICY "cwn_select" ON public.change_workflow_notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid()::text);
CREATE POLICY "cwn_insert" ON public.change_workflow_notifications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cwn_update" ON public.change_workflow_notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()::text)
  WITH CHECK (recipient_id = auth.uid()::text);
-- Notification Groups: authenticated can read and manage
CREATE POLICY "png_select" ON public.project_notification_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "png_insert" ON public.project_notification_groups
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "png_delete" ON public.project_notification_groups
  FOR DELETE TO authenticated USING (true);
-- ============================================================================
-- 12. UPDATED_AT TRIGGER for potential_change_orders
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS set_pco_updated_at ON public.potential_change_orders;
CREATE TRIGGER set_pco_updated_at
  BEFORE UPDATE ON public.potential_change_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- ============================================================================
-- 13. AUTO-NUMBER FUNCTION for PCOs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_pco_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.potential_change_orders
  WHERE project_id = NEW.project_id;

  NEW.number := 'PCO-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS auto_pco_number ON public.potential_change_orders;
CREATE TRIGGER auto_pco_number
  BEFORE INSERT ON public.potential_change_orders
  FOR EACH ROW
  WHEN (NEW.number IS NULL OR NEW.number = '')
  EXECUTE FUNCTION public.generate_pco_number();
-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- NEW TABLES:
--   potential_change_orders    — PCO records (parent for pco_line_items)
--   pco_versions               — Immutable version snapshots
--   pco_change_events          — Junction: PCO ↔ Change Event
--   timeline_events            — Cross-entity append-only audit trail
--   change_workflow_comments   — Threaded comments with client visibility
--   change_workflow_notifications — In-app + email notification records
--   project_notification_groups — Per-project distribution lists
--
-- MODIFIED TABLES:
--   pco_line_items             — Added FK to potential_change_orders, line_type, category, subcontractor_id
--   change_events              — Added internal_subtype, originator_role, potential_change_order_id
--   contract_change_orders     — Added parallel_mode, prime_change_order_id, contract_type;
