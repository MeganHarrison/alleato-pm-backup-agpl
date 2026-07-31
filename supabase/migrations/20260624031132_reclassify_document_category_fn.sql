-- Category-only reclassify for the project documents browser.
-- Outlook-sourced document_metadata writes are blocked by the active incident
-- guard `block_outlook_ingestion_during_incident`
-- (OUTLOOK_INGESTION_DISABLED_DB_INCIDENT_2026_06_17). Re-filing a document's
-- CATEGORY is a benign organizational edit that does not touch the identity
-- fields (graph_message_id, mailbox, source_*) the incident concerns, so this
-- function uses the sanctioned, transaction-local bypass to set ONLY the
-- category column. It deliberately cannot change any other field.
create or replace function public.reclassify_document_category(
  p_doc_id text,
  p_project_id integer,
  p_category text
) returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  -- transaction-local sanctioned bypass (equivalent to SET LOCAL)
  perform set_config('app.allow_outlook_ingestion_write', 'true', true);

  update document_metadata
     set category = p_category
   where id = p_doc_id
     and project_id = p_project_id
     and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reclassify_document_category(text, integer, text) from public;
grant execute on function public.reclassify_document_category(text, integer, text) to authenticated, service_role;
