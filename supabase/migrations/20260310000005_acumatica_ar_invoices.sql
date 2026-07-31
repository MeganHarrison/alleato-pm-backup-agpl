-- Acumatica AR Invoices (header + line items)
CREATE TABLE IF NOT EXISTS acumatica_ar_invoices (
  id              BIGSERIAL PRIMARY KEY,
  reference_nbr   TEXT NOT NULL,
  type            TEXT,                        -- Invoice, Credit Memo, Debit Memo
  status          TEXT,                        -- Open, Closed, Hold, Voided
  date            DATE,
  post_period     TEXT,                        -- e.g. "092022"
  customer        TEXT,                        -- Acumatica customer ID
  project         TEXT,                        -- Acumatica project code
  description     TEXT,
  amount          NUMERIC(14,2),
  balance         NUMERIC(14,2),
  tax_total       NUMERIC(14,2),
  hold            BOOLEAN,
  link_ar_account TEXT,
  acumatica_sync_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT acumatica_ar_invoices_reference_nbr_type_key UNIQUE (reference_nbr, type)
);
CREATE TABLE IF NOT EXISTS acumatica_ar_invoice_lines (
  id                      BIGSERIAL PRIMARY KEY,
  invoice_id              BIGINT NOT NULL REFERENCES acumatica_ar_invoices(id) ON DELETE CASCADE,
  line_nbr                INTEGER,
  transaction_description TEXT,
  qty                     NUMERIC(14,4),
  unit_price              NUMERIC(14,2),
  extended_price          NUMERIC(14,2),
  amount                  NUMERIC(14,2),
  discount_amount         NUMERIC(14,2),
  account                 TEXT,
  cost_code               TEXT,
  project_task            TEXT,
  tax_category            TEXT,
  uom                     TEXT,
  created_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_ar_invoice_lines_invoice_id_idx ON acumatica_ar_invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS acumatica_ar_invoices_customer_idx ON acumatica_ar_invoices(customer);
CREATE INDEX IF NOT EXISTS acumatica_ar_invoices_project_idx ON acumatica_ar_invoices(project);
CREATE INDEX IF NOT EXISTS acumatica_ar_invoices_status_idx ON acumatica_ar_invoices(status);
