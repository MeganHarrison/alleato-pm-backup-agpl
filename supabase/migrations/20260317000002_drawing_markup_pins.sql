-- Drawing Markup Pins
-- Stores pins placed on drawings that link to RFIs, punch items, photos, other drawings, etc.

CREATE TABLE drawing_markup_pins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  drawing_id uuid NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Position on the drawing (percentage 0-100)
  x_pct numeric(6, 3) NOT NULL,
  y_pct numeric(6, 3) NOT NULL,
  page integer NOT NULL DEFAULT 1,

  -- Pin type / linked entity type
  pin_type text NOT NULL DEFAULT 'rfi',
  -- Supported: 'rfi' | 'punch_item' | 'coordination_issue' | 'drawing' | 'document' | 'photo' | 'task'

  -- Linked entity (text to support both uuid and integer PKs)
  entity_id text,
  entity_label text, -- display label (RFI subject, drawing number, etc.)
  entity_number text, -- human-readable number (#42, RFI-001, etc.)
  entity_status text, -- cached status for color coding

  -- Visual
  color text DEFAULT '#3b82f6',

  -- Audit
  -- App identity can be supplied by a trusted SSO bridge and is not always a
  -- row in auth.users. The API owns author validation before service writes.
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Index for fast lookup by drawing
CREATE INDEX drawing_markup_pins_drawing_id_idx ON drawing_markup_pins(drawing_id);
CREATE INDEX drawing_markup_pins_project_id_idx ON drawing_markup_pins(project_id);
-- RLS
ALTER TABLE drawing_markup_pins ENABLE ROW LEVEL SECURITY;
-- Authenticated users can view and create pins (matches drawing_sets/drawing_revisions pattern)
CREATE POLICY "Authenticated users can view drawing pins"
  ON drawing_markup_pins FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert drawing pins"
  ON drawing_markup_pins FOR INSERT
  TO authenticated
  WITH CHECK (true);
CREATE POLICY "Pin creator can delete drawing pins"
  ON drawing_markup_pins FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
-- Service role full access
CREATE POLICY "Service role full access to drawing pins"
  ON drawing_markup_pins FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
