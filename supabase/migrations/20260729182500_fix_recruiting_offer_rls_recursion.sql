-- Prevent recruiting offer and offer-approval SELECT policies from recursively
-- evaluating one another. The helper runs as the migration owner and returns
-- only an authorization boolean; callers never receive bypass access.

begin;

create or replace function public.current_can_access_recruiting_offer(
  p_offer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.recruiting_offers ro
    where ro.id = p_offer_id
      and (
        public.current_can_access_sensitive_recruiting_application(
          ro.application_id
        )
        or exists (
          select 1
          from public.recruiting_offer_approvals roa
          where roa.offer_id = ro.id
            and roa.approver_person_id = public.current_person_id()
        )
      )
  );
$$;

revoke all on function public.current_can_access_recruiting_offer(uuid)
from public, anon;
grant execute on function public.current_can_access_recruiting_offer(uuid)
to authenticated;

drop policy if exists recruiting_offers_read
on public.recruiting_offers;

create policy recruiting_offers_read
on public.recruiting_offers
for select
to authenticated
using (public.current_can_access_recruiting_offer(id));

commit;
