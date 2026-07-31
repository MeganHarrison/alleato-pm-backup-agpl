-- Phase 4: Commitments Change History / Audit Log
--
-- Captures INSERT/UPDATE/DELETE on subcontracts and purchase_orders and stores
-- a per-field diff for UPDATE events. The ChangeHistoryTab reads from this
-- table via GET /api/commitments/:id/history.

CREATE TABLE IF NOT EXISTS public.commitment_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL,
  commitment_type text NOT NULL CHECK (commitment_type IN ('subcontract', 'purchase_order')),
  action        text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields jsonb,        -- { field: { old, new } } for UPDATE; full row snapshot for INSERT/DELETE
  actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commitment_audit_log_commitment
  ON public.commitment_audit_log (commitment_id, created_at DESC);
ALTER TABLE public.commitment_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS commitment_audit_log_select ON public.commitment_audit_log;
CREATE POLICY commitment_audit_log_select
  ON public.commitment_audit_log
  FOR SELECT
  TO authenticated
  USING (true);
-- Generic trigger function. Uses current_setting('request.jwt.claims', true)
-- to capture the acting user when available (set by Supabase on authenticated calls).
CREATE OR REPLACE FUNCTION public.log_commitment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commitment_type text;
  v_diff            jsonb := '{}'::jsonb;
  v_actor           uuid;
  v_key             text;
  v_old_json        jsonb;
  v_new_json        jsonb;
BEGIN
  v_commitment_type := CASE TG_TABLE_NAME
    WHEN 'subcontracts' THEN 'subcontract'
    WHEN 'purchase_orders' THEN 'purchase_order'
    ELSE TG_TABLE_NAME
  END;

  BEGIN
    v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commitment_audit_log
      (commitment_id, commitment_type, action, changed_fields, actor_id)
    VALUES (NEW.id, v_commitment_type, 'INSERT', to_jsonb(NEW), v_actor);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);

    FOR v_key IN SELECT jsonb_object_keys(v_new_json) LOOP
      -- Skip noisy audit columns
      IF v_key IN ('updated_at', 'created_at') THEN CONTINUE; END IF;
      IF v_old_json->v_key IS DISTINCT FROM v_new_json->v_key THEN
        v_diff := v_diff || jsonb_build_object(
          v_key,
          jsonb_build_object('old', v_old_json->v_key, 'new', v_new_json->v_key)
        );
      END IF;
    END LOOP;

    IF v_diff <> '{}'::jsonb THEN
      INSERT INTO public.commitment_audit_log
        (commitment_id, commitment_type, action, changed_fields, actor_id)
      VALUES (NEW.id, v_commitment_type, 'UPDATE', v_diff, v_actor);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.commitment_audit_log
      (commitment_id, commitment_type, action, changed_fields, actor_id)
    VALUES (OLD.id, v_commitment_type, 'DELETE', to_jsonb(OLD), v_actor);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_subcontracts ON public.subcontracts;
CREATE TRIGGER trg_audit_subcontracts
  AFTER INSERT OR UPDATE OR DELETE ON public.subcontracts
  FOR EACH ROW EXECUTE FUNCTION public.log_commitment_change();
DROP TRIGGER IF EXISTS trg_audit_purchase_orders ON public.purchase_orders;
CREATE TRIGGER trg_audit_purchase_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_commitment_change();
