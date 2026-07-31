-- Document type classification from OneDrive/SharePoint folder paths.
--
-- The SharePoint/OneDrive tree is organized by discipline folders
-- (e.g. "14 - PSR", "08 - Schedule", "05 - Proposal", "15 - Submittals",
-- "12 - Pay Apps"). Folder NUMBERS are inconsistent across projects, so we
-- classify by folder NAME. This function is the single source of truth for
-- mapping a (possibly URL-encoded) document path to a canonical document_type.
--
-- Canonical types: pay_app, submittal, rfi, change_order, psr, schedule,
-- drawing, permit, estimate, proposal, specification, safety, closeout,
-- photo, bid, subcontract, design, contract, other.
-- (WIP financials live inside PSR folders, so they classify as 'psr'.)

CREATE OR REPLACE FUNCTION public.classify_document_type(p_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH d AS (
    SELECT lower(
      replace(replace(replace(coalesce(p_path, ''), '%20', ' '), '%26', '&'), '%27', '''')
    ) AS l
  )
  SELECT CASE
    WHEN l ~ 'pay ?app|pay application'                                   THEN 'pay_app'
    WHEN l LIKE '%lien waiver%' OR l LIKE '%lien-waiver%'                 THEN 'closeout'
    WHEN l LIKE '%submittal%'                                            THEN 'submittal'
    WHEN l ~ '(^|[^a-z])rfi([^a-z]|$)' OR l LIKE '%request for information%' THEN 'rfi'
    WHEN l LIKE '%change order%' OR l LIKE '%change request%'
      OR l ~ '(^|[^a-z])pco' OR l LIKE '%co''s and tickets%'
      OR l LIKE '%cos and tickets%'                                       THEN 'change_order'
    WHEN l ~ '(^|[^a-z])psr'                                             THEN 'psr'
    WHEN l LIKE '%schedule%'                                            THEN 'schedule'
    WHEN l LIKE '%bid set%' OR l LIKE '%permit set%' OR l LIKE '%drawing%'
      OR l LIKE '%as-built%' OR l LIKE '%as built%'                       THEN 'drawing'
    WHEN l LIKE '%permit%' OR l LIKE '%(ahj)%'                            THEN 'permit'
    WHEN l LIKE '%estimat%'                                              THEN 'estimate'
    WHEN l LIKE '%proposal%'                                            THEN 'proposal'
    WHEN l LIKE '%specification%' OR l LIKE '%/specs%' OR l LIKE '% specs%' THEN 'specification'
    WHEN l LIKE '%safety%' OR l LIKE '%incident report%'                  THEN 'safety'
    WHEN l LIKE '%closeout%' OR l LIKE '%close out%' OR l LIKE '%warranty%'
      OR l LIKE '%o&m%' OR l LIKE '%record document%'                     THEN 'closeout'
    WHEN l LIKE '%photo%'                                               THEN 'photo'
    WHEN l LIKE '%bid (responses)%' OR l LIKE '%bid responses%'
      OR l LIKE '%bid response%'                                          THEN 'bid'
    WHEN l LIKE '%subcontract%'                                         THEN 'subcontract'
    WHEN l LIKE '%design%' OR l LIKE '%engineering%'                      THEN 'design'
    WHEN l LIKE '%owner%'                                               THEN 'contract'
    ELSE 'other'
  END
  FROM d
$$;

COMMENT ON FUNCTION public.classify_document_type(text) IS
  'Maps a OneDrive/SharePoint document path (URL-encoded ok) to a canonical document_type. Folder-name based; number-agnostic. Single source of truth for document categorization.';

-- ---------------------------------------------------------------------------
-- project_documents: add document_type, auto-classify on write, backfill.
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS document_type text;

COMMENT ON COLUMN public.project_documents.document_type IS
  'Canonical document category derived from the source folder path via classify_document_type(). Auto-maintained by trigger trg_project_documents_classify.';

CREATE OR REPLACE FUNCTION public.set_project_document_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Derive from the richest available path. Preserve an explicitly-set type on
  -- manual uploads that have no source path.
  IF NEW.source_web_url IS NOT NULL OR NEW.source_path IS NOT NULL THEN
    NEW.document_type := public.classify_document_type(
      coalesce(NEW.source_web_url, NEW.source_path)
    );
  ELSIF NEW.document_type IS NULL THEN
    NEW.document_type := 'other';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_documents_classify ON public.project_documents;
CREATE TRIGGER trg_project_documents_classify
  BEFORE INSERT OR UPDATE OF source_web_url, source_path ON public.project_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_document_type();

UPDATE public.project_documents
SET document_type = public.classify_document_type(coalesce(source_web_url, source_path))
WHERE document_type IS DISTINCT FROM
      public.classify_document_type(coalesce(source_web_url, source_path));

CREATE INDEX IF NOT EXISTS idx_project_documents_document_type
  ON public.project_documents (document_type);

-- ---------------------------------------------------------------------------
-- Register the canonical document types in document_type_taxonomy so the
-- document_metadata.document_type FK is satisfied. The taxonomy is the
-- registry; classify_document_type() emits exactly these keys.
-- ---------------------------------------------------------------------------
INSERT INTO public.document_type_taxonomy
  (type_key, display_name, category, applies_to, is_active, sort_order)
VALUES
  ('pay_app',       'Pay Application', 'financial', ARRAY['project','invoice'], true, 300),
  ('rfi',           'RFI',             'other',     ARRAY['project','rfi'],     true, 310),
  ('change_order',  'Change Order',    'financial', ARRAY['project','change_order'], true, 320),
  ('psr',           'PSR (Project Status Report)', 'financial', ARRAY['project'], true, 330),
  ('schedule',      'Schedule',        'other',     ARRAY['project'],           true, 340),
  ('drawing',       'Drawing',         'drawing',   ARRAY['project','drawing'], true, 350),
  ('estimate',      'Estimate',        'financial', ARRAY['project'],           true, 360),
  ('proposal',      'Proposal',        'contract',  ARRAY['project'],           true, 370),
  ('specification', 'Specification',   'other',     ARRAY['project'],           true, 380),
  ('safety',        'Safety',          'other',     ARRAY['project'],           true, 390),
  ('closeout',      'Closeout',        'closeout',  ARRAY['project'],           true, 400),
  ('photo',         'Photo',           'photo',     ARRAY['project'],           true, 410),
  ('bid',           'Bid',             'other',     ARRAY['project'],           true, 420),
  ('subcontract',   'Subcontract',     'contract',  ARRAY['project','commitment'], true, 430),
  ('design',        'Design',          'other',     ARRAY['project'],           true, 440),
  ('contract',      'Contract',        'contract',  ARRAY['project','prime_contract'], true, 450)
ON CONFLICT (type_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- document_metadata: backfill document_type for file-based (folder-pathed)
-- rows only. Communication rows (email/teams/meeting) keep document_type NULL.
-- ---------------------------------------------------------------------------
UPDATE public.document_metadata
SET document_type = public.classify_document_type(coalesce(source_path, source_web_url))
WHERE deleted_at IS NULL
  AND source_system IN ('onedrive', 'sharepoint', 'microsoft_graph')
  AND coalesce(source_path, source_web_url) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_metadata_document_type
  ON public.document_metadata (document_type)
  WHERE document_type IS NOT NULL;
