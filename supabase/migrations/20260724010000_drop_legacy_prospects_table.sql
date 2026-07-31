-- Drop the legacy standalone `prospects` table (0 rows, "never used in
-- production" per tables.yaml). It was a parallel CRM identity table — exactly
-- the architecture rejected on 2026-07-23. Prospects now live in `companies`
-- with lifecycle_stage != 'active'; pipeline data lives in crm_deals /
-- crm_activities / company_qualification.
--
-- Verified before drop: 0 rows, 0 inbound FKs, 0 dependent views.

begin;

drop table if exists public.prospects restrict;

commit;
