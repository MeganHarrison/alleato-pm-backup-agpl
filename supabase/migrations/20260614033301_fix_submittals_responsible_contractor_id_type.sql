-- Migration: fix submittals.responsible_contractor_id column type
--
-- Root cause: the column was created as INTEGER but responsible_contractor_id
-- is meant to reference companies.id which is a UUID. The integer type caused
-- z.coerce.number() in the API routes to convert UUID strings to NaN, silently
-- dropping the field on every create/update. No FK constraint exists on this
-- column so the type change is safe and requires no cascade updates.
--
-- Because the coercion bug has always prevented any value from being stored,
-- all existing rows have responsible_contractor_id = NULL, so there is no data
-- to migrate.

ALTER TABLE submittals
  ALTER COLUMN responsible_contractor_id TYPE uuid USING NULL;
