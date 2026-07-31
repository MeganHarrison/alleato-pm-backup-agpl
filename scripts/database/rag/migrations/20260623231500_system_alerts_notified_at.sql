-- Notification throttling for system_alerts (pipeline outcome alerting).
--
-- The pipeline_alert_notifier pages the owner on Teams when a source goes dark.
-- notified_at records the last push so a still-broken source re-nags at most
-- every RENOTIFY_HOURS instead of every cron run.
--
-- Target DB: AI Database (RAG) — project fqcvmfqldlewvbsuxdvz.

ALTER TABLE public.system_alerts
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

COMMENT ON COLUMN public.system_alerts.notified_at IS
  'Last time this alert was pushed to an external channel (Teams). Drives re-nag throttling.';
