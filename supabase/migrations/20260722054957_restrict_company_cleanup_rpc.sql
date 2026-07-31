-- The cleanup is a service-owned scheduled operation; it is not an app-user RPC.
REVOKE ALL ON FUNCTION public.purge_unlinked_non_acumatica_companies() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_unlinked_non_acumatica_companies() TO service_role;
