-- Commitment Related Items table
-- Links arbitrary records to a commitment (subcontract or purchase_order).
-- No FK to a single commitments table because commitments are split across
-- subcontracts + purchase_orders tables; commitment_id is a plain uuid.

CREATE TABLE IF NOT EXISTS commitment_related_items (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       integer     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  commitment_id    uuid        NOT NULL,
  commitment_type  text        NOT NULL CHECK (commitment_type IN ('subcontract', 'purchase_order')),
  related_type     text        NOT NULL,
  related_id       text        NOT NULL,
  related_number   text,
  related_title    text        NOT NULL,
  related_status   text,
  related_url      text,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commitment_id, related_type, related_id)
);
ALTER TABLE commitment_related_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commitment_related_items_select"
  ON commitment_related_items FOR SELECT USING (true);
CREATE POLICY "commitment_related_items_insert"
  ON commitment_related_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "commitment_related_items_delete"
  ON commitment_related_items FOR DELETE
  USING (auth.uid() IS NOT NULL);
