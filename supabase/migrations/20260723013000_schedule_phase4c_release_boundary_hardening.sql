begin;

-- Immutable leveling events must not be able to point across tenant boundaries.
create unique index if not exists schedule_revisions_id_project_unique
  on public.schedule_revisions(id, project_id);

alter table public.schedule_leveling_events
  drop constraint if exists schedule_leveling_events_related_event_id_fkey,
  drop constraint if exists schedule_leveling_events_source_revision_id_fkey,
  drop constraint if exists schedule_leveling_events_target_revision_id_fkey;

alter table public.schedule_leveling_events
  add constraint schedule_leveling_events_related_event_project_fkey
    foreign key(related_event_id, project_id)
    references public.schedule_leveling_events(id, project_id)
    on delete restrict,
  add constraint schedule_leveling_events_source_revision_project_fkey
    foreign key(source_revision_id, project_id)
    references public.schedule_revisions(id, project_id)
    on delete restrict,
  add constraint schedule_leveling_events_target_revision_project_fkey
    foreign key(target_revision_id, project_id)
    references public.schedule_revisions(id, project_id)
    on delete restrict;

-- Preview changes are calculated by trusted application code. Browser sessions
-- may load context and apply a saved run, but they cannot manufacture a run by
-- calling the lower-level persistence RPC with caller-authored segments.
revoke all on function public.create_schedule_leveling_run(
  integer, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_schedule_leveling_run(
  integer, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz
) to service_role;

create or replace function public.create_authoritative_schedule_leveling_run(
  p_actor_user_id uuid,
  p_project_id integer,
  p_algorithm_version text,
  p_source_token text,
  p_person_revision_vector jsonb,
  p_configuration jsonb,
  p_diagnostics jsonb,
  p_changes jsonb,
  p_expires_at timestamptz default (now() + interval '30 minutes')
)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'Only the trusted scheduling service may create a leveling run.'
      using errcode = '42501';
  end if;
  if p_actor_user_id is null then
    raise exception 'A valid scheduling actor is required.' using errcode = '42501';
  end if;

  -- Preserve the authenticated actor in the immutable audit record while the
  -- service-role connection supplies the trusted calculation boundary.
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_user_id::text, true);

  return public.create_schedule_leveling_run(
    p_project_id,
    p_algorithm_version,
    p_source_token,
    p_person_revision_vector,
    p_configuration,
    p_diagnostics,
    p_changes,
    p_expires_at
  );
end;
$$;

revoke all on function public.create_authoritative_schedule_leveling_run(
  uuid, integer, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_authoritative_schedule_leveling_run(
  uuid, integer, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz
) to service_role;

commit;
