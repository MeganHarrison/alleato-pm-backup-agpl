-- Auto-classify document_metadata file rows on write, mirroring the
-- project_documents trigger. Only acts on folder-backed source systems
-- (onedrive/sharepoint/microsoft_graph); communication rows (email, teams,
-- meeting, fireflies) are left untouched so their existing type/category and
-- NULL document_type are preserved.

CREATE OR REPLACE FUNCTION public.set_document_metadata_document_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_system IN ('onedrive', 'sharepoint', 'microsoft_graph')
     AND coalesce(NEW.source_path, NEW.source_web_url) IS NOT NULL THEN
    NEW.document_type := public.classify_document_type(
      coalesce(NEW.source_path, NEW.source_web_url)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_metadata_classify ON public.document_metadata;
CREATE TRIGGER trg_document_metadata_classify
  BEFORE INSERT OR UPDATE OF source_path, source_web_url, source_system
  ON public.document_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.set_document_metadata_document_type();
