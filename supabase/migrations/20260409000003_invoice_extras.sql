-- Migration: Add remaining invoice support tables + status enum update
-- - invoice_payments: payments issued tracking
-- - invoice_attachments: file attachments on invoices
-- - invoicing_settings: per-project configurable settings
-- - Add 'approved_as_noted' to invoice_status enum

-- ─── Add approved_as_noted to invoice_status enum ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'approved_as_noted'
      AND enumtypid = 'invoice_status'::regtype
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'approved_as_noted';
  END IF;
END $$;
-- ─── invoice_payments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_payments (
  id                      BIGSERIAL PRIMARY KEY,
  project_id              INTEGER       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_invoice_id        BIGINT        REFERENCES owner_invoices(id) ON DELETE CASCADE,
  subcontractor_invoice_id BIGINT       REFERENCES subcontractor_invoices(id) ON DELETE CASCADE,
  payment_number          TEXT,
  payment_method          TEXT          CHECK (payment_method IN ('check', 'credit_card', 'electronic', 'wire', 'ach', 'other')),
  amount                  NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_date            DATE,
  check_number            TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Exactly one invoice reference required
  CONSTRAINT chk_invoice_ref CHECK (
    (owner_invoice_id IS NOT NULL AND subcontractor_invoice_id IS NULL)
    OR
    (owner_invoice_id IS NULL AND subcontractor_invoice_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_project_id     ON invoice_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_owner_invoice  ON invoice_payments(owner_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_sub_invoice    ON invoice_payments(subcontractor_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date           ON invoice_payments(payment_date DESC);
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage invoice_payments"
  ON invoice_payments FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);
-- ─── invoice_attachments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_attachments (
  id                       BIGSERIAL PRIMARY KEY,
  owner_invoice_id         BIGINT        REFERENCES owner_invoices(id) ON DELETE CASCADE,
  subcontractor_invoice_id BIGINT        REFERENCES subcontractor_invoices(id) ON DELETE CASCADE,
  file_name                TEXT          NOT NULL,
  file_path                TEXT          NOT NULL,  -- Supabase Storage path
  file_size                BIGINT,
  mime_type                TEXT,
  uploaded_by              UUID          REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_attachment_invoice_ref CHECK (
    (owner_invoice_id IS NOT NULL AND subcontractor_invoice_id IS NULL)
    OR
    (owner_invoice_id IS NULL AND subcontractor_invoice_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_invoice_attach_owner   ON invoice_attachments(owner_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_attach_sub     ON invoice_attachments(subcontractor_invoice_id);
ALTER TABLE invoice_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage invoice_attachments"
  ON invoice_attachments FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);
-- ─── invoicing_settings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoicing_settings (
  id                                BIGSERIAL PRIMARY KEY,
  project_id                        INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  default_billing_start_day         INTEGER DEFAULT 1   CHECK (default_billing_start_day BETWEEN 1 AND 31),
  default_billing_end_day           INTEGER DEFAULT 31  CHECK (default_billing_end_day BETWEEN 1 AND 31),
  default_billing_due_day           INTEGER DEFAULT 25  CHECK (default_billing_due_day BETWEEN 1 AND 31),
  default_retainage_percent         NUMERIC(5,2) DEFAULT 10.00,
  allow_over_billing                BOOLEAN DEFAULT false,
  notify_subs_on_approval           BOOLEAN DEFAULT true,
  send_under_review_digest          BOOLEAN DEFAULT true,
  invite_reminder_frequency_days    INTEGER DEFAULT 0  CHECK (invite_reminder_frequency_days >= 0),
  invoice_pdf_footer_text           TEXT,
  invitation_custom_message         TEXT,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE invoicing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage invoicing_settings"
  ON invoicing_settings FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);
-- ─── Supabase Storage bucket for invoice attachments ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('invoice-attachments', 'invoice-attachments', false, 52428800)  -- 50MB
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Authenticated can upload invoice attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoice-attachments');
CREATE POLICY "Authenticated can read invoice attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoice-attachments');
CREATE POLICY "Authenticated can delete invoice attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoice-attachments');
