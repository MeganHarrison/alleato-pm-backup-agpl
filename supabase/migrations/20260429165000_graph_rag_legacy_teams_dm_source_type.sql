-- Normalize legacy Microsoft Graph Teams DM document types.
--
-- Older Teams direct-message documents used type='teams_dm'. Newer documents use
-- type='teams_dm_conversation'. Both represent low-density direct-message
-- conversations and must be weighted separately from channel threads.

set statement_timeout = 0;
set lock_timeout = '5min';
create or replace function public.graph_document_chunk_source_type(
  doc_category text,
  doc_type text
)
returns text
language sql
immutable
as $$
  select case
    when doc_category = 'teams_message'
      and doc_type in ('teams_dm_conversation', 'teams_dm') then 'teams_dm'
    when doc_category = 'teams_message' and doc_type = 'teams_message' then 'teams_channel'
    when doc_category = 'teams_message' then 'teams_message'
    when doc_category = 'email' then 'email'
    when doc_category = 'document' then 'onedrive_document'
    else 'microsoft_graph'
  end
$$;
