-- GUARDRAIL: Block summary_embedding writes to PM APP permanently.
--
-- summary_embedding (halfvec 3072) belongs exclusively in the AI Database
-- (fqcvmfqldlewvbsuxdvz), accessed via get_rag_write_client() in
-- backend/src/services/supabase_helpers.py.
--
-- Historical data (4,653 rows) was cleared via batched UPDATE after index drop.
-- This trigger ensures the column can never be accidentally populated again.
-- If this trigger fires in production it means a code path is bypassing
-- SupabaseRagStore — fix the caller, do not remove this trigger.

CREATE OR REPLACE FUNCTION public.block_summary_embedding_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.summary_embedding IS NOT NULL THEN
    RAISE EXCEPTION
      'WRONG DATABASE: summary_embedding must be written to the AI Database '
      '(fqcvmfqldlewvbsuxdvz), not PM APP. Use get_rag_write_client() in '
      'backend/src/services/supabase_helpers.py. Silently clearing to avoid data loss.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_summary_embedding_write ON public.document_metadata;
CREATE TRIGGER block_summary_embedding_write
  BEFORE INSERT OR UPDATE ON public.document_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.block_summary_embedding_write();

COMMENT ON FUNCTION public.block_summary_embedding_write IS
  'Prevents summary_embedding writes to PM APP. This column and its data live '
  'exclusively in the AI Database (fqcvmfqldlewvbsuxdvz). Added 2026-05-17 after '
  'a halfvec HNSW index on this column caused an OOM crash loop on startup.';
