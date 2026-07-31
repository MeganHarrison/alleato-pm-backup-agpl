-- Change Event related item links
-- Enables cross-references from a change event to other project records.

CREATE TABLE IF NOT EXISTS public.change_event_related_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events(id) ON DELETE CASCADE,
  related_type text NOT NULL,
  related_id text NOT NULL,
  related_number text,
  related_title text NOT NULL,
  related_status text,
  related_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_change_event_related_items_unique_link
  ON public.change_event_related_items (change_event_id, related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_change_event_related_items_event_created_desc
  ON public.change_event_related_items (change_event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_event_related_items_project_type
  ON public.change_event_related_items (project_id, related_type);
CREATE OR REPLACE FUNCTION public.set_change_event_related_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_change_event_related_items_updated_at
  ON public.change_event_related_items;
CREATE TRIGGER trg_change_event_related_items_updated_at
BEFORE UPDATE ON public.change_event_related_items
FOR EACH ROW
EXECUTE FUNCTION public.set_change_event_related_items_updated_at();
