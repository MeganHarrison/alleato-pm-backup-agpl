-- Recruiter-only candidate intake UAT.
-- This provisions a separate private quarantine bucket and transactional
-- database functions. It intentionally leaves the feature disabled until the
-- application deployment and post-deploy checks are complete.

begin;

insert into public.recruiting_settings (key, value)
values ('public_intake_uat_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create table public.recruiting_uat_submissions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  request_hash text not null check (length(request_hash) = 64),
  candidate_id uuid not null unique
    references public.recruiting_candidates(id) on delete cascade,
  application_id uuid not null unique
    references public.recruiting_applications(id) on delete cascade,
  document_id uuid not null unique
    references public.recruiting_documents(id) on delete cascade,
  submitted_by_person_id uuid not null
    references public.people(id) on delete restrict,
  consent_version text not null check (length(btrim(consent_version)) between 1 and 100),
  consented_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint recruiting_uat_expiry_after_consent check (expires_at > consented_at)
);

create index recruiting_uat_submissions_expiry_idx
on public.recruiting_uat_submissions(expires_at);

alter table public.recruiting_uat_submissions enable row level security;

create policy recruiting_uat_submissions_read
on public.recruiting_uat_submissions for select
to authenticated
using (public.current_recruiting_role() in ('recruiting_admin', 'recruiter'));

revoke all on table public.recruiting_uat_submissions
from public, anon, authenticated;
grant select on table public.recruiting_uat_submissions to authenticated;
grant all on table public.recruiting_uat_submissions to service_role;

create table public.recruiting_uat_rate_limit_attempts (
  id bigint generated always as identity primary key,
  actor_person_id uuid not null references public.people(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index recruiting_uat_rate_limit_attempts_actor_time_idx
on public.recruiting_uat_rate_limit_attempts(actor_person_id, attempted_at);

alter table public.recruiting_uat_rate_limit_attempts enable row level security;
revoke all on table public.recruiting_uat_rate_limit_attempts
from public, anon, authenticated;
grant all on table public.recruiting_uat_rate_limit_attempts to service_role;

create table public.recruiting_uat_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  submitted_at timestamptz not null,
  deleted_at timestamptz not null default now(),
  delete_reason text not null check (length(btrim(delete_reason)) between 1 and 100),
  deleted_by_person_id uuid not null references public.people(id) on delete restrict
);

alter table public.recruiting_uat_deletion_audit enable row level security;
revoke all on table public.recruiting_uat_deletion_audit
from public, anon, authenticated;
grant all on table public.recruiting_uat_deletion_audit to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recruiting-uat-quarantine',
  'recruiting-uat-quarantine',
  false,
  4194304,
  array['application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.recruiting_consume_uat_rate_limit(
  p_actor_person_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.recruiting_user_roles
    where person_id = p_actor_person_id
      and role in ('recruiting_admin', 'recruiter')
      and is_active = true
  ) then
    raise exception 'The recruiting operator is not active.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_actor_person_id::text, 20260730183000)
  );

  delete from public.recruiting_uat_rate_limit_attempts
  where attempted_at < now() - interval '1 day';

  if (
    select count(*)
    from public.recruiting_uat_rate_limit_attempts
    where actor_person_id = p_actor_person_id
      and attempted_at >= now() - interval '1 hour'
  ) >= 10 then
    return false;
  end if;

  insert into public.recruiting_uat_rate_limit_attempts(actor_person_id)
  values (p_actor_person_id);
  return true;
end;
$$;

