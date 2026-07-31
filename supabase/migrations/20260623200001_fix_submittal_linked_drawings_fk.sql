-- Add FK from drawing_id → drawings.id (ON DELETE CASCADE so unlinking the drawing auto-cleans)
ALTER TABLE public.submittal_linked_drawings
  ADD CONSTRAINT submittal_linked_drawings_drawing_id_fkey
  FOREIGN KEY (drawing_id)
  REFERENCES public.drawings(id)
  ON DELETE CASCADE;

-- Enforce uniqueness: same drawing can only be linked to same submittal once
ALTER TABLE public.submittal_linked_drawings
  ADD CONSTRAINT uq_submittal_linked_drawings
  UNIQUE (submittal_id, drawing_id);

-- Indexes for fast lookups in both directions
CREATE INDEX IF NOT EXISTS idx_submittal_linked_drawings_submittal_id
  ON public.submittal_linked_drawings(submittal_id);

CREATE INDEX IF NOT EXISTS idx_submittal_linked_drawings_drawing_id
  ON public.submittal_linked_drawings(drawing_id);
