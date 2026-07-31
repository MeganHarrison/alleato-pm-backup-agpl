-- Fix subcontractor invoice audit trigger status text rendering.
-- The prior COALESCE(OLD.status, 'none') coerced 'none' into invoice_status,
-- which blocks valid status transitions because 'none' is not an enum value.

CREATE OR REPLACE FUNCTION public.log_subcontractor_invoice_status_change()
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
      'Status changed from ' || COALESCE(OLD.status::text, 'none') || ' to ' || NEW.status::text,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
