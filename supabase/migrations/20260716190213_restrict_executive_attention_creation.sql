-- AAI-1102 authorization repair: creation is a server-side capability-gated
-- action. Authenticated clients must not bypass the Executive Briefing route
-- guard by invoking the creation RPC directly.

begin;

revoke execute on function public.create_executive_attention_item(jsonb) from authenticated;
grant execute on function public.create_executive_attention_item(jsonb) to service_role;

commit;
