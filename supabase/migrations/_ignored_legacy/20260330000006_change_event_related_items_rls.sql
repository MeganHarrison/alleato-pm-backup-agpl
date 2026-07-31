-- Enable RLS and add policies for change_event_related_items

ALTER TABLE public.change_event_related_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'change_event_related_items'
      AND policyname = 'change_event_related_items_select'
  ) THEN
    CREATE POLICY change_event_related_items_select
      ON public.change_event_related_items
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'change_event_related_items'
      AND policyname = 'change_event_related_items_insert'
  ) THEN
    CREATE POLICY change_event_related_items_insert
      ON public.change_event_related_items
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'change_event_related_items'
      AND policyname = 'change_event_related_items_delete'
  ) THEN
    CREATE POLICY change_event_related_items_delete
      ON public.change_event_related_items
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
