-- ============================================================================
-- Invoice Audit Log: auto-log creation and status changes
-- ============================================================================

-- 1. Trigger function: log invoice creation
CREATE OR REPLACE FUNCTION log_subcontractor_invoice_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subcontractor_invoice_audit_log (
    invoice_id,
    event_type,
    field_name,
    new_value,
    notes,
    actor_user_id,
    created_at
  ) VALUES (
    NEW.id,
    'invoice.created',
    NULL,
    jsonb_build_object(
      'invoice_number', NEW.invoice_number,
      'status', NEW.status,
      'period_start', NEW.period_start,
      'period_end', NEW.period_end
    ),
    'Invoice created',
    NEW.created_by,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. Trigger function: log status changes
CREATE OR REPLACE FUNCTION log_subcontractor_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO subcontractor_invoice_audit_log (
      invoice_id,
      event_type,
      field_name,
      old_value,
      new_value,
      notes,
      created_at
    ) VALUES (
      NEW.id,
      'status.changed',
      'status',
      to_jsonb(OLD.status),
      to_jsonb(NEW.status),
      'Status changed from ' || COALESCE(OLD.status, 'none') || ' to ' || NEW.status,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Create triggers
DROP TRIGGER IF EXISTS trg_subcontractor_invoice_created ON subcontractor_invoices;
CREATE TRIGGER trg_subcontractor_invoice_created
  AFTER INSERT ON subcontractor_invoices
  FOR EACH ROW
  EXECUTE FUNCTION log_subcontractor_invoice_created();
DROP TRIGGER IF EXISTS trg_subcontractor_invoice_status_change ON subcontractor_invoices;
CREATE TRIGGER trg_subcontractor_invoice_status_change
  AFTER UPDATE ON subcontractor_invoices
  FOR EACH ROW
  EXECUTE FUNCTION log_subcontractor_invoice_status_change();
-- 4. Backfill: create "invoice.created" entries for existing invoices that have no audit log
INSERT INTO subcontractor_invoice_audit_log (
  invoice_id,
  event_type,
  field_name,
  new_value,
  notes,
  created_at
)
SELECT
  si.id,
  'invoice.created',
  NULL,
  jsonb_build_object(
    'invoice_number', si.invoice_number,
    'status', si.status,
    'period_start', si.period_start,
    'period_end', si.period_end
  ),
  'Invoice created',
  si.created_at
FROM subcontractor_invoices si
WHERE NOT EXISTS (
  SELECT 1 FROM subcontractor_invoice_audit_log al
  WHERE al.invoice_id = si.id
  AND al.event_type = 'invoice.created'
);
