-- Secure admin-only communications tables used by the AI assistant and internal tools.
--
-- Requirement (product): Only admins can see Teams and Emails.
-- This migration hardens RLS for:
-- - project_emails + email_attachments (app email surface)
-- - team_chat_messages (internal Teams-like chat surface)
--
-- Notes:
-- - Service role retains full access for ingestion/backfills.
-- - Admin gating uses public.current_is_app_admin() (defined in
--   20260427130000_secure_rag_documents_rls.sql).

set statement_timeout = 0;
set lock_timeout = '5min';

BEGIN;

-- ---------------------------------------------------------------------------
-- project_emails
-- ---------------------------------------------------------------------------

ALTER TABLE public.project_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage project_emails" ON public.project_emails;
DROP POLICY IF EXISTS project_emails_admin_only ON public.project_emails;
DROP POLICY IF EXISTS project_emails_service_role ON public.project_emails;

CREATE POLICY project_emails_admin_only
  ON public.project_emails
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

CREATE POLICY project_emails_service_role
  ON public.project_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- email_attachments
-- ---------------------------------------------------------------------------

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage email_attachments" ON public.email_attachments;
DROP POLICY IF EXISTS email_attachments_admin_only ON public.email_attachments;
DROP POLICY IF EXISTS email_attachments_service_role ON public.email_attachments;

CREATE POLICY email_attachments_admin_only
  ON public.email_attachments
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

CREATE POLICY email_attachments_service_role
  ON public.email_attachments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- team_chat_messages
-- ---------------------------------------------------------------------------

ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read team chat messages" ON public.team_chat_messages;
DROP POLICY IF EXISTS "authenticated users can insert team chat messages" ON public.team_chat_messages;
DROP POLICY IF EXISTS team_chat_messages_admin_read ON public.team_chat_messages;
DROP POLICY IF EXISTS team_chat_messages_admin_insert ON public.team_chat_messages;
DROP POLICY IF EXISTS team_chat_messages_service_role ON public.team_chat_messages;

CREATE POLICY team_chat_messages_admin_read
  ON public.team_chat_messages
  FOR SELECT
  TO authenticated
  USING (public.current_is_app_admin());

CREATE POLICY team_chat_messages_admin_insert
  ON public.team_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_is_app_admin() AND auth.uid() = user_id);

CREATE POLICY team_chat_messages_service_role
  ON public.team_chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
