-- Persist per-project Change Events tool settings.
-- Mirrors the project-level Change Events configuration surface used in
-- Procore so one canonical settings owner can drive Alleato behavior.

CREATE TABLE IF NOT EXISTS public.change_event_project_settings (
  project_id integer PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  maintain_budget_codes_in_sync boolean NOT NULL DEFAULT false,
  display_revenue_rom_columns boolean NOT NULL DEFAULT true,
  display_unit_columns boolean NOT NULL DEFAULT false,
  allow_line_item_autopopulation boolean NOT NULL DEFAULT true,
  always_create_commitment_cos_using_latest_cost boolean NOT NULL DEFAULT false,
  copy_attachments_to_prime_pcos boolean NOT NULL DEFAULT false,
  copy_attachments_to_commitment_cos boolean NOT NULL DEFAULT false,
  budget_rom_in_scope text NOT NULL DEFAULT 'none'
    CHECK (budget_rom_in_scope IN ('latest_cost', 'latest_price', 'none')),
  budget_rom_out_of_scope text NOT NULL DEFAULT 'none'
    CHECK (budget_rom_out_of_scope IN ('latest_cost', 'latest_price', 'none')),
  budget_rom_tbd_scope text NOT NULL DEFAULT 'none'
    CHECK (budget_rom_tbd_scope IN ('latest_cost', 'latest_price', 'none')),
  prevent_budget_changes_and_prime_pcos_on_same_line_item boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id)
);

DROP TRIGGER IF EXISTS change_event_project_settings_updated_at
  ON public.change_event_project_settings;
CREATE TRIGGER change_event_project_settings_updated_at
  BEFORE UPDATE ON public.change_event_project_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.change_event_project_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS change_event_project_settings_select
  ON public.change_event_project_settings;
DROP POLICY IF EXISTS change_event_project_settings_insert
  ON public.change_event_project_settings;
DROP POLICY IF EXISTS change_event_project_settings_update
  ON public.change_event_project_settings;

CREATE POLICY change_event_project_settings_select
  ON public.change_event_project_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY change_event_project_settings_insert
  ON public.change_event_project_settings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY change_event_project_settings_update
  ON public.change_event_project_settings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
