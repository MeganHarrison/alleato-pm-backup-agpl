-- Estimate GC Templates
-- Stores saved general-conditions line-item sets that can be loaded into any estimate.

CREATE TABLE estimate_gc_templates (
  template_id  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  items        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE estimate_gc_templates ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read templates
CREATE POLICY "Authenticated users can read GC templates"
  ON estimate_gc_templates FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can insert templates
CREATE POLICY "Authenticated users can create GC templates"
  ON estimate_gc_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only the creator can delete their own templates
CREATE POLICY "Creators can delete their own GC templates"
  ON estimate_gc_templates FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
