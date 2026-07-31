// Project Intelligence ingestion cannot reliably reach Supabase's direct IPv6 database hostname from Render.
// Every Daily Brief RAG read/write boundary must use the same regional
// Supavisor normalization contract.
export const RAG_DATABASE_CONNECTION_OPTIONS = Object.freeze({
  includeSslMode: false,
  rewriteSupabaseDirectHost: true,
});
