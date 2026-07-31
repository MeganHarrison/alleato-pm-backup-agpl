-- RLS policies for drawing-related tables
-- Allow authenticated users to perform CRUD operations
-- Wrapped in DO blocks for idempotency

-- drawing_sets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert drawing sets' AND tablename = 'drawing_sets') THEN
    CREATE POLICY "Authenticated users can insert drawing sets" ON public.drawing_sets FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update drawing sets' AND tablename = 'drawing_sets') THEN
    CREATE POLICY "Authenticated users can update drawing sets" ON public.drawing_sets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete drawing sets' AND tablename = 'drawing_sets') THEN
    CREATE POLICY "Authenticated users can delete drawing sets" ON public.drawing_sets FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
-- drawing_areas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert drawing areas' AND tablename = 'drawing_areas') THEN
    CREATE POLICY "Authenticated users can insert drawing areas" ON public.drawing_areas FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update drawing areas' AND tablename = 'drawing_areas') THEN
    CREATE POLICY "Authenticated users can update drawing areas" ON public.drawing_areas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete drawing areas' AND tablename = 'drawing_areas') THEN
    CREATE POLICY "Authenticated users can delete drawing areas" ON public.drawing_areas FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
-- drawing_revisions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert drawing revisions' AND tablename = 'drawing_revisions') THEN
    CREATE POLICY "Authenticated users can insert drawing revisions" ON public.drawing_revisions FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update drawing revisions' AND tablename = 'drawing_revisions') THEN
    CREATE POLICY "Authenticated users can update drawing revisions" ON public.drawing_revisions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
-- drawing_downloads
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert drawing downloads' AND tablename = 'drawing_downloads') THEN
    CREATE POLICY "Authenticated users can insert drawing downloads" ON public.drawing_downloads FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
