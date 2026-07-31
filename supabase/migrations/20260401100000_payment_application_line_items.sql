-- Add billing_period_id to payment applications
ALTER TABLE prime_contract_payment_applications
  ADD COLUMN IF NOT EXISTS billing_period_id uuid REFERENCES billing_periods(id),
  ADD COLUMN IF NOT EXISTS billing_date date,
  ADD COLUMN IF NOT EXISTS percent_complete numeric DEFAULT 0;
-- SOV line items per payment application (AIA G703)
CREATE TABLE IF NOT EXISTS payment_application_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_application_id uuid NOT NULL REFERENCES prime_contract_payment_applications(id) ON DELETE CASCADE,
  sov_item_id bigint REFERENCES prime_contract_sovs(id) ON DELETE SET NULL,
  change_order_id uuid REFERENCES contract_change_orders(id) ON DELETE SET NULL,
  item_number text NOT NULL,
  budget_code text,
  description text NOT NULL,
  scheduled_value numeric NOT NULL DEFAULT 0,
  work_completed_previous numeric NOT NULL DEFAULT 0,
  work_completed_this_period numeric NOT NULL DEFAULT 0,
  materials_stored numeric NOT NULL DEFAULT 0,
  total_completed numeric GENERATED ALWAYS AS (work_completed_previous + work_completed_this_period + materials_stored) STORED,
  percent_complete numeric GENERATED ALWAYS AS (
    CASE WHEN scheduled_value > 0
      THEN ROUND((work_completed_previous + work_completed_this_period + materials_stored) / scheduled_value * 100, 2)
      ELSE 0
    END
  ) STORED,
  balance_to_finish numeric GENERATED ALWAYS AS (
    scheduled_value - (work_completed_previous + work_completed_this_period + materials_stored)
  ) STORED,
  retainage_previous_work numeric NOT NULL DEFAULT 0,
  retainage_previous_materials numeric NOT NULL DEFAULT 0,
  retainage_this_period_work_pct numeric NOT NULL DEFAULT 0,
  retainage_this_period_work numeric NOT NULL DEFAULT 0,
  retainage_this_period_materials_pct numeric NOT NULL DEFAULT 0,
  retainage_this_period_materials numeric NOT NULL DEFAULT 0,
  retainage_released_work numeric NOT NULL DEFAULT 0,
  retainage_released_materials numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pa_line_items_application_id
  ON payment_application_line_items(payment_application_id);
ALTER TABLE payment_application_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view payment application line items"
  ON payment_application_line_items FOR SELECT USING (true);
CREATE POLICY "Users can insert payment application line items"
  ON payment_application_line_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update payment application line items"
  ON payment_application_line_items FOR UPDATE USING (true);
CREATE POLICY "Users can delete payment application line items"
  ON payment_application_line_items FOR DELETE USING (true);
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON payment_application_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
