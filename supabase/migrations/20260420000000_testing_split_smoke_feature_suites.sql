-- Split test suites into two types per tool: smoke (fast, page-level) and feature (deep, usability).
-- Drops scenario_depth from test_cases in favor of suite_type on test_suites.
-- Wipes all existing test data — user requested fresh start.

begin;
truncate table public.test_screenshots, public.test_results, public.test_runs, public.test_cases, public.test_suites restart identity cascade;
alter table public.test_cases drop constraint if exists test_cases_scenario_depth_check;
alter table public.test_cases drop constraint if exists test_cases_scenario_quality_chk;
alter table public.test_cases drop column if exists scenario_depth;
alter table public.test_cases add constraint test_cases_scenario_quality_chk
  check (
    test_type <> 'scenario'
    or (
      length(trim(coalesce(steps, ''))) > 0
      and length(trim(coalesce(expected_result, ''))) > 0
      and length(trim(coalesce(start_url, ''))) > 0
      and left(trim(coalesce(start_url, '')), 1) = '/'
      and position(' ' in trim(coalesce(start_url, ''))) = 0
    )
  );
alter table public.test_suites drop constraint if exists test_suites_tool_name_key;
alter table public.test_suites add column if not exists suite_type text not null default 'feature';
alter table public.test_suites add constraint test_suites_suite_type_check
  check (suite_type in ('smoke', 'feature'));
alter table public.test_suites add constraint test_suites_tool_name_suite_type_key
  unique (tool_name, suite_type);
alter table public.test_runs drop constraint if exists test_runs_scenario_depth_check;
alter table public.test_runs alter column scenario_depth drop not null;
create index if not exists test_suites_suite_type_idx on public.test_suites (suite_type);
create index if not exists test_suites_tool_name_idx on public.test_suites (tool_name);
commit;
