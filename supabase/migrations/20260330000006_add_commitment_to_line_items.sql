-- Add commitment tracking to change event line items
-- commitment_id stores the UUID of the subcontract or purchase order
-- commitment_type distinguishes between 'subcontract' and 'purchase_order'
ALTER TABLE change_event_line_items
  ADD COLUMN IF NOT EXISTS commitment_id uuid,
  ADD COLUMN IF NOT EXISTS commitment_type text CHECK (commitment_type IN ('subcontract', 'purchase_order')),
  ADD COLUMN IF NOT EXISTS commitment_line_item_id uuid;
-- Add index for commitment lookups
CREATE INDEX IF NOT EXISTS idx_ce_line_items_commitment
  ON change_event_line_items (commitment_id)
  WHERE commitment_id IS NOT NULL;
