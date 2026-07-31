-- Remove the CRM workflow layer from the PM APP database.
--
-- Reverses 20260723060000_create_crm_workflow_tables.sql. The CRM feature
-- (added 2026-07-23) is being removed to keep the app lean. This migration
-- drops ONLY the CRM-specific objects and NEVER mutates companies/people rows.
--
-- Scope (verified via read-only inventory 2026-07-24 against
-- db.lgveqfnpkxvzbnnwuled.supabase.co):
--   - Objects: crm_pipeline_stages (7 rows), crm_deals (0), crm_activities (0),
--     company_qualification (0), verified_companies view,
--     companies.lifecycle_stage, people.lifecycle_stage.
--   - No functions/RPCs reference these objects.
--   - No views other than verified_companies depend on lifecycle_stage.
--   - No inbound FKs from any external table reference the CRM tables.
--   - No frontend/backend code reads verified_companies or filters
--     lifecycle_stage, so nothing needs repointing (companies is read directly).
--
-- Not touched here: the pre-existing `prospects` table + /directory/prospects
-- surface (added 2026-03-10 / 2026-06-11) is a SEPARATE feature, not the CRM,
-- and stays intact.
--
-- The shared trigger function public.set_updated_at() is intentionally NOT
-- dropped — it is used by many other tables.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

-- 1. Leak-proof read view depends on companies.lifecycle_stage — drop it first.
drop view if exists public.verified_companies;

-- 2. Workflow tables, in dependency order (activities -> deals -> stages).
--    Their triggers, policies, and indexes are dropped implicitly with them.
drop table if exists public.crm_activities;
drop table if exists public.crm_deals;
drop table if exists public.crm_pipeline_stages;
drop table if exists public.company_qualification;

-- 3. Lifecycle-stage columns on the identity tables. Dropping the column also
--    drops companies_lifecycle_stage_check / _idx and people_lifecycle_stage_*.
--    NOTE: this alters the table shape only — no row is deleted or mutated.
alter table public.companies drop column if exists lifecycle_stage;
alter table public.people drop column if exists lifecycle_stage;

commit;
