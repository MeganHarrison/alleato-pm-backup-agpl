-- Microsoft Graph sync state tracker
-- Stores delta tokens for incremental sync of Outlook/Teams/OneDrive

CREATE TABLE IF NOT EXISTS graph_sync_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,           -- 'outlook_email', 'teams_message', 'onedrive_file'
    resource_id TEXT NOT NULL,      -- user_id, channel_id, drive_id, etc.
    resource_name TEXT,             -- human-readable label
    delta_token TEXT,               -- Microsoft Graph delta link for incremental sync
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | success | error
    error_message TEXT,
    items_synced INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_graph_sync_state_source ON graph_sync_state(source);
CREATE INDEX IF NOT EXISTS idx_graph_sync_state_last_sync ON graph_sync_state(last_sync_at);
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_graph_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_graph_sync_state_updated_at ON graph_sync_state;
CREATE TRIGGER trg_graph_sync_state_updated_at
    BEFORE UPDATE ON graph_sync_state
    FOR EACH ROW EXECUTE FUNCTION update_graph_sync_state_updated_at();
