-- Migration: Create tables for Photos, Transmittals, Emails, and Documents tools
-- These mirror Procore's project-level communication and documentation tools

-- ─── Project Photos ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_photos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  description   TEXT,
  album         TEXT DEFAULT 'Default',
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_size     BIGINT DEFAULT 0,
  content_type  TEXT,
  width         INTEGER,
  height        INTEGER,
  date_taken    DATE,
  location      TEXT,
  trade         TEXT,
  tags          TEXT[] DEFAULT '{}',
  is_private    BOOLEAN DEFAULT FALSE,
  starred       BOOLEAN DEFAULT FALSE,
  uploaded_by   TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_project_photos_project ON project_photos(project_id);
CREATE INDEX idx_project_photos_album ON project_photos(project_id, album);
CREATE INDEX idx_project_photos_deleted ON project_photos(deleted_at) WHERE deleted_at IS NULL;
-- ─── Project Transmittals ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_transmittals (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number              TEXT NOT NULL,
  subject             TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Open', 'Closed', 'Void')),
  to_company          TEXT,
  to_contact          TEXT,
  from_company        TEXT,
  from_contact        TEXT,
  sent_date           DATE,
  due_date            DATE,
  received_date       DATE,
  remarks             TEXT,
  delivery_method     TEXT DEFAULT 'Email' CHECK (delivery_method IN ('Email', 'Hand Delivery', 'Mail', 'Courier', 'Fax', 'Other')),
  copies_sent         INTEGER DEFAULT 1,
  is_private          BOOLEAN DEFAULT FALSE,
  ball_in_court       TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_project_transmittals_project ON project_transmittals(project_id);
CREATE INDEX idx_project_transmittals_status ON project_transmittals(project_id, status);
CREATE INDEX idx_project_transmittals_deleted ON project_transmittals(deleted_at) WHERE deleted_at IS NULL;
-- Transmittal items (linked documents/drawings/etc.)
CREATE TABLE IF NOT EXISTS transmittal_items (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transmittal_id  BIGINT NOT NULL REFERENCES project_transmittals(id) ON DELETE CASCADE,
  item_type       TEXT NOT NULL DEFAULT 'Document' CHECK (item_type IN ('Document', 'Drawing', 'Submittal', 'Specification', 'Other')),
  item_title      TEXT NOT NULL,
  revision        TEXT,
  quantity         INTEGER DEFAULT 1,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transmittal_items_transmittal ON transmittal_items(transmittal_id);
-- ─── Project Emails ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_emails (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subject             TEXT NOT NULL,
  body                TEXT,
  body_html           TEXT,
  from_name           TEXT,
  from_email          TEXT,
  to_list             TEXT[] DEFAULT '{}',
  cc_list             TEXT[] DEFAULT '{}',
  bcc_list            TEXT[] DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Received', 'Failed')),
  sent_at             TIMESTAMPTZ,
  received_at         TIMESTAMPTZ,
  is_private          BOOLEAN DEFAULT FALSE,
  is_starred          BOOLEAN DEFAULT FALSE,
  has_attachments     BOOLEAN DEFAULT FALSE,
  related_tool        TEXT,
  related_id          TEXT,
  distribution_group  TEXT,
  thread_id           TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_project_emails_project ON project_emails(project_id);
CREATE INDEX idx_project_emails_status ON project_emails(project_id, status);
CREATE INDEX idx_project_emails_thread ON project_emails(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_project_emails_deleted ON project_emails(deleted_at) WHERE deleted_at IS NULL;
-- Email attachments
CREATE TABLE IF NOT EXISTS email_attachments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_id    BIGINT NOT NULL REFERENCES project_emails(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   BIGINT DEFAULT 0,
  content_type TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_email_attachments_email ON email_attachments(email_id);
-- ─── Project Documents ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_documents (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder          TEXT DEFAULT 'Root',
  title           TEXT NOT NULL,
  description     TEXT,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       BIGINT DEFAULT 0,
  content_type    TEXT,
  version         INTEGER DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Superseded', 'Archived')),
  category        TEXT,
  is_private      BOOLEAN DEFAULT FALSE,
  uploaded_by     TEXT,
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_project_documents_project ON project_documents(project_id);
CREATE INDEX idx_project_documents_folder ON project_documents(project_id, folder);
CREATE INDEX idx_project_documents_status ON project_documents(project_id, status);
CREATE INDEX idx_project_documents_deleted ON project_documents(deleted_at) WHERE deleted_at IS NULL;
-- ─── RLS Policies ────────────────────────────────────────────────────────────

ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_transmittals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transmittal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
-- Permissive policies for authenticated users
CREATE POLICY "Authenticated users can manage project_photos"
  ON project_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage project_transmittals"
  ON project_transmittals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage transmittal_items"
  ON transmittal_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage project_emails"
  ON project_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage email_attachments"
  ON email_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage project_documents"
  ON project_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
