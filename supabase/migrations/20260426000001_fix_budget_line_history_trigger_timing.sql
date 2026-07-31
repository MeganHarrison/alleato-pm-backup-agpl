-- Fix budget-line history trigger timing for upsert conflict paths.
--
-- BEFORE INSERT history writes can reference the speculative row ID from an
-- INSERT ... ON CONFLICT attempt. When the insert turns into an update, the
-- speculative row is not persisted and the deferred budget_line_history FK can
-- fail at commit. Insert/update history belongs AFTER the budget_lines row is
-- durable; delete history still belongs BEFORE the parent row is removed.

CREATE OR REPLACE FUNCTION public.track_budget_line_changes_after_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO budget_line_history (
      budget_line_id, project_id, field_name, old_value, new_value,
      changed_by, change_type
    ) VALUES
      (NEW.id, NEW.project_id, 'quantity', NULL, NEW.quantity::TEXT, COALESCE(NEW.created_by, auth.uid()), 'create'),
      (NEW.id, NEW.project_id, 'unit_cost', NULL, NEW.unit_cost::TEXT, COALESCE(NEW.created_by, auth.uid()), 'create'),
      (NEW.id, NEW.project_id, 'description', NULL, COALESCE(NEW.description, ''), COALESCE(NEW.created_by, auth.uid()), 'create');
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.quantity IS DISTINCT FROM NEW.quantity) THEN
      INSERT INTO budget_line_history (
        budget_line_id, project_id, field_name, old_value, new_value,
        changed_by, change_type
      )
      VALUES (
        NEW.id, NEW.project_id, 'quantity', OLD.quantity::TEXT, NEW.quantity::TEXT,
        COALESCE(NEW.updated_by, auth.uid()), 'update'
      );
    END IF;

    IF (OLD.unit_cost IS DISTINCT FROM NEW.unit_cost) THEN
      INSERT INTO budget_line_history (
        budget_line_id, project_id, field_name, old_value, new_value,
        changed_by, change_type
      )
      VALUES (
        NEW.id, NEW.project_id, 'unit_cost', OLD.unit_cost::TEXT, NEW.unit_cost::TEXT,
        COALESCE(NEW.updated_by, auth.uid()), 'update'
      );
    END IF;

    IF (OLD.description IS DISTINCT FROM NEW.description) THEN
      INSERT INTO budget_line_history (
        budget_line_id, project_id, field_name, old_value, new_value,
        changed_by, change_type
      )
      VALUES (
        NEW.id, NEW.project_id, 'description', COALESCE(OLD.description, ''), COALESCE(NEW.description, ''),
        COALESCE(NEW.updated_by, auth.uid()), 'update'
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.track_budget_line_delete_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO budget_line_history (
    budget_line_id, project_id, field_name, old_value, new_value,
    changed_by, change_type
  )
  VALUES (
    OLD.id, OLD.project_id, 'deleted', 'active', 'deleted',
    COALESCE(OLD.updated_by, OLD.created_by, auth.uid()), 'delete'
  );

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS budget_line_changes_trigger ON public.budget_lines;
DROP TRIGGER IF EXISTS budget_line_changes_after_write ON public.budget_lines;
DROP TRIGGER IF EXISTS budget_line_delete_before ON public.budget_lines;
CREATE TRIGGER budget_line_changes_after_write
AFTER INSERT OR UPDATE ON public.budget_lines
FOR EACH ROW
EXECUTE FUNCTION public.track_budget_line_changes_after_write();
CREATE TRIGGER budget_line_delete_before
BEFORE DELETE ON public.budget_lines
FOR EACH ROW
EXECUTE FUNCTION public.track_budget_line_delete_before();
REVOKE EXECUTE ON FUNCTION public.track_budget_line_changes_after_write() FROM anon;
REVOKE EXECUTE ON FUNCTION public.track_budget_line_delete_before() FROM anon;
GRANT EXECUTE ON FUNCTION public.track_budget_line_changes_after_write() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.track_budget_line_delete_before() TO authenticated, service_role;
