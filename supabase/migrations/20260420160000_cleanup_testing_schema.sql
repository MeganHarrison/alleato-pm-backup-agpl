-- Cleanup unused columns on testing tables left over from the pre-suite_type schema.
-- These columns are no longer referenced by any API route, UI, or skill after the
-- 2026-04-20 testing pipeline consolidation. Dropping them keeps the schema honest
-- and prevents future confusion.

begin;
-- Drop legacy Procore traceability views that depend on columns being removed.
-- These were tied to the old per-article/per-chunk source tracking, which was
-- replaced by the suite_type model.
drop view if exists public.procore_test_traceability_gaps;
drop view if exists public.procore_coverage_summary;
alter table public.test_cases
  drop column if exists tool,
  drop column if exists procore_feature_id,
  drop column if exists source_article_id,
  drop column if exists source_chunk_id,
  drop column if exists source_url,
  drop column if exists source_manifest_path,
  drop column if exists gap_type,
  drop column if exists tool_name,
  drop column if exists status;
alter table public.test_runs
  drop column if exists scenario_depth;
-- Ensure the test-screenshots storage bucket exists so test-scenario-run can
-- upload evidence. Idempotent — safe to re-run.
insert into storage.buckets (id, name, public)
values ('test-screenshots', 'test-screenshots', true)
on conflict (id) do nothing;
commit;
