-- Add explicit retainage settings to prime_contract_project_settings.
-- These were previously returned as fake defaults from DEFAULT_SETTINGS in the API
-- but were never persisted. Adding real columns so user choices are stored.
ALTER TABLE prime_contract_project_settings
  ADD COLUMN IF NOT EXISTS enable_completed_work_retainage BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_stored_materials_retainage BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_retainage_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
COMMENT ON COLUMN prime_contract_project_settings.enable_completed_work_retainage IS
  'When true, retainage is withheld on completed work amounts in payment applications.';
COMMENT ON COLUMN prime_contract_project_settings.enable_stored_materials_retainage IS
  'When true, retainage is withheld on stored materials amounts in payment applications.';
COMMENT ON COLUMN prime_contract_project_settings.default_retainage_percent IS
  'Default retainage percentage (0–100) applied when populating a new payment application SOV. '
  'Procore model: opt-in, 0% until the owner explicitly sets a rate.';
