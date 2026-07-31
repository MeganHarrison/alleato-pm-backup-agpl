-- Keep the server-only RAG search RPC out of the public PostgREST surface.
--
-- Revoking named roles is insufficient while PostgreSQL's PUBLIC pseudo-role
-- retains EXECUTE, because anon and authenticated inherit that privilege.

BEGIN;

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
  FROM PUBLIC, anon, authenticated;

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
