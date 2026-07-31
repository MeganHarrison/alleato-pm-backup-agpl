begin;

create or replace function public.crm_create_activity_candidate(
  p_source_system text,
  p_source_external_key text,
  p_content_hash text,
  p_source_document_id text,
  p_proposed_company_id uuid,
  p_match_signals jsonb,
  p_match_confidence numeric
)
returns table(candidate_id uuid, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate_id uuid;
  v_created boolean := false;
begin
  insert into public.crm_activity_candidates (
    canonical_communication_key,
    source_system,
    source_external_key,
    content_hash,
    source_document_id,
    proposed_company_id,
    proposed_contacts,
    match_signals,
    match_confidence,
    matching_rule_version,
    visibility_scope,
    status
  )
  values (
    gen_random_uuid(),
    p_source_system,
    p_source_external_key,
    p_content_hash,
    p_source_document_id,
    p_proposed_company_id,
    '[]'::jsonb,
    p_match_signals,
    p_match_confidence,
    'crm-deterministic-v1',
    'standard',
    'pending'
  )
  on conflict (source_system, source_external_key, content_hash) do nothing
  returning id into v_candidate_id;

  if v_candidate_id is not null then
    v_created := true;
  else
    select id
    into v_candidate_id
    from public.crm_activity_candidates
    where source_system = p_source_system
      and source_external_key = p_source_external_key
      and content_hash = p_content_hash;
  end if;

  update public.crm_activity_candidates
  set status = 'superseded',
      superseded_by_candidate_id = v_candidate_id
  where source_system = p_source_system
    and source_external_key = p_source_external_key
    and status = 'pending'
    and id <> v_candidate_id;

  return query select v_candidate_id, v_created;
end;
$$;

revoke all on function public.crm_create_activity_candidate(
  text, text, text, text, uuid, jsonb, numeric
) from public, anon, authenticated;
grant execute on function public.crm_create_activity_candidate(
  text, text, text, text, uuid, jsonb, numeric
) to service_role;

commit;
