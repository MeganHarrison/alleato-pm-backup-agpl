-- Rebind every rule-card citation to its current revision-scoped, approved visual source.
-- This repairs stale source/review IDs instead of trusting identifier-only historical payloads.

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
   and source.review_status = 'reviewed'
   and source.latest_decision = 'approved'
   and source.page_number is not null
   and source.page_number > 0
  where source.source_id is null;

  if unresolved_count <> 0 then
    raise exception
      'FMDS evaluator provenance hardening blocked: % citation(s) cannot resolve to an approved, paginated revision-scoped source',
      unresolved_count;
  end if;
end;
$$;

update public.fmds_rule_cards card
set citations = (
  select jsonb_agg(
    citation.value || jsonb_build_object(
      'source_id', source.source_id,
      'review_event_id', review_event.id,
      'page_number', source.page_number
    )
    order by citation.ordinality
  )
  from jsonb_array_elements(card.citations) with ordinality as citation(value, ordinality)
  join public.fmds_visual_review_queue source
    on source.revision_id = card.revision_id
   and source.source_type = citation.value ->> 'source_type'
   and source.identifier = citation.value ->> 'identifier'
   and source.review_status = 'reviewed'
   and source.latest_decision = 'approved'
  join public.fmds_visual_review_events review_event
    on review_event.revision_id = source.revision_id
   and review_event.source_type = source.source_type
   and review_event.source_id = source.source_id
   and review_event.created_at = source.latest_reviewed_at
   and review_event.decision = 'approved'
);

do $$
declare
  invalid_count integer;
  definition text;
  expected_fragment text := $expected$
            'status', 'escalated',
            'rule_key', minimum_width_card.rule_key,
            'nominal_horizontal_distance_ft', nominal_distance_ft,
            'in_rack_sprinklers_required', true,
            'check_vertical_barriers', true,
            'citations', minimum_width_card.citations
$expected$;
  replacement_fragment text := $replacement$
            'status', 'escalated',
            'rule_key', escalation_card.rule_key,
            'nominal_horizontal_distance_ft', nominal_distance_ft,
            'in_rack_sprinklers_required', true,
            'check_vertical_barriers', true,
            'citations', escalation_card.citations
$replacement$;
begin
  select count(*)
    into invalid_count
  from public.fmds_rule_cards card
  cross join lateral jsonb_array_elements(card.citations) citation
  left join public.fmds_visual_review_queue source
    on source.source_id = (citation ->> 'source_id')::uuid
   and source.revision_id = card.revision_id
   and source.source_type = citation ->> 'source_type'
   and source.identifier = citation ->> 'identifier'
   and source.review_status = 'reviewed'
   and source.latest_decision = 'approved'
   and source.page_number = (citation ->> 'page_number')::integer
  left join public.fmds_visual_review_events review_event
    on review_event.id = (citation ->> 'review_event_id')::uuid
   and review_event.revision_id = source.revision_id
   and review_event.source_type = source.source_type
   and review_event.source_id = source.source_id
   and review_event.decision = 'approved'
  where source.source_id is null or review_event.id is null;

  if invalid_count <> 0 then
    raise exception
      'FMDS evaluator provenance hardening incomplete: % citation(s) do not match an approved source and review event',
      invalid_count;
  end if;

  select pg_get_functiondef('public.evaluate_fmds_batch1_rules(uuid, jsonb)'::regprocedure)
    into definition;

  if (length(definition) - length(replace(definition, expected_fragment, '')))
      / length(expected_fragment) <> 1 then
    raise exception
      'FMDS evaluator escalation hardening blocked: expected exactly one minimum-width escalation branch';
  end if;

  execute replace(definition, expected_fragment, replacement_fragment);
end;
$$;

do $$
declare
  revision record;
  evaluated jsonb;
begin
  for revision in
    select id
    from public.fmds_corpus_revisions
    where document_code = 'FMDS0834'
      and status in ('staging', 'active')
  loop
    evaluated := public.evaluate_fmds_batch1_rules(
      revision.id,
      '{"transverse_flue":{"nominal_horizontal_distance_ft":11}}'::jsonb
    );

    if evaluated #>> '{minimum_width,status}' <> 'escalated'
       or evaluated #>> '{minimum_width,rule_key}' <> 'batch1.tfs.noncompliance_escalation' then
      raise exception
        'FMDS evaluator escalation hardening failed for revision %',
        revision.id;
    end if;
  end loop;
end;
$$;
