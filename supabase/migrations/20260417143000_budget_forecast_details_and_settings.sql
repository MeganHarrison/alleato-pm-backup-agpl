-- Persist per-project budget settings and per-line forecast detail rows.
-- These tables back Forecast to Complete parity behaviors (manual entries,
-- monitored resources, and persisted settings).

CREATE TABLE IF NOT EXISTS public.project_budget_settings (
  project_id integer PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  red_negative_values boolean NOT NULL DEFAULT true,
  autocalculate_forecast_to_complete boolean NOT NULL DEFAULT true,
  enable_advanced_forecasting boolean NOT NULL DEFAULT true,
  allow_modifying_grand_total boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id)
);
CREATE TABLE IF NOT EXISTS public.budget_forecast_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  budget_line_id uuid NOT NULL REFERENCES public.budget_lines(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  method varchar(50) NOT NULL CHECK (method IN ('manual', 'monitored_resources')),
  description text NOT NULL DEFAULT '',
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  units varchar(32) NULL DEFAULT 'ls',
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  utilization_rate numeric(5,2) NULL,
  start_date date NULL,
  end_date date NULL,
  units_remaining_mode varchar(16) NULL CHECK (units_remaining_mode IN ('weeks', 'months')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id),
  updated_by uuid NULL REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_budget_forecast_line_items_budget_line_id
  ON public.budget_forecast_line_items (budget_line_id);
CREATE INDEX IF NOT EXISTS idx_budget_forecast_line_items_project_id
  ON public.budget_forecast_line_items (project_id);
CREATE INDEX IF NOT EXISTS idx_budget_forecast_line_items_forecast_date
  ON public.budget_forecast_line_items (forecast_date DESC);
DROP TRIGGER IF EXISTS project_budget_settings_updated_at ON public.project_budget_settings;
CREATE TRIGGER project_budget_settings_updated_at
  BEFORE UPDATE ON public.project_budget_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS budget_forecast_line_items_updated_at ON public.budget_forecast_line_items;
CREATE TRIGGER budget_forecast_line_items_updated_at
  BEFORE UPDATE ON public.budget_forecast_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.project_budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_forecast_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_budget_settings_select ON public.project_budget_settings;
DROP POLICY IF EXISTS project_budget_settings_insert ON public.project_budget_settings;
DROP POLICY IF EXISTS project_budget_settings_update ON public.project_budget_settings;
CREATE POLICY project_budget_settings_select
  ON public.project_budget_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY project_budget_settings_insert
  ON public.project_budget_settings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY project_budget_settings_update
  ON public.project_budget_settings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS budget_forecast_line_items_select ON public.budget_forecast_line_items;
DROP POLICY IF EXISTS budget_forecast_line_items_insert ON public.budget_forecast_line_items;
DROP POLICY IF EXISTS budget_forecast_line_items_update ON public.budget_forecast_line_items;
DROP POLICY IF EXISTS budget_forecast_line_items_delete ON public.budget_forecast_line_items;
CREATE POLICY budget_forecast_line_items_select
  ON public.budget_forecast_line_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY budget_forecast_line_items_insert
  ON public.budget_forecast_line_items
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY budget_forecast_line_items_update
  ON public.budget_forecast_line_items
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY budget_forecast_line_items_delete
  ON public.budget_forecast_line_items
  FOR DELETE
  USING (auth.uid() IS NOT NULL);
