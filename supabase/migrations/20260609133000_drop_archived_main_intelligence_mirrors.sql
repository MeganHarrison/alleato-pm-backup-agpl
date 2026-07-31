-- Drop archived MAIN intelligence mirror tables after the archive cutover
-- proved there are no active runtime dependencies on the old PM APP copies.

drop table if exists public.source_intelligence_jobs_archive_20260609;
drop table if exists public.source_signal_candidates_archive_20260609;
drop table if exists public.packet_refresh_jobs_archive_20260609;
