-- Store every synced Outlook email/attachment before project assignment.
-- project_emails/email_attachments remain the project-facing promoted records.

set statement_timeout = 0;
set lock_timeout = '5min';

BEGIN;

CREATE TABLE IF NOT EXISTS public.outlook_email_intake (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  graph_message_id TEXT NOT NULL,
  mailbox_user_id TEXT NOT NULL,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  project_email_id BIGINT REFERENCES public.project_emails(id) ON DELETE SET NULL,
  document_metadata_id TEXT,
  subject TEXT NOT NULL,
  body TEXT,
  body_html TEXT,
  body_text TEXT,
  from_name TEXT,
  from_email TEXT,
  to_list TEXT[] DEFAULT '{}',
  cc_list TEXT[] DEFAULT '{}',
  bcc_list TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Received' CHECK (status IN ('Received', 'Matched', 'Ignored', 'Error')),
  match_status TEXT NOT NULL DEFAULT 'unassigned' CHECK (match_status IN ('unassigned', 'matched', 'ignored', 'error')),
  assignment_method TEXT,
  assignment_confidence NUMERIC,
  received_at TIMESTAMPTZ,
  has_attachments BOOLEAN DEFAULT FALSE,
  web_link TEXT,
  internet_message_id TEXT,
  conversation_id TEXT,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_outlook_email_intake_graph_message
  ON public.outlook_email_intake(graph_message_id);

CREATE INDEX IF NOT EXISTS idx_outlook_email_intake_project
  ON public.outlook_email_intake(project_id)
  WHERE project_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outlook_email_intake_match_status
  ON public.outlook_email_intake(match_status, received_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outlook_email_intake_mailbox
  ON public.outlook_email_intake(mailbox_user_id, received_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outlook_email_intake_received
  ON public.outlook_email_intake(received_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.outlook_email_intake_attachments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  intake_email_id BIGINT NOT NULL REFERENCES public.outlook_email_intake(id) ON DELETE CASCADE,
  email_attachment_id BIGINT REFERENCES public.email_attachments(id) ON DELETE SET NULL,
  graph_attachment_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  content_type TEXT,
  checksum_sha256 TEXT,
  content BYTEA,
  extracted_text TEXT,
  is_inline BOOLEAN DEFAULT FALSE,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_outlook_email_intake_attachments_graph
  ON public.outlook_email_intake_attachments(intake_email_id, graph_attachment_id);

CREATE INDEX IF NOT EXISTS idx_outlook_email_intake_attachments_email
  ON public.outlook_email_intake_attachments(intake_email_id);

CREATE INDEX IF NOT EXISTS idx_outlook_email_intake_attachments_content_type
  ON public.outlook_email_intake_attachments(content_type)
  WHERE content_type IS NOT NULL;

ALTER TABLE public.outlook_email_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlook_email_intake_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outlook_email_intake_admin_only ON public.outlook_email_intake;
DROP POLICY IF EXISTS outlook_email_intake_service_role ON public.outlook_email_intake;
DROP POLICY IF EXISTS outlook_email_intake_attachments_admin_only ON public.outlook_email_intake_attachments;
DROP POLICY IF EXISTS outlook_email_intake_attachments_service_role ON public.outlook_email_intake_attachments;

CREATE POLICY outlook_email_intake_admin_only
  ON public.outlook_email_intake
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

CREATE POLICY outlook_email_intake_service_role
  ON public.outlook_email_intake
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY outlook_email_intake_attachments_admin_only
  ON public.outlook_email_intake_attachments
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

CREATE POLICY outlook_email_intake_attachments_service_role
  ON public.outlook_email_intake_attachments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
