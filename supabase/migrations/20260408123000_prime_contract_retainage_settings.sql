ALTER TABLE public.prime_contract_project_settings
  ADD COLUMN IF NOT EXISTS enable_completed_work_retainage boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_stored_materials_retainage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_retainage_percent numeric(5,2) NOT NULL DEFAULT 10;
ALTER TABLE public.prime_contract_project_settings
  DROP CONSTRAINT IF EXISTS prime_contract_project_settings_default_retainage_percent_check;
ALTER TABLE public.prime_contract_project_settings
  ADD CONSTRAINT prime_contract_project_settings_default_retainage_percent_check
  CHECK (
    default_retainage_percent >= 0
    AND default_retainage_percent <= 100
  );
COMMENT ON COLUMN public.prime_contract_project_settings.enable_completed_work_retainage
  IS 'Whether work completed this period should carry retainage by default on prime contract payment applications.';
COMMENT ON COLUMN public.prime_contract_project_settings.enable_stored_materials_retainage
  IS 'Whether stored materials should carry retainage by default on prime contract payment applications.';
COMMENT ON COLUMN public.prime_contract_project_settings.default_retainage_percent
  IS 'Default retainage percentage applied when a prime contract payment application is populated from SOV items.';
