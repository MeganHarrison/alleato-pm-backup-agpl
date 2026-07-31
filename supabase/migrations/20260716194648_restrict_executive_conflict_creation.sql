-- AAI-1103: conflict creation is capability-gated in the server route.
-- Authenticated browser callers must not bypass canonical-brief, attention, or
-- evidence validation by invoking the controlled writer directly.

begin;

revoke all on function public.create_executive_claim_conflict(jsonb)
  from public, anon, authenticated;
grant execute on function public.create_executive_claim_conflict(jsonb)
  to service_role;

commit;
