-- ============================================================
-- Attachment tables for prime contract and commitment change orders
-- ============================================================
-- Follows the same pattern as change_event_attachments.
-- Files stored in Supabase Storage bucket: project-files
-- ============================================================

-- 1. Prime Contract Change Order Attachments
CREATE TABLE IF NOT EXISTS public.pcco_attachments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pcco_id         bigint NOT NULL
    REFERENCES public.prime_contract_change_orders (id) ON DELETE CASCADE,
  file_name       varchar NOT NULL,
  file_path       text NOT NULL,
  file_size       bigint NOT NULL,
  mime_type       varchar NOT NULL,
  uploaded_by     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pcco_attachments IS
  'File attachments for prime contract change orders. Files stored in project-files bucket.';
ALTER TABLE public.pcco_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcco_attachments_select ON public.pcco_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY pcco_attachments_insert ON public.pcco_attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY pcco_attachments_delete ON public.pcco_attachments
  FOR DELETE USING (auth.uid() IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pcco_attachments_pcco_id
  ON public.pcco_attachments (pcco_id, uploaded_at DESC);
-- 2. Commitment Change Order Attachments
CREATE TABLE IF NOT EXISTS public.cco_attachments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cco_id          uuid NOT NULL
    REFERENCES public.contract_change_orders (id) ON DELETE CASCADE,
  file_name       varchar NOT NULL,
  file_path       text NOT NULL,
  file_size       bigint NOT NULL,
  mime_type       varchar NOT NULL,
  uploaded_by     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.cco_attachments IS
  'File attachments for commitment change orders. Files stored in project-files bucket.';
ALTER TABLE public.cco_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY cco_attachments_select ON public.cco_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY cco_attachments_insert ON public.cco_attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY cco_attachments_delete ON public.cco_attachments
  FOR DELETE USING (auth.uid() IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cco_attachments_cco_id
  ON public.cco_attachments (cco_id, uploaded_at DESC);