create or replace function public.recruiting_create_uat_submission(
  p_idempotency_key uuid,
  p_request_hash text,
  p_actor_person_id uuid,
  p_requisition_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_email_hash text,
  p_phone text,
  p_phone_hash text,
  p_storage_path text,
  p_original_file_name text,
  p_content_type text,
  p_byte_size bigint,
  p_sha256 text,
  p_consent_version text,
  p_consented_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.recruiting_uat_submissions%rowtype;
  v_existing_storage_path text;
  v_candidate_id uuid := gen_random_uuid();
  v_application_id uuid := gen_random_uuid();
  v_document_id uuid := gen_random_uuid();
  v_display_name text;
  v_expires_at timestamptz := p_consented_at + interval '24 hours';
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_idempotency_key::text, 20260730183000)
  );

  if not exists (
    select 1
    from public.recruiting_settings
    where key = 'public_intake_uat_enabled'
      and value = 'true'::jsonb
  ) then
    raise exception 'Candidate intake UAT is disabled.';
  end if;

  select *
  into v_existing
  from public.recruiting_uat_submissions
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.submitted_by_person_id <> p_actor_person_id
      or v_existing.request_hash <> p_request_hash then
      raise exception 'The idempotency key is already bound to another UAT request.';
    end if;

    select storage_path
    into v_existing_storage_path
    from public.recruiting_documents
    where id = v_existing.document_id;

    return jsonb_build_object(
      'candidateId', v_existing.candidate_id,
      'applicationId', v_existing.application_id,
      'documentId', v_existing.document_id,
      'expiresAt', v_existing.expires_at,
      'storagePath', v_existing_storage_path,
      'replayed', true
    );
  end if;

  if not exists (
    select 1
    from public.recruiting_user_roles
    where person_id = p_actor_person_id
      and role in ('recruiting_admin', 'recruiter')
      and is_active = true
  ) then
    raise exception 'The recruiting operator is not active.';
  end if;

  if length(p_request_hash) <> 64
    or btrim(p_first_name) <> 'Test'
    or btrim(p_last_name) !~* '^Candidate(?:[-_ ]?[a-z0-9]+)?$'
    or lower(btrim(p_email)) !~ '^[^@+[:space:]]+\+uat(?:[-_][a-z0-9]+(?:[-_][a-z0-9]+)*)?@alleatogroup\.com$'
    or (nullif(btrim(p_phone), '') is not null and p_phone !~ '^\+131755501[0-9]{2}$')
    or p_storage_path <> 'uat/' || p_idempotency_key::text || '/' || split_part(p_storage_path, '/', 3)
    or p_storage_path !~ ('^uat/' || p_idempotency_key::text || '/[0-9a-f-]+\.pdf$')
    or lower(p_original_file_name) <> 'synthetic-test-resume.pdf'
    or p_content_type <> 'application/pdf'
    or p_byte_size < 1
    or p_byte_size > 4194304
    or p_sha256 <> '03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062'
    or length(p_email_hash) <> 64
    or (nullif(btrim(p_phone), '') is not null and length(p_phone_hash) <> 64)
    or p_consent_version <> 'recruiting-uat-v1' then
    raise exception 'The UAT submission does not match the approved synthetic fixture and identity rules.';
  end if;

  if not exists (
    select 1
    from public.recruiting_requisitions
    where id = p_requisition_id
      and status = 'open'
      and is_confidential = false
  ) then
    raise exception 'Select an open, non-confidential position.';
  end if;

  v_display_name := '[UAT] ' || btrim(p_first_name) || ' ' || btrim(p_last_name);

  insert into public.recruiting_candidates (
    id,
    display_name,
    first_name,
    last_name,
    candidate_status,
    created_by_person_id,
    updated_by_person_id
  )
  values (
    v_candidate_id,
    v_display_name,
    btrim(p_first_name),
    btrim(p_last_name),
    'active',
    p_actor_person_id,
    p_actor_person_id
  );

  insert into public.recruiting_candidate_contacts (
    candidate_id,
    contact_type,
    value_display,
    value_normalized,
    value_hash,
    is_primary,
    is_verified,
    consent_status
  )
  values (
    v_candidate_id,
    'email',
    lower(btrim(p_email)),
    lower(btrim(p_email)),
    p_email_hash,
    true,
    false,
    'unknown'
  );

  if nullif(btrim(p_phone), '') is not null then
    insert into public.recruiting_candidate_contacts (
      candidate_id,
      contact_type,
      value_display,
      value_normalized,
      value_hash,
      is_primary,
      is_verified,
      consent_status
    )
    values (
      v_candidate_id,
      'phone',
      p_phone,
      p_phone,
      p_phone_hash,
      true,
      false,
      'unknown'
    );
  end if;

  insert into public.recruiting_applications (
    id,
    requisition_id,
    candidate_id,
    current_stage,
    status,
    created_by_person_id,
    updated_by_person_id
  )
  values (
    v_application_id,
    p_requisition_id,
    v_candidate_id,
    'new',
    'active',
    p_actor_person_id,
    p_actor_person_id
  );

  insert into public.recruiting_application_sources (
    application_id,
    source_type,
    source_detail,
    is_primary
  )
  values (
    v_application_id,
    'career_site',
    'Authenticated candidate intake UAT',
    true
  );

  insert into public.recruiting_documents (
    id,
    candidate_id,
    application_id,
    document_type,
    storage_bucket,
    storage_path,
    original_file_name,
    content_type,
    byte_size,
    sha256,
    scan_status,
    extraction_status,
    human_review_status,
    retention_status,
    uploaded_by_person_id
  )
  values (
    v_document_id,
    v_candidate_id,
    v_application_id,
    'resume',
    'recruiting-uat-quarantine',
    p_storage_path,
    p_original_file_name,
    p_content_type,
    p_byte_size,
    p_sha256,
    'not_configured',
    'not_configured',
    'pending',
    'active',
    p_actor_person_id
  );

  insert into public.recruiting_activity_events (
    candidate_id,
    application_id,
    requisition_id,
    event_type,
    summary,
    detail,
    visibility,
    actor_person_id
  )
  values (
    v_candidate_id,
    v_application_id,
    p_requisition_id,
    'candidate_intake_uat_submitted',
    'Synthetic candidate intake test submitted',
    jsonb_build_object(
      'consentVersion', p_consent_version,
      'consentedAt', p_consented_at,
      'expiresAt', v_expires_at,
      'mode', 'uat',
      'resumeStatus', 'quarantined'
    ),
    'system',
    p_actor_person_id
  );

  insert into public.recruiting_uat_submissions (
    idempotency_key,
    request_hash,
    candidate_id,
    application_id,
    document_id,
    submitted_by_person_id,
    consent_version,
    consented_at,
    expires_at
  )
  values (
    p_idempotency_key,
    p_request_hash,
    v_candidate_id,
    v_application_id,
    v_document_id,
    p_actor_person_id,
    p_consent_version,
    p_consented_at,
    v_expires_at
  );

  return jsonb_build_object(
    'candidateId', v_candidate_id,
    'applicationId', v_application_id,
    'documentId', v_document_id,
    'expiresAt', v_expires_at,
    'storagePath', p_storage_path,
    'replayed', false
  );
