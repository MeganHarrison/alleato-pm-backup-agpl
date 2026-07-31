-- spec_drawing_links
-- Junction table linking specification sections to drawings.
-- Enables the AI to answer: "for spec section X, what drawings cover it
-- and what submittal packages are required?"
--
-- specifications.id (uuid) is the source of truth that submittals already
-- reference via submittals.specification_id — using the same table keeps
-- the triangle consistent: spec → drawings, spec → submittals.

CREATE TABLE IF NOT EXISTS public.spec_drawing_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specification_id uuid NOT NULL
    REFERENCES public.specifications(id) ON DELETE CASCADE,
  drawing_id     uuid NOT NULL
    REFERENCES public.drawings(id) ON DELETE CASCADE,
  link_method    text NOT NULL DEFAULT 'manual'
    CHECK (link_method IN ('manual', 'ai_suggested', 'auto_keyword')),
  confidence     numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id),
  UNIQUE (specification_id, drawing_id)
);

-- Fast lookup: all drawings for a spec section
CREATE INDEX idx_spec_drawing_links_spec
  ON public.spec_drawing_links (specification_id);

-- Fast lookup: all spec sections a drawing covers
CREATE INDEX idx_spec_drawing_links_drawing
  ON public.spec_drawing_links (drawing_id);

-- RLS: readable by authenticated users, writable by project members
ALTER TABLE public.spec_drawing_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spec_drawing_links_select"
  ON public.spec_drawing_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "spec_drawing_links_insert"
  ON public.spec_drawing_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "spec_drawing_links_update"
  ON public.spec_drawing_links FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "spec_drawing_links_delete"
  ON public.spec_drawing_links FOR DELETE
  TO authenticated
  USING (true);
