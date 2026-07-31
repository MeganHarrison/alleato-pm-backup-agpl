-- PostgreSQL resolves a CASE of string literals as text. Cast the freshness
-- decision status explicitly to the training_resource_status enum so the
-- feedback bridge executes on live data.

begin;

create or replace function public.review_training_resource_freshness_check(
  p_check_id uuid,
  p_decision text,
  p_notes text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  freshness_check public.training_resource_freshness_checks%rowtype;
  normalized_notes text := btrim(p_notes);
begin
  if auth.uid() is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Training freshness review requires app admin access.';
  end if;

  if p_decision not in ('keep', 'archive') then
    raise exception
      using
        errcode = '22023',
        message = 'Training freshness decision must be keep or archive.';
  end if;

  if normalized_notes is null
    or char_length(normalized_notes) not between 8 and 1000
  then
    raise exception
      using
        errcode = '22023',
        message = 'Training freshness review notes must be between 8 and 1000 characters.';
  end if;

  select *
  into freshness_check
  from public.training_resource_freshness_checks
  where id = p_check_id
    and review_status = 'pending'
  for update;

  if freshness_check.id is null then
    raise exception
      using
        errcode = 'P0002',
        message = 'Training freshness finding is no longer pending review.';
  end if;

  update public.training_resource
  set
    status = (
      case when p_decision = 'archive' then 'archived' else 'published' end
    )::public.training_resource_status,
    reviewer_notes = normalized_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_by = auth.uid()
  where id = freshness_check.resource_id
    and status = 'published';

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Published training resource is no longer available for freshness review.';
  end if;

  update public.training_resource_freshness_checks
  set
    review_status =
      case when p_decision = 'archive' then 'accepted' else 'rejected' end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewer_notes = normalized_notes
  where id = freshness_check.id;

  return p_decision;
end;
$$;

comment on function public.review_training_resource_freshness_check(
  uuid,
  text,
  text
) is
  'App-admin-only atomic keep/archive decision. Persists feedback to the freshness ledger and canonical resource memory used by future discovery.';

commit;
