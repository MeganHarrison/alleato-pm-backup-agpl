-- Archive stale MAIN intelligence mirror tables that were superseded by the
-- RAG database migration. We rename instead of dropping so any hidden caller
-- fails loudly on the old name while the old rows remain recoverable.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'source_intelligence_jobs'
  ) then
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'source_intelligence_jobs_archive_20260609'
    ) then
      raise exception 'Archive table already exists: public.source_intelligence_jobs_archive_20260609';
    end if;

    alter table public.source_intelligence_jobs
      rename to source_intelligence_jobs_archive_20260609;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'source_signal_candidates'
  ) then
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'source_signal_candidates_archive_20260609'
    ) then
      raise exception 'Archive table already exists: public.source_signal_candidates_archive_20260609';
    end if;

    alter table public.source_signal_candidates
      rename to source_signal_candidates_archive_20260609;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'packet_refresh_jobs'
  ) then
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'packet_refresh_jobs_archive_20260609'
    ) then
      raise exception 'Archive table already exists: public.packet_refresh_jobs_archive_20260609';
    end if;

    alter table public.packet_refresh_jobs
      rename to packet_refresh_jobs_archive_20260609;
  end if;
end
$$;
