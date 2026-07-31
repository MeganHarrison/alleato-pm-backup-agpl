do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fmds_rule_cards'::regclass
      and conname = 'fmds_rule_cards_structured_json_check'
  ) then
    alter table public.fmds_rule_cards
      add constraint fmds_rule_cards_structured_json_check check (
        jsonb_typeof(conditions) = 'object'
        and jsonb_typeof(outputs) = 'object'
        and jsonb_typeof(citations) = 'array'
        and jsonb_array_length(citations) > 0
        and cardinality(source_page_numbers) > 0
        and cardinality(source_clause_references) > 0
      );
  end if;
end;
$$;

do $$
declare
  target_revision_id uuid;
  approved_source_count integer;
  hose_table jsonb;
  gross_width_figure jsonb;
  net_width_figure jsonb;
  obstruction_open_figure jsonb;
  obstruction_angle_figure jsonb;
  minimum_width_figure jsonb;
  minimum_width_table jsonb;
  alignment_figure jsonb;
  vertical_barrier_figure jsonb;
begin
  select id
  into target_revision_id
  from public.fmds_corpus_revisions
  where document_code = 'FMDS0834'
    and revision_label = '2026-04'
    and source_sha256 = 'c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed'
    and status = 'staging';

  if target_revision_id is null then
    raise exception 'FMDS0834 2026-04 staging revision with the verified source hash was not found';
  end if;

  select count(*)
  into approved_source_count
  from public.fmds_visual_review_queue q
  where q.revision_id = target_revision_id
    and q.latest_decision = 'approved'
    and q.review_status = 'reviewed'
    and (
      (q.source_type = 'table' and q.identifier in ('2.1.4.5.4', '2.2.1.4.2.1'))
      or
      (q.source_type = 'figure' and q.identifier in (
        '2.2.1.4.1.1',
        '2.2.1.4.1.2',
        '2.2.1.4.1.3(a)',
        '2.2.1.4.1.3(b)',
        '2.2.1.4.2.1',
        '2.2.1.4.2.2',
        '2.2.1.5.1'
      ))
    );

  if approved_source_count <> 9 then
    raise exception 'FMDS Batch 1 source review incomplete: expected 9 approved objects, found %', approved_source_count;
  end if;

  select jsonb_build_object(
    'source_type', q.source_type,
    'identifier', q.identifier,
    'page_number', q.page_number,
    'citation_label', 'FMDS 8-34 Table 2.1.4.5.4, PDF page 12',
    'evidence_path', q.evidence_image_path,
    'review_event_id', e.id,
    'reviewer_id', e.reviewer_id,
    'reviewed_at', e.created_at
  )
  into hose_table
  from public.fmds_visual_review_queue q
  join public.fmds_visual_review_events e
    on e.source_type = q.source_type
   and e.source_id = q.source_id
   and e.created_at = q.latest_reviewed_at
  where q.revision_id = target_revision_id
    and q.source_type = 'table'
    and q.identifier = '2.1.4.5.4';

  select jsonb_build_object(
    'source_type', q.source_type,
    'identifier', q.identifier,
    'page_number', q.page_number,
    'citation_label', 'FMDS 8-34 Section 2.2.1.4.1.1 and Figure 2.2.1.4.1.1, PDF page 17',
    'evidence_path', q.evidence_image_path,
    'review_event_id', e.id,
    'reviewer_id', e.reviewer_id,
    'reviewed_at', e.created_at
  )
  into gross_width_figure
  from public.fmds_visual_review_queue q
  join public.fmds_visual_review_events e
    on e.source_type = q.source_type
   and e.source_id = q.source_id
   and e.created_at = q.latest_reviewed_at
  where q.revision_id = target_revision_id
    and q.source_type = 'figure'
    and q.identifier = '2.2.1.4.1.1';

  select jsonb_build_object(
    'source_type', q.source_type,
    'identifier', q.identifier,
    'page_number', q.page_number,
    'citation_label', 'FMDS 8-34 Section 2.2.1.4.1.2 and Figure 2.2.1.4.1.2, PDF page 18',
    'evidence_path', q.evidence_image_path,
    'review_event_id', e.id,
    'reviewer_id', e.reviewer_id,
    'reviewed_at', e.created_at
  )
  into net_width_figure
  from public.fmds_visual_review_queue q
  join public.fmds_visual_review_events e
    on e.source_type = q.source_type
   and e.source_id = q.source_id
   and e.created_at = q.latest_reviewed_at
  where q.revision_id = target_revision_id
    and q.source_type = 'figure'
    and q.identifier = '2.2.1.4.1.2';

  select jsonb_build_object(
    'source_type', q.source_type,
    'identifier', q.identifier,
    'page_number', q.page_number,
    'citation_label', 'FMDS 8-34 Section 2.2.1.4.1.3(1) and Figure 2.2.1.4.1.3(a), PDF pages 18-19',
    'evidence_path', q.evidence_image_path,
    'review_event_id', e.id,
    'reviewer_id', e.reviewer_id,
    'reviewed_at', e.created_at
  )
  into obstruction_open_figure
  from public.fmds_visual_review_queue q
  join public.fmds_visual_review_events e
    on e.source_type = q.source_type
   and e.source_id = q.source_id
   and e.created_at = q.latest_reviewed_at
  where q.revision_id = target_revision_id
    and q.source_type = 'figure'
    and q.identifier = '2.2.1.4.1.3(a)';

  select jsonb_build_object(
    'source_type', q.source_type,
    'identifier', q.identifier,
    'page_number', q.page_number,
    'citation_label', 'FMDS 8-34 Section 2.2.1.4.1.3(2) and Figure 2.2.1.4.1.3(b), PDF pages 18-19',
    'evidence_path', q.evidence_image_path,
    'review_event_id', e.id,
    'reviewer_id', e.reviewer_id,
    'reviewed_at', e.created_at
  )
  into obstruction_angle_figure
  from public.fmds_visual_review_queue q
  join public.fmds_visual_review_events e
    on e.source_type = q.source_type
   and e.source_id = q.source_id
   and e.created_at = q.latest_reviewed_at
  where q.revision_id = target_revision_id
    and q.source_type = 'figure'
    and q.identifier = '2.2.1.4.1.3(b)';

  select jsonb_build_object(
    'source_type', q.source_type,
    'identifier', q.identifier,
    'page_number', q.page_number,
    'citation_label', 'FMDS 8-34 Section 2.2.1.4.2.1 and Figure 2.2.1.4.2.1, PDF page 20',
    'evidence_path', q.evidence_image_path,
    'review_event_id', e.id,
    'reviewer_id', e.reviewer_id,
    'reviewed_at', e.created_at
  )
  into minimum_width_figure
  from public.fmds_visual_review_queue q
  join public.fmds_visual_review_events e
    on e.source_type = q.source_type
   and e.source_id = q.source_id
   and e.created_at = q.latest_reviewed_at
  where q.revision_id = target_revision_id
    and q.source_type = 'figure'
    and q.identifier = '2.2.1.4.2.1';

  select jsonb_build_object(
    'source_type', q.source_type,
    'identifier', q.identifier,
    'page_number', q.page_number,
    'citation_label', 'FMDS 8-34 Table 2.2.1.4.2.1, PDF page 20',
    'evidence_path', q.evidence_image_path,
    'review_event_id', e.id,
    'reviewer_id', e.reviewer_id,
    'reviewed_at', e.created_at
  )
  into minimum_width_table
  from public.fmds_visual_review_queue q
  join public.fmds_visual_review_events e
    on e.source_type = q.source_type
   and e.source_id = q.source_id
   and e.created_at = q.latest_reviewed_at
  where q.revision_id = target_revision_id
    and q.source_type = 'table'
    and q.identifier = '2.2.1.4.2.1';

  select jsonb_build_object(
    'source_type', q.source_type,
    'identifier', q.identifier,
    'page_number', q.page_number,
    'citation_label', 'FMDS 8-34 Section 2.2.1.4.2.2 and Figure 2.2.1.4.2.2, PDF pages 20-21',
    'evidence_path', q.evidence_image_path,
    'review_event_id', e.id,
    'reviewer_id', e.reviewer_id,
    'reviewed_at', e.created_at
  )
  into alignment_figure
  from public.fmds_visual_review_queue q
  join public.fmds_visual_review_events e
    on e.source_type = q.source_type
   and e.source_id = q.source_id
   and e.created_at = q.latest_reviewed_at
  where q.revision_id = target_revision_id
    and q.source_type = 'figure'
    and q.identifier = '2.2.1.4.2.2';

  select jsonb_build_object(
    'source_type', q.source_type,
    'identifier', q.identifier,
    'page_number', q.page_number,
    'citation_label', 'FMDS 8-34 Section 2.2.1.5.1 and Figure 2.2.1.5.1, PDF page 21',
    'evidence_path', q.evidence_image_path,
    'review_event_id', e.id,
    'reviewer_id', e.reviewer_id,
    'reviewed_at', e.created_at
  )
  into vertical_barrier_figure
  from public.fmds_visual_review_queue q
  join public.fmds_visual_review_events e
    on e.source_type = q.source_type
   and e.source_id = q.source_id
   and e.created_at = q.latest_reviewed_at
  where q.revision_id = target_revision_id
    and q.source_type = 'figure'
    and q.identifier = '2.2.1.5.1';

  insert into public.fmds_rule_cards (
    revision_id,
    rule_key,
    title,
    source_page_numbers,
    source_clause_references,
    conditions,
    outputs,
    citations,
    derivation_method,
    review_status
  ) values
  (
    target_revision_id,
    'batch1.hose_demand_duration',
    'Hose demand and water-supply duration by ceiling sprinkler type and design count',
    array[12],
    array['2.1.4.5.4', 'Table 2.1.4.5.4'],
    jsonb_build_object(
      'kind', 'lookup',
      'required_inputs', jsonb_build_array(
        jsonb_build_object('field', 'ceiling_sprinkler_type', 'type', 'enum', 'values', jsonb_build_array('standard_coverage', 'extended_coverage')),
        jsonb_build_object('field', 'design_sprinkler_count', 'type', 'integer', 'minimum', 1, 'unit', 'sprinklers')
      )
    ),
    jsonb_build_object(
      'kind', 'lookup_rows',
      'rows', jsonb_build_array(
        jsonb_build_object('ceiling_sprinkler_type', 'standard_coverage', 'count_min', 1, 'count_max', 12, 'hose_demand_gpm', 250, 'hose_demand_lpm', 950, 'water_supply_duration_min', 60),
        jsonb_build_object('ceiling_sprinkler_type', 'standard_coverage', 'count_min', 13, 'count_max', 19, 'hose_demand_gpm', 500, 'hose_demand_lpm', 1900, 'water_supply_duration_min', 90),
        jsonb_build_object('ceiling_sprinkler_type', 'standard_coverage', 'count_min', 20, 'count_max', null, 'hose_demand_gpm', 500, 'hose_demand_lpm', 1900, 'water_supply_duration_min', 120),
        jsonb_build_object('ceiling_sprinkler_type', 'extended_coverage', 'count_min', 1, 'count_max', 6, 'hose_demand_gpm', 250, 'hose_demand_lpm', 950, 'water_supply_duration_min', 60),
        jsonb_build_object('ceiling_sprinkler_type', 'extended_coverage', 'count_min', 7, 'count_max', 9, 'hose_demand_gpm', 500, 'hose_demand_lpm', 1900, 'water_supply_duration_min', 90),
        jsonb_build_object('ceiling_sprinkler_type', 'extended_coverage', 'count_min', 10, 'count_max', null, 'hose_demand_gpm', 500, 'hose_demand_lpm', 1900, 'water_supply_duration_min', 120)
      )
    ),
    jsonb_build_array(hose_table),
    'deterministic_from_approved_source_v1',
    'reviewed'
  ),
  (
    target_revision_id,
    'batch1.tfs.gross_width_measurement',
    'Gross transverse flue-space width measurement',
    array[17],
    array['2.2.1.4.1.1', 'Figure 2.2.1.4.1.1'],
    jsonb_build_object(
      'kind', 'measurement_definition',
      'required_inputs', jsonb_build_array('left_container_or_tray_edge', 'right_container_or_tray_edge'),
      'direction', 'horizontal'
    ),
    jsonb_build_object(
      'field', 'gross_transverse_flue_space_width',
      'expression', 'horizontal_distance_between_containers_or_trays',
      'supported_units', jsonb_build_array('in', 'mm')
    ),
    jsonb_build_array(gross_width_figure),
    'deterministic_from_approved_source_v1',
    'reviewed'
  ),
  (
    target_revision_id,
    'batch1.tfs.net_width_sum',
    'Net transverse flue-space width is the sum of open widths',
    array[18],
    array['2.2.1.4.1.2', 'Figure 2.2.1.4.1.2'],
    jsonb_build_object(
      'kind', 'sum',
      'required_inputs', jsonb_build_array(jsonb_build_object('field', 'open_widths_in', 'type', 'number_array', 'minimum_item', 0, 'unit', 'in'))
    ),
    jsonb_build_object('field', 'net_transverse_flue_space_width_in', 'expression', 'sum(open_widths_in)', 'unit', 'in'),
    jsonb_build_array(net_width_figure),
    'deterministic_from_approved_source_v1',
    'reviewed'
  ),
  (
    target_revision_id,
    'batch1.tfs.obstruction_ignore',
    'Objects that may be ignored when determining net transverse flue-space width',
    array[18, 19],
    array['2.2.1.4.1.3', 'Figure 2.2.1.4.1.3(a)', 'Figure 2.2.1.4.1.3(b)'],
    jsonb_build_object(
      'kind', 'any',
      'criteria', jsonb_build_array(
        jsonb_build_object('field', 'horizontal_uniformly_open_percent', 'operator', 'gte', 'value', 70, 'unit', 'percent'),
        jsonb_build_object('all', jsonb_build_array(
          jsonb_build_object('field', 'object_width_in', 'operator', 'lte', 'value', 4, 'unit', 'in'),
          jsonb_build_object('field', 'object_angle_degrees', 'operator', 'gte', 'value', 30, 'unit', 'degrees')
        ))
      )
    ),
    jsonb_build_object('field', 'ignore_object_in_net_width_calculation', 'true_when', 'any_criterion_matches'),
    jsonb_build_array(obstruction_open_figure, obstruction_angle_figure),
    'deterministic_from_approved_source_v1',
    'reviewed'
  ),
  (
    target_revision_id,
    'batch1.tfs.qualifying_width_and_distance',
    'Qualifying transverse flue-space width and nominal horizontal-distance measurement',
    array[20],
    array['2.2.1.4.2.1', 'Figure 2.2.1.4.2.1'],
    jsonb_build_object(
      'kind', 'all',
      'criteria', jsonb_build_array(
        jsonb_build_object('field', 'net_width_in', 'operator', 'gte', 'value', 1.5, 'unit', 'in'),
        jsonb_build_object('field', 'distance_measurement', 'operator', 'between_qualifying_transverse_flue_spaces')
      )
    ),
    jsonb_build_object(
      'qualifying_net_width_in', 1.5,
      'qualifying_operator', 'gte',
      'distance_field', 'nominal_horizontal_distance_ft',
      'distance_measurement', 'horizontal_distance_between_qualifying_transverse_flue_spaces'
    ),
    jsonb_build_array(minimum_width_figure),
    'deterministic_from_approved_source_v1',
    'reviewed'
  ),
  (
    target_revision_id,
    'batch1.tfs.minimum_width_lookup',
    'Recommended minimum net transverse flue-space width or sprinkler escalation',
    array[20],
    array['2.2.1.4.2.1', 'Table 2.2.1.4.2.1'],
    jsonb_build_object(
      'kind', 'lookup',
      'required_inputs', jsonb_build_array(jsonb_build_object('field', 'nominal_horizontal_distance_ft', 'type', 'number', 'minimum', 0, 'unit', 'ft')),
      'unsupported_between_rows', true
    ),
    jsonb_build_object(
      'kind', 'lookup_rows',
      'rows', jsonb_build_array(
        jsonb_build_object('operator', 'eq', 'distance_ft', 2, 'distance_m', 0.6, 'recommended_min_net_width_in', 1.5, 'recommended_min_net_width_mm', 38),
        jsonb_build_object('operator', 'eq', 'distance_ft', 2.5, 'distance_m', 0.75, 'recommended_min_net_width_in', 2, 'recommended_min_net_width_mm', 50),
        jsonb_build_object('operator', 'eq', 'distance_ft', 5, 'distance_m', 1.5, 'recommended_min_net_width_in', 3, 'recommended_min_net_width_mm', 75),
        jsonb_build_object('operator', 'eq', 'distance_ft', 10, 'distance_m', 3, 'recommended_min_net_width_in', 6, 'recommended_min_net_width_mm', 150),
        jsonb_build_object('operator', 'gt', 'distance_ft', 10, 'distance_m', 3, 'in_rack_sprinklers_required', true, 'check_vertical_barriers', true, 'vertical_barrier_clause', '2.2.1.5')
      )
    ),
    jsonb_build_array(minimum_width_table, minimum_width_figure),
    'deterministic_from_approved_source_v1',
    'reviewed'
  ),
  (
    target_revision_id,
    'batch1.tfs.adequacy',
    'Transverse flue-space adequacy',
    array[20, 21],
    array['2.2.1.4.2.2', 'Figure 2.2.1.4.2.2'],
    jsonb_build_object(
      'kind', 'all',
      'criteria', jsonb_build_array(
        jsonb_build_object('field', 'actual_net_width_in', 'operator', 'gte', 'value_from_rule', 'batch1.tfs.minimum_width_lookup'),
        jsonb_build_object('field', 'vertically_aligned', 'operator', 'eq', 'value', true),
        jsonb_build_object('field', 'unobstructed_full_height', 'operator', 'eq', 'value', true)
      )
    ),
    jsonb_build_object('field', 'transverse_flue_spaces_adequate', 'true_when', 'all_criteria_match'),
    jsonb_build_array(minimum_width_table, alignment_figure),
    'deterministic_from_approved_source_v1',
    'reviewed'
  ),
  (
    target_revision_id,
    'batch1.tfs.noncompliance_escalation',
    'Escalation when transverse flue spaces are not compliant',
    array[20],
    array['2.2.1.4.2.3'],
    jsonb_build_object(
      'kind', 'any',
      'criteria', jsonb_build_array(
        jsonb_build_object('field', 'meets_minimum_width', 'operator', 'eq', 'value', false),
        jsonb_build_object('field', 'vertically_aligned', 'operator', 'eq', 'value', false),
        jsonb_build_object('field', 'unobstructed_full_height', 'operator', 'eq', 'value', false)
      )
    ),
    jsonb_build_object('in_rack_sprinklers_required', true, 'maximum_vertical_distance_between_in_rack_sprinklers_ft', 10, 'maximum_vertical_distance_between_in_rack_sprinklers_m', 3),
    jsonb_build_array(minimum_width_table, alignment_figure),
    'deterministic_from_approved_source_v1',
    'reviewed'
  ),
  (
    target_revision_id,
    'batch1.vertical_barrier.trigger',
    'Vertical-barrier trigger and maximum spacing',
    array[21],
    array['2.2.1.5.1', 'Figure 2.2.1.5.1'],
    jsonb_build_object(
      'kind', 'all',
      'criteria', jsonb_build_array(
        jsonb_build_object('field', 'gross_width_between_uprights_in', 'operator', 'gte', 'value', 1.5, 'unit', 'in'),
        jsonb_build_object('field', 'net_width_between_uprights_in', 'operator', 'lte', 'value', 0.5, 'unit', 'in'),
        jsonb_build_object('field', 'affected_flue_horizontal_distance_ft', 'operator', 'gt', 'value', 10, 'unit', 'ft')
      )
    ),
    jsonb_build_object(
      'vertical_barriers_recommended', true,
      'location', 'rack_uprights',
      'maximum_spacing_ft', 12,
      'maximum_spacing_m', 3.7
    ),
    jsonb_build_array(vertical_barrier_figure),
    'deterministic_from_approved_source_v1',
    'reviewed'
  )
  on conflict (revision_id, rule_key) do update
  set title = excluded.title,
      source_page_numbers = excluded.source_page_numbers,
      source_clause_references = excluded.source_clause_references,
      conditions = excluded.conditions,
      outputs = excluded.outputs,
      citations = excluded.citations,
      derivation_method = excluded.derivation_method,
      review_status = excluded.review_status;
