-- AI Database hardening for Alleato Brain authorization.
--
-- document_chunks and rag_document_metadata are server-only RAG stores. All
-- production callers use the service-role client and perform end-user scope
-- checks in the PM application. The AI Database previously inherited default
-- anon/authenticated DML grants with RLS disabled, which allowed direct access
-- to bypass those application checks.

BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.document_chunks, public.rag_document_metadata
  FROM anon, authenticated;

REVOKE EXECUTE
  ON FUNCTION public.search_document_chunks(
    halfvec,
    text[],
    bigint,
    integer,
    double precision,
    text,
    text,
    boolean,
    text,
    text
  )
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.document_chunks, public.rag_document_metadata
  TO service_role;

GRANT EXECUTE
  ON FUNCTION public.search_document_chunks(
    halfvec,
    text[],
    bigint,
    integer,
    double precision,
    text,
    text,
    boolean,
    text,
    text
  )
  TO service_role;

COMMIT;
