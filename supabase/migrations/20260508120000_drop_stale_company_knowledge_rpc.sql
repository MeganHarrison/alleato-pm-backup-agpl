-- Drop stale company_knowledge search RPCs.
--
-- public.company_knowledge was retired in favor of document_metadata and
-- document_chunks, but the halfvec search_knowledge_base overload survived.
-- Leaving the RPC in the schema cache lets app code call a function that
-- references a dropped table.

drop function if exists public.search_knowledge_base(vector, integer, double precision);
drop function if exists public.search_knowledge_base(vector, integer, real);
drop function if exists public.search_knowledge_base(vector, integer, float);
drop function if exists public.search_knowledge_base(text, integer, double precision);
drop function if exists public.search_knowledge_base(text, integer, real);
drop function if exists public.search_knowledge_base(text, integer, float);
drop function if exists public.search_knowledge_base(vector(1536), integer, double precision);
drop function if exists public.search_knowledge_base(vector(1536), integer, real);
drop function if exists public.search_knowledge_base(vector(1536), integer, float);
drop function if exists public.search_knowledge_base(vector(3072), integer, double precision);
drop function if exists public.search_knowledge_base(vector(3072), integer, real);
drop function if exists public.search_knowledge_base(vector(3072), integer, float);
drop function if exists public.search_knowledge_base(vector, integer, double precision, text, integer);
drop function if exists public.search_knowledge_base(vector, integer, real, text, integer);
drop function if exists public.search_knowledge_base(vector, integer, float, text, integer);
drop function if exists public.search_knowledge_base(vector(1536), integer, double precision, text, integer);
drop function if exists public.search_knowledge_base(vector(1536), integer, real, text, integer);
drop function if exists public.search_knowledge_base(vector(1536), integer, float, text, integer);
drop function if exists public.search_knowledge_base(vector(3072), integer, double precision, text, integer);
drop function if exists public.search_knowledge_base(vector(3072), integer, real, text, integer);
drop function if exists public.search_knowledge_base(vector(3072), integer, float, text, integer);
drop function if exists public.search_knowledge_base(halfvec, integer, double precision, text, integer);
drop function if exists public.search_knowledge_base(halfvec, integer, real, text, integer);
drop function if exists public.search_knowledge_base(halfvec, integer, float, text, integer);
drop function if exists public.search_knowledge_base(halfvec(3072), integer, double precision, text, integer);
drop function if exists public.search_knowledge_base(halfvec(3072), integer, real, text, integer);
drop function if exists public.search_knowledge_base(halfvec(3072), integer, float, text, integer);