end;
$$;

create or replace function public.evaluate_fmds_batch1_rules(
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
  target_revision record;
  expected_rule_count constant integer := 9;
  reviewed_rule_count integer;
  supported_rule_keys jsonb;
  result jsonb;
  hose_request jsonb;
  hose_card public.fmds_rule_cards%rowtype;
  hose_type text;
  hose_count integer;
  hose_row jsonb;
  tfs_request jsonb;
  net_width_card public.fmds_rule_cards%rowtype;
  obstruction_card public.fmds_rule_cards%rowtype;
  qualifying_card public.fmds_rule_cards%rowtype;
  minimum_width_card public.fmds_rule_cards%rowtype;
  adequacy_card public.fmds_rule_cards%rowtype;
  escalation_card public.fmds_rule_cards%rowtype;
  barrier_card public.fmds_rule_cards%rowtype;
  open_width_sum numeric;
  open_width_invalid boolean;
  obstruction_open_percent numeric;
  obstruction_width_in numeric;
  obstruction_angle_degrees numeric;
  obstruction_ignored boolean;
  obstruction_evaluated boolean := false;
  net_width_in numeric;
  qualifying_threshold_in numeric;
  nominal_distance_ft numeric;
  minimum_width_row jsonb;
  actual_net_width_in numeric;
  vertically_aligned boolean;
  unobstructed_full_height boolean;
  meets_minimum_width boolean;
  tfs_adequate boolean;
  gross_between_uprights_in numeric;
  net_between_uprights_in numeric;
  affected_distance_ft numeric;
  barrier_triggered boolean;
begin
  if requested_inputs is null or jsonb_typeof(requested_inputs) <> 'object' then
    raise exception 'FMDS Batch 1 evaluator requires requested_inputs to be a JSON object';
  end if;

  select id, document_code, revision_label, status
  into target_revision
  from public.fmds_corpus_revisions
  where id = requested_revision_id;

  if target_revision.id is null then
    raise exception 'Unknown FMDS revision %', requested_revision_id;
  end if;

  select count(*) filter (where review_status = 'reviewed'),
         coalesce(jsonb_agg(rule_key order by rule_key), '[]'::jsonb)
  into reviewed_rule_count, supported_rule_keys
  from public.fmds_rule_cards
  where revision_id = requested_revision_id
    and rule_key like 'batch1.%';

  if reviewed_rule_count <> expected_rule_count then
    raise exception 'FMDS Batch 1 rule coverage incomplete: expected % reviewed cards, found %', expected_rule_count, reviewed_rule_count;
  end if;

  result := jsonb_build_object(
    'document_code', target_revision.document_code,
    'revision_label', target_revision.revision_label,
    'revision_status', target_revision.status,
    'coverage', 'batch1_only',
    'supported_rule_keys', supported_rule_keys,
    'unsupported_capabilities', jsonb_build_array(
      'sprinkler_head_count',
      'complete_asrs_configuration',
      'full_fmds_8_34_compliance_determination'
    )
  );

  if requested_inputs ? 'sprinkler_head_count' then
    result := result || jsonb_build_object(
      'sprinkler_head_count', jsonb_build_object(
        'status', 'unsupported_by_batch1',
        'reason', 'Batch 1 contains no reviewed rule that calculates sprinkler head count.'
      )
    );
  end if;

  if requested_inputs ? 'hose_demand' then
    hose_request := requested_inputs -> 'hose_demand';
    if jsonb_typeof(hose_request) <> 'object' then
      raise exception 'hose_demand must be a JSON object';
    end if;
    if not (hose_request ? 'ceiling_sprinkler_type') or not (hose_request ? 'design_sprinkler_count') then
      result := result || jsonb_build_object(
        'hose_demand', jsonb_build_object(
          'status', 'insufficient_input',
          'missing_inputs', jsonb_build_array('ceiling_sprinkler_type', 'design_sprinkler_count')
        )
      );
    else
      if jsonb_typeof(hose_request -> 'ceiling_sprinkler_type') <> 'string'
         or jsonb_typeof(hose_request -> 'design_sprinkler_count') <> 'number' then
        raise exception 'hose_demand inputs require a string ceiling_sprinkler_type and numeric design_sprinkler_count';
      end if;
      hose_type := hose_request ->> 'ceiling_sprinkler_type';
      hose_count := (hose_request ->> 'design_sprinkler_count')::integer;
      if hose_type not in ('standard_coverage', 'extended_coverage') then
        raise exception 'Unsupported ceiling_sprinkler_type: %', hose_type;
      end if;
      if hose_count < 1 or hose_count::text <> (hose_request ->> 'design_sprinkler_count') then
        raise exception 'design_sprinkler_count must be a positive integer';
      end if;

      select *
      into hose_card
      from public.fmds_rule_cards
      where revision_id = requested_revision_id
        and rule_key = 'batch1.hose_demand_duration'
        and review_status = 'reviewed';

      select row_value
      into hose_row
      from jsonb_array_elements(hose_card.outputs -> 'rows') row_value
      where row_value ->> 'ceiling_sprinkler_type' = hose_type
        and hose_count >= (row_value ->> 'count_min')::integer
        and ((row_value -> 'count_max') = 'null'::jsonb or hose_count <= (row_value ->> 'count_max')::integer)
      limit 1;

      if hose_row is null then
        raise exception 'No reviewed hose-demand rule matched sprinkler type % and count %', hose_type, hose_count;
      end if;

      result := result || jsonb_build_object(
        'hose_demand', jsonb_build_object(
          'status', 'applied',
          'rule_key', hose_card.rule_key,
          'ceiling_sprinkler_type', hose_type,
          'design_sprinkler_count', hose_count,
          'hose_demand_gpm', (hose_row ->> 'hose_demand_gpm')::integer,
          'hose_demand_lpm', (hose_row ->> 'hose_demand_lpm')::integer,
          'water_supply_duration_min', (hose_row ->> 'water_supply_duration_min')::integer,
          'citations', hose_card.citations
        )
      );
    end if;
  end if;

  if requested_inputs ? 'transverse_flue' then
    tfs_request := requested_inputs -> 'transverse_flue';
    if jsonb_typeof(tfs_request) <> 'object' then
      raise exception 'transverse_flue must be a JSON object';
    end if;

    select * into net_width_card from public.fmds_rule_cards
    where revision_id = requested_revision_id and rule_key = 'batch1.tfs.net_width_sum' and review_status = 'reviewed';
    select * into obstruction_card from public.fmds_rule_cards
    where revision_id = requested_revision_id and rule_key = 'batch1.tfs.obstruction_ignore' and review_status = 'reviewed';
    select * into qualifying_card from public.fmds_rule_cards
    where revision_id = requested_revision_id and rule_key = 'batch1.tfs.qualifying_width_and_distance' and review_status = 'reviewed';
    select * into minimum_width_card from public.fmds_rule_cards
    where revision_id = requested_revision_id and rule_key = 'batch1.tfs.minimum_width_lookup' and review_status = 'reviewed';
    select * into adequacy_card from public.fmds_rule_cards
    where revision_id = requested_revision_id and rule_key = 'batch1.tfs.adequacy' and review_status = 'reviewed';
    select * into escalation_card from public.fmds_rule_cards
    where revision_id = requested_revision_id and rule_key = 'batch1.tfs.noncompliance_escalation' and review_status = 'reviewed';
    select * into barrier_card from public.fmds_rule_cards
    where revision_id = requested_revision_id and rule_key = 'batch1.vertical_barrier.trigger' and review_status = 'reviewed';

    if tfs_request ? 'open_widths_in' then
      if jsonb_typeof(tfs_request -> 'open_widths_in') <> 'array'
         or jsonb_array_length(tfs_request -> 'open_widths_in') = 0 then
        raise exception 'open_widths_in must be a non-empty JSON number array';
      end if;
      select coalesce(bool_or(jsonb_typeof(item) <> 'number' or (item #>> '{}')::numeric < 0), false),
             sum((item #>> '{}')::numeric)
      into open_width_invalid, open_width_sum
      from jsonb_array_elements(tfs_request -> 'open_widths_in') item;
      if open_width_invalid then
        raise exception 'open_widths_in must contain only non-negative numbers';
      end if;
      result := result || jsonb_build_object(
        'net_width', jsonb_build_object(
          'status', 'applied',
          'rule_key', net_width_card.rule_key,
          'net_transverse_flue_space_width_in', open_width_sum,
          'citations', net_width_card.citations
        )
      );
    end if;

    if tfs_request ? 'horizontal_uniformly_open_percent' then
      if jsonb_typeof(tfs_request -> 'horizontal_uniformly_open_percent') <> 'number' then
        raise exception 'horizontal_uniformly_open_percent must be numeric';
      end if;
      obstruction_open_percent := (tfs_request ->> 'horizontal_uniformly_open_percent')::numeric;
      if obstruction_open_percent < 0 or obstruction_open_percent > 100 then
        raise exception 'horizontal_uniformly_open_percent must be between 0 and 100';
      end if;
      obstruction_evaluated := true;
      obstruction_ignored := obstruction_open_percent >= 70;
    end if;

    if (tfs_request ? 'object_width_in') or (tfs_request ? 'object_angle_degrees') then
      if not ((tfs_request ? 'object_width_in') and (tfs_request ? 'object_angle_degrees')) then
        result := result || jsonb_build_object(
          'obstruction', jsonb_build_object(
            'status', 'insufficient_input',
            'missing_inputs', case
              when not (tfs_request ? 'object_width_in') then jsonb_build_array('object_width_in')
              else jsonb_build_array('object_angle_degrees')
            end,
            'rule_key', obstruction_card.rule_key,
            'citations', obstruction_card.citations
          )
        );
      else
        if jsonb_typeof(tfs_request -> 'object_width_in') <> 'number'
           or jsonb_typeof(tfs_request -> 'object_angle_degrees') <> 'number' then
          raise exception 'object_width_in and object_angle_degrees must be numeric';
        end if;
        obstruction_width_in := (tfs_request ->> 'object_width_in')::numeric;
        obstruction_angle_degrees := (tfs_request ->> 'object_angle_degrees')::numeric;
        if obstruction_width_in < 0 or obstruction_angle_degrees < 0 or obstruction_angle_degrees > 180 then
          raise exception 'object width must be non-negative and angle must be between 0 and 180 degrees';
        end if;
        obstruction_evaluated := true;
        obstruction_ignored := coalesce(obstruction_ignored, false)
          or (obstruction_width_in <= 4 and obstruction_angle_degrees >= 30);
      end if;
    end if;

    if obstruction_evaluated then
      result := result || jsonb_build_object(
        'obstruction', jsonb_build_object(
          'status', 'applied',
          'rule_key', obstruction_card.rule_key,
          'ignore_object_in_net_width_calculation', obstruction_ignored,
          'citations', obstruction_card.citations
        )
      );
    end if;

    if tfs_request ? 'net_width_in' then
      if jsonb_typeof(tfs_request -> 'net_width_in') <> 'number' then
        raise exception 'net_width_in must be numeric';
      end if;
      net_width_in := (tfs_request ->> 'net_width_in')::numeric;
      if net_width_in < 0 then
        raise exception 'net_width_in must be non-negative';
      end if;
      qualifying_threshold_in := (qualifying_card.outputs ->> 'qualifying_net_width_in')::numeric;
      result := result || jsonb_build_object(
        'qualifying_transverse_flue_space', jsonb_build_object(
          'status', 'applied',
          'rule_key', qualifying_card.rule_key,
          'net_width_in', net_width_in,
          'qualifying_threshold_in', qualifying_threshold_in,
          'qualifies', net_width_in >= qualifying_threshold_in,
          'citations', qualifying_card.citations
        )
      );
    end if;

    if tfs_request ? 'nominal_horizontal_distance_ft' then
      if jsonb_typeof(tfs_request -> 'nominal_horizontal_distance_ft') <> 'number' then
        raise exception 'nominal_horizontal_distance_ft must be numeric';
      end if;
      nominal_distance_ft := (tfs_request ->> 'nominal_horizontal_distance_ft')::numeric;
      if nominal_distance_ft < 0 then
        raise exception 'nominal_horizontal_distance_ft must be non-negative';
      end if;

      select row_value
      into minimum_width_row
      from jsonb_array_elements(minimum_width_card.outputs -> 'rows') row_value
      where (
        row_value ->> 'operator' = 'eq'
        and nominal_distance_ft = (row_value ->> 'distance_ft')::numeric
      ) or (
        row_value ->> 'operator' = 'gt'
        and nominal_distance_ft > (row_value ->> 'distance_ft')::numeric
      )
      order by case when row_value ->> 'operator' = 'eq' then 0 else 1 end
      limit 1;

      if minimum_width_row is null then
        result := result || jsonb_build_object(
          'minimum_width', jsonb_build_object(
            'status', 'unsupported_input',
            'rule_key', minimum_width_card.rule_key,
            'nominal_horizontal_distance_ft', nominal_distance_ft,
            'reason', 'Batch 1 contains exact lookup rows for 2, 2.5, 5, and 10 ft, plus an escalation rule for distances greater than 10 ft; it does not authorize interpolation.',
            'citations', minimum_width_card.citations
          )
        );
      elsif minimum_width_row ? 'recommended_min_net_width_in' then
        result := result || jsonb_build_object(
          'minimum_width', jsonb_build_object(
            'status', 'applied',
            'rule_key', minimum_width_card.rule_key,
            'nominal_horizontal_distance_ft', nominal_distance_ft,
            'recommended_min_net_width_in', (minimum_width_row ->> 'recommended_min_net_width_in')::numeric,
            'recommended_min_net_width_mm', (minimum_width_row ->> 'recommended_min_net_width_mm')::numeric,
            'citations', minimum_width_card.citations
          )
        );
      else
        result := result || jsonb_build_object(
          'minimum_width', jsonb_build_object(
            'status', 'escalated',
            'rule_key', minimum_width_card.rule_key,
            'nominal_horizontal_distance_ft', nominal_distance_ft,
            'in_rack_sprinklers_required', true,
            'check_vertical_barriers', true,
            'citations', minimum_width_card.citations
          )
        );
      end if;
    end if;

    if (tfs_request ? 'actual_net_width_in')
       or (tfs_request ? 'vertically_aligned')
       or (tfs_request ? 'unobstructed_full_height') then
      if not (
        (tfs_request ? 'actual_net_width_in')
        and (tfs_request ? 'vertically_aligned')
        and (tfs_request ? 'unobstructed_full_height')
        and minimum_width_row is not null
        and minimum_width_row ? 'recommended_min_net_width_in'
      ) then
        result := result || jsonb_build_object(
          'adequacy', jsonb_build_object(
            'status', 'insufficient_input',
            'rule_key', adequacy_card.rule_key,
            'required_inputs', jsonb_build_array('nominal_horizontal_distance_ft with a supported numeric lookup row', 'actual_net_width_in', 'vertically_aligned', 'unobstructed_full_height'),
            'citations', adequacy_card.citations
          )
        );
      else
        if jsonb_typeof(tfs_request -> 'actual_net_width_in') <> 'number'
           or jsonb_typeof(tfs_request -> 'vertically_aligned') <> 'boolean'
           or jsonb_typeof(tfs_request -> 'unobstructed_full_height') <> 'boolean' then
          raise exception 'adequacy inputs require numeric actual_net_width_in and boolean vertically_aligned/unobstructed_full_height';
        end if;
        actual_net_width_in := (tfs_request ->> 'actual_net_width_in')::numeric;
        vertically_aligned := (tfs_request ->> 'vertically_aligned')::boolean;
        unobstructed_full_height := (tfs_request ->> 'unobstructed_full_height')::boolean;
        meets_minimum_width := actual_net_width_in >= (minimum_width_row ->> 'recommended_min_net_width_in')::numeric;
        tfs_adequate := meets_minimum_width and vertically_aligned and unobstructed_full_height;
        result := result || jsonb_build_object(
          'adequacy', jsonb_build_object(
            'status', 'applied',
            'rule_key', adequacy_card.rule_key,
            'transverse_flue_spaces_adequate', tfs_adequate,
            'meets_minimum_width', meets_minimum_width,
            'vertically_aligned', vertically_aligned,
            'unobstructed_full_height', unobstructed_full_height,
            'in_rack_sprinklers_required_if_noncompliant', not tfs_adequate,
            'maximum_vertical_distance_between_in_rack_sprinklers_ft_if_noncompliant', case when tfs_adequate then null else (escalation_card.outputs ->> 'maximum_vertical_distance_between_in_rack_sprinklers_ft')::numeric end,
            'citations', adequacy_card.citations || escalation_card.citations
          )
        );
      end if;
    end if;

    if (tfs_request ? 'gross_width_between_uprights_in')
       or (tfs_request ? 'net_width_between_uprights_in')
       or (tfs_request ? 'affected_flue_horizontal_distance_ft') then
      if not (
        (tfs_request ? 'gross_width_between_uprights_in')
        and (tfs_request ? 'net_width_between_uprights_in')
        and (tfs_request ? 'affected_flue_horizontal_distance_ft')
      ) then
        result := result || jsonb_build_object(
          'vertical_barrier', jsonb_build_object(
            'status', 'insufficient_input',
            'rule_key', barrier_card.rule_key,
            'required_inputs', jsonb_build_array('gross_width_between_uprights_in', 'net_width_between_uprights_in', 'affected_flue_horizontal_distance_ft'),
            'citations', barrier_card.citations
          )
        );
      else
        if jsonb_typeof(tfs_request -> 'gross_width_between_uprights_in') <> 'number'
           or jsonb_typeof(tfs_request -> 'net_width_between_uprights_in') <> 'number'
           or jsonb_typeof(tfs_request -> 'affected_flue_horizontal_distance_ft') <> 'number' then
          raise exception 'vertical-barrier inputs must be numeric';
        end if;
        gross_between_uprights_in := (tfs_request ->> 'gross_width_between_uprights_in')::numeric;
        net_between_uprights_in := (tfs_request ->> 'net_width_between_uprights_in')::numeric;
        affected_distance_ft := (tfs_request ->> 'affected_flue_horizontal_distance_ft')::numeric;
        if gross_between_uprights_in < 0 or net_between_uprights_in < 0 or affected_distance_ft < 0 then
          raise exception 'vertical-barrier dimensions and distance must be non-negative';
        end if;
        barrier_triggered := gross_between_uprights_in >= 1.5
          and net_between_uprights_in <= 0.5
          and affected_distance_ft > 10;
        result := result || jsonb_build_object(
          'vertical_barrier', jsonb_build_object(
            'status', 'applied',
            'rule_key', barrier_card.rule_key,
            'batch1_condition_triggered', barrier_triggered,
            'result', case when barrier_triggered then 'vertical_barriers_recommended' else 'not_triggered_by_this_batch1_condition' end,
            'maximum_spacing_ft_if_triggered', case when barrier_triggered then (barrier_card.outputs ->> 'maximum_spacing_ft')::numeric else null end,
            'maximum_spacing_m_if_triggered', case when barrier_triggered then (barrier_card.outputs ->> 'maximum_spacing_m')::numeric else null end,
            'citations', barrier_card.citations
          )
        );
      end if;
    end if;
  end if;

  if not (requested_inputs ? 'hose_demand')
     and not (requested_inputs ? 'transverse_flue')
     and not (requested_inputs ? 'sprinkler_head_count') then
    result := result || jsonb_build_object(
      'status', 'insufficient_input',
      'supported_request_sections', jsonb_build_array('hose_demand', 'transverse_flue', 'sprinkler_head_count')
    );
  else
    result := result || jsonb_build_object('status', 'evaluated');
  end if;

  return result;
end;
$$;

revoke all on function public.evaluate_fmds_batch1_rules(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.evaluate_fmds_batch1_rules(uuid, jsonb) to service_role;
