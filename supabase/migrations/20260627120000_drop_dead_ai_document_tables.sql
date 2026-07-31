-- Drop dead AI/document scaffolding tables with no active code references.
--
-- AAI-737 proof:
-- - generated DB inventory marks these dead/dormant with no runtime refs;
-- - live row counts are zero except chats/messages/search_documents scratch data;
-- - no inbound foreign keys reference these tables.

drop table if exists public.messages;
drop table if exists public.chats;
drop table if exists public.search_documents;
drop table if exists public.ai_analysis_jobs;
drop table if exists public.ai_models;
drop table if exists public.document_executive_summaries;
drop table if exists public.documents_rfis_links;
drop table if exists public.documents_submittals_links;
