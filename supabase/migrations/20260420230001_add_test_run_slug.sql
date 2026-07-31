-- Add human-readable slug to test_runs for cleaner URLs.
-- Format: {tool-name}-{suite-type}, with -N suffix for duplicates.
-- Generated at run creation time; NULL for older runs (they keep UUID-based URLs).
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS slug text UNIQUE;
