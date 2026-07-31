-- Add email triage tracking columns to outlook_email_intake.
-- Written by the Microsoft executive assistant after classifying each email.

ALTER TABLE outlook_email_intake
  ADD COLUMN IF NOT EXISTS triage_action   text,
  ADD COLUMN IF NOT EXISTS triage_reason   text,
  ADD COLUMN IF NOT EXISTS triage_at       timestamptz,
  ADD COLUMN IF NOT EXISTS teams_alert_sent_at timestamptz;

-- Fast lookup: agent dedup gate (skip re-alerting same email)
CREATE INDEX IF NOT EXISTS idx_outlook_email_intake_teams_alert_sent_at
  ON outlook_email_intake (teams_alert_sent_at)
  WHERE teams_alert_sent_at IS NOT NULL;

-- Fast lookup: triage dashboard grouped by action + date
CREATE INDEX IF NOT EXISTS idx_outlook_email_intake_triage_action
  ON outlook_email_intake (triage_action, triage_at)
  WHERE triage_action IS NOT NULL;

COMMENT ON COLUMN outlook_email_intake.triage_action IS
  'Agent triage bucket: urgent | reply_needed | delegate | fyi | delete | watch';
COMMENT ON COLUMN outlook_email_intake.triage_reason IS
  'One-sentence reason the agent chose this triage action';
COMMENT ON COLUMN outlook_email_intake.triage_at IS
  'Timestamp when the executive assistant last triaged this email';
COMMENT ON COLUMN outlook_email_intake.teams_alert_sent_at IS
  'Timestamp of the last Teams DM alert sent for this email (dedup gate)';
