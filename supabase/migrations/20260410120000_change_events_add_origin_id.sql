-- Add origin_id column to change_events for linking to a specific origin record
-- (e.g., a specific meeting, email, or RFI — not just the category)
ALTER TABLE change_events
  ADD COLUMN IF NOT EXISTS origin_id text;
COMMENT ON COLUMN change_events.origin_id IS 'ID of the specific origin record (meeting, email, or RFI) that spawned this change event';
