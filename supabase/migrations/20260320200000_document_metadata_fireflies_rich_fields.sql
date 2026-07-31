-- Add structured Fireflies fields to document_metadata
-- These columns were always fetched from the Fireflies GraphQL API but
-- previously discarded because ingest_markdown_text only stored 14 fields.
-- The pipeline now passes them via extra_metadata so every sync populates them.

ALTER TABLE document_metadata
  ADD COLUMN IF NOT EXISTS organizer_email TEXT,
  ADD COLUMN IF NOT EXISTS host_email TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS sentiment JSONB,
  ADD COLUMN IF NOT EXISTS keywords TEXT[],
  ADD COLUMN IF NOT EXISTS meeting_type TEXT,
  ADD COLUMN IF NOT EXISTS topics_discussed TEXT[],
  ADD COLUMN IF NOT EXISTS speakers JSONB,
  ADD COLUMN IF NOT EXISTS analytics JSONB,
  ADD COLUMN IF NOT EXISTS transcript_chapters TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS outline TEXT,
  ADD COLUMN IF NOT EXISTS extended_sections JSONB,
  ADD COLUMN IF NOT EXISTS meeting_attendees JSONB,
  ADD COLUMN IF NOT EXISTS meeting_attendance JSONB,
  ADD COLUMN IF NOT EXISTS channels JSONB,
  ADD COLUMN IF NOT EXISTS is_silent_meeting BOOLEAN,
  ADD COLUMN IF NOT EXISTS calendar_type TEXT,
  ADD COLUMN IF NOT EXISTS privacy TEXT;
-- Indexes for searchable fields
CREATE INDEX IF NOT EXISTS idx_document_metadata_organizer_email ON document_metadata(organizer_email);
CREATE INDEX IF NOT EXISTS idx_document_metadata_meeting_type ON document_metadata(meeting_type);
CREATE INDEX IF NOT EXISTS idx_document_metadata_keywords ON document_metadata USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_document_metadata_topics ON document_metadata USING gin(topics_discussed);
