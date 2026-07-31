create or replace function public.evaluate_fmds_batch1_rules_scoped(
  requested_revision_id uuid,
  requested_inputs jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  evaluated_revision_id uuid;
  evaluation jsonb;
begin
  select id
  into evaluated_revision_id
  from public.fmds_corpus_revisions
  where id = requested_revision_id
    and document_code = 'FMDS0834'
    and status in ('staging', 'active');

  if evaluated_revision_id is null then
    raise exception 'Eligible FMDS revision % was not found', requested_revision_id;
  end if;

  evaluation := public.evaluate_fmds_batch1_rules(
    evaluated_revision_id,
    requested_inputs
  );

  return evaluation || jsonb_build_object(
    'revision_id',
    evaluated_revision_id
  );
end;
$$;

revoke all on function public.evaluate_fmds_batch1_rules_scoped(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.evaluate_fmds_batch1_rules_scoped(uuid, jsonb)
  to service_role;