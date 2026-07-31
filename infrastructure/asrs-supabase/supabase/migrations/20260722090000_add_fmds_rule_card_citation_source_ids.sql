-- Preserve immutable reviewed-source identity in every FMDS rule-card citation.
-- The evaluator rejects a verified result without this provenance, preventing
-- identifier-only evidence from becoming an authoritative requirement claim.

do $$
declare
  unresolved_count integer;
begin
  select count(*)
    into unresolved_count
  from public.fmds_rule_cards card
  cross join lateral jsonb_array_elements(card.citations) citation
  left join public.fmds_visual_review_queue source
    on source.revision_id = card.revision_id
   and source.source_type = citation ->> 'source_type'
   and source.identifier = citation ->> 'identifier'
  where source.source_id is null;

  if unresolved_count <> 0 then
    raise exception
      'FMDS rule-card citation provenance migration blocked: % citation(s) cannot resolve to a revision-scoped review source',
      unresolved_count;
  end if;
end;
$$;

update public.fmds_rule_cards card
set citations = (
  select jsonb_agg(
    citation.value || jsonb_build_object('source_id', source.source_id)
    order by citation.ordinality
  )
  from jsonb_array_elements(card.citations) with ordinality as citation(value, ordinality)
  join public.fmds_visual_review_queue source
    on source.revision_id = card.revision_id
   and source.source_type = citation.value ->> 'source_type'
   and source.identifier = citation.value ->> 'identifier'
)
where exists (
  select 1
  from jsonb_array_elements(card.citations) citation
  where not (citation ? 'source_id')
);

do $$
declare
  incomplete_count integer;
begin
  select count(*)
    into incomplete_count
  from public.fmds_rule_cards card
  cross join lateral jsonb_array_elements(card.citations) citation
  where not (citation ? 'source_id')
     or not (citation ? 'review_event_id')
     or citation ->> 'source_type' not in ('table', 'figure');

  if incomplete_count <> 0 then
    raise exception
      'FMDS rule-card citation provenance migration incomplete: % citation(s) lack source identity, review identity, or a supported source type',
      incomplete_count;
  end if;
end;
$$;
