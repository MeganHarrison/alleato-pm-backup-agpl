begin;

create or replace function public.recruiting_requisition_has_linked_records(
  p_requisition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1 from public.recruiting_requisition_memberships
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_applications
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_activity_events
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_tasks
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_requisition_approvals
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_messages
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_provider_attempts
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_interview_plans
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_scorecard_templates
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_automation_runs
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_intake_submissions
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_metric_snapshots
      where requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.recruiting_ai_runs
      where requisition_id = p_requisition_id
    );
$$;

create or replace function public.recruiting_set_requisition_lifecycle(
  p_requisition_id uuid,
  p_next_status text,
  p_expected_row_version integer,
  p_reason text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.current_person_id();
  v_receipt public.recruiting_command_receipts%rowtype;
  v_requisition public.recruiting_requisitions%rowtype;
  v_previous_status text;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_next_status not in ('closed', 'canceled') then
    raise exception 'A requisition can only be closed or canceled from this action.'
      using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason of at least 5 characters is required.'
      using errcode = '22023';
  end if;
  if p_expected_row_version is null or p_expected_row_version < 1 then
    raise exception 'A positive expected row version is required.'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null
    or length(btrim(coalesce(p_request_hash, ''))) < 32
  then
    raise exception 'A valid idempotency key and request hash are required.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
  );

  select *
  into v_receipt
  from public.recruiting_command_receipts
  where actor_person_id = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    if v_receipt.request_hash <> p_request_hash
      or v_receipt.command_name <> 'requisition.lifecycle'
    then
      raise exception 'The idempotency key was already used for a different command.'
        using errcode = '23505';
    end if;
    return v_receipt.response_body || jsonb_build_object('replayed', true);
  end if;

  select *
  into v_requisition
  from public.recruiting_requisitions
  where id = p_requisition_id
  for update;

  if not found then
    raise exception 'The requisition no longer exists. Reload and try again.'
      using errcode = 'P0002';
  end if;
  if not public.current_can_manage_recruiting_requisition(p_requisition_id) then
    raise exception 'Recruiting write access is required.'
      using errcode = '42501';
  end if;
  if v_requisition.row_version <> p_expected_row_version then
    raise exception 'The requisition changed after it was loaded. Reload and try again.'
      using errcode = '40001';
  end if;
  if v_requisition.status in ('filled', 'closed', 'canceled') then
    raise exception 'A filled, closed, or canceled requisition cannot be changed by this action.'
      using errcode = '23514';
  end if;

  v_previous_status := v_requisition.status;
  update public.recruiting_requisitions
  set
    status = p_next_status,
    closed_at = now(),
    updated_by_person_id = v_actor,
    row_version = row_version + 1
  where id = p_requisition_id
  returning * into v_requisition;

  insert into public.recruiting_activity_events (
    requisition_id,
    event_type,
    summary,
    detail,
    actor_person_id
  )
  values (
    p_requisition_id,
    'requisition.lifecycle_changed',
    format('Position %s by recruiter.', p_next_status),
    jsonb_build_object(
      'fromStatus', v_previous_status,
      'toStatus', p_next_status,
      'reason', btrim(p_reason)
    ),
    v_actor
  );

  v_response := jsonb_build_object(
    'requisitionId', v_requisition.id,
    'requisitionNumber', v_requisition.requisition_number,
    'title', v_requisition.title,
    'previousStatus', v_previous_status,
    'status', v_requisition.status,
    'rowVersion', v_requisition.row_version,
    'replayed', false
  );

  insert into public.recruiting_command_receipts (
    actor_person_id,
    idempotency_key,
    command_name,
    request_hash,
    response_body
  )
  values (
    v_actor,
    p_idempotency_key,
    'requisition.lifecycle',
    p_request_hash,
    v_response
  );

  return v_response;
end;
$$;

create or replace function public.recruiting_delete_unused_draft_requisition(
  p_requisition_id uuid,
  p_expected_row_version integer,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.current_person_id();
  v_receipt public.recruiting_command_receipts%rowtype;
  v_requisition public.recruiting_requisitions%rowtype;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not public.current_recruiting_is_admin() then
    raise exception 'Recruiting administrator access is required to delete a draft.'
      using errcode = '42501';
  end if;
  if p_expected_row_version is null or p_expected_row_version < 1 then
    raise exception 'A positive expected row version is required.'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null
    or length(btrim(coalesce(p_request_hash, ''))) < 32
  then
    raise exception 'A valid idempotency key and request hash are required.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
  );

  select *
  into v_receipt
  from public.recruiting_command_receipts
  where actor_person_id = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    if v_receipt.request_hash <> p_request_hash
      or v_receipt.command_name <> 'requisition.delete'
    then
      raise exception 'The idempotency key was already used for a different command.'
        using errcode = '23505';
    end if;
    return v_receipt.response_body || jsonb_build_object('replayed', true);
  end if;

  select *
  into v_requisition
  from public.recruiting_requisitions
  where id = p_requisition_id
  for update;

  if not found then
    raise exception 'The requisition no longer exists. Reload and try again.'
      using errcode = 'P0002';
  end if;
  if v_requisition.row_version <> p_expected_row_version then
    raise exception 'The requisition changed after it was loaded. Reload and try again.'
      using errcode = '40001';
  end if;
  if v_requisition.status <> 'draft' then
    raise exception 'Only an unused draft requisition can be permanently deleted.'
      using errcode = '23514';
  end if;
  if public.recruiting_requisition_has_linked_records(p_requisition_id) then
    raise exception 'This draft has recruiting activity. Close or cancel it instead of deleting it.'
      using errcode = '23503';
  end if;

  v_response := jsonb_build_object(
    'requisitionId', v_requisition.id,
    'requisitionNumber', v_requisition.requisition_number,
    'title', v_requisition.title,
    'deleted', true,
    'replayed', false
  );

  delete from public.recruiting_requisitions
  where id = p_requisition_id;

  insert into public.recruiting_command_receipts (
    actor_person_id,
    idempotency_key,
    command_name,
    request_hash,
    response_body
  )
  values (
    v_actor,
    p_idempotency_key,
    'requisition.delete',
    p_request_hash,
    v_response
  );

  return v_response;
end;
$$;

revoke all on function public.recruiting_requisition_has_linked_records(uuid)
from public, anon, authenticated;
revoke all on function public.recruiting_set_requisition_lifecycle(
  uuid, text, integer, text, uuid, text
) from public, anon;
revoke all on function public.recruiting_delete_unused_draft_requisition(
  uuid, integer, uuid, text
) from public, anon;

grant execute on function public.recruiting_requisition_has_linked_records(uuid)
to service_role;
grant execute on function public.recruiting_set_requisition_lifecycle(
  uuid, text, integer, text, uuid, text
) to authenticated, service_role;
grant execute on function public.recruiting_delete_unused_draft_requisition(
  uuid, integer, uuid, text
) to authenticated, service_role;

commit;