end;
$$;

create or replace function public.recruiting_delete_uat_submission(
  p_candidate_id uuid,
  p_actor_person_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.recruiting_uat_submissions%rowtype;
begin
  if (
    p_reason = 'expired'
    and not exists (
      select 1 from public.people where id = p_actor_person_id
    )
  ) or (
    p_reason <> 'expired'
    and not exists (
      select 1
      from public.recruiting_user_roles
      where person_id = p_actor_person_id
        and role in ('recruiting_admin', 'recruiter')
        and is_active = true
    )
  ) then
    raise exception 'The recruiting operator is not active.';
  end if;

  if length(btrim(p_reason)) not between 1 and 100 then
    raise exception 'A bounded deletion reason is required.';
  end if;

  select *
  into v_submission
  from public.recruiting_uat_submissions
  where candidate_id = p_candidate_id
  for update;

  if not found then
    return false;
  end if;

  if p_reason <> 'expired'
    and v_submission.submitted_by_person_id <> p_actor_person_id
    and not exists (
      select 1
      from public.recruiting_user_roles
      where person_id = p_actor_person_id
        and role = 'recruiting_admin'
        and is_active = true
    ) then
    raise exception 'Only the submitting recruiter or an administrator can delete this UAT record.';
  end if;

  insert into public.recruiting_uat_deletion_audit (
    submission_id,
    submitted_at,
    delete_reason,
    deleted_by_person_id
  )
  values (
    v_submission.id,
    v_submission.created_at,
    btrim(p_reason),
    p_actor_person_id
  );

  delete from public.recruiting_activity_events
  where candidate_id = p_candidate_id
    and event_type = 'candidate_intake_uat_submitted';

  delete from public.recruiting_applications
  where candidate_id = p_candidate_id;

  delete from public.recruiting_candidates
  where id = p_candidate_id;

  return true;
end;
$$;

create or replace function public.recruiting_list_expired_uat_submissions()
returns table (
  candidate_id uuid,
  storage_path text,
  submitted_by_person_id uuid
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select rus.candidate_id, rd.storage_path, rus.submitted_by_person_id
  from public.recruiting_uat_submissions rus
  join public.recruiting_documents rd on rd.id = rus.document_id
  where rus.expires_at <= now()
$$;

revoke all on function public.recruiting_create_uat_submission(
  uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text,
  bigint, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.recruiting_consume_uat_rate_limit(uuid)
from public, anon, authenticated;
revoke all on function public.recruiting_delete_uat_submission(uuid, uuid, text)
from public, anon, authenticated;
revoke all on function public.recruiting_list_expired_uat_submissions()
from public, anon, authenticated;

grant execute on function public.recruiting_create_uat_submission(
  uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text,
  bigint, text, text, timestamptz
) to service_role;
grant execute on function public.recruiting_consume_uat_rate_limit(uuid)
to service_role;
grant execute on function public.recruiting_delete_uat_submission(uuid, uuid, text)
to service_role;
grant execute on function public.recruiting_list_expired_uat_submissions()
to service_role;

commit;
