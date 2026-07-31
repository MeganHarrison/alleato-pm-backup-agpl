-- Email events log: every transactional email sent via Resend is tracked here.
-- Resend webhook updates status as delivery events fire.

CREATE TABLE IF NOT EXISTS public.email_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id       text UNIQUE,
  template        text NOT NULL,
  to_email        text NOT NULL,
  from_email      text,
  subject         text,
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','sent','delivered','bounced','complained','opened','clicked','failed','suppressed','delivery_delayed')),
  entity_type     text,
  entity_id       text,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key text,
  error           jsonb,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  delivered_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_events_to_email     ON public.email_events (to_email);
CREATE INDEX IF NOT EXISTS idx_email_events_template     ON public.email_events (template);
CREATE INDEX IF NOT EXISTS idx_email_events_entity       ON public.email_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_email_events_status       ON public.email_events (status);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at   ON public.email_events (created_at DESC);
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
-- Only service role writes; authenticated users can read their own email history.
CREATE POLICY "Users can view their own email events"
  ON public.email_events
  FOR SELECT
  USING (user_id = auth.uid());
CREATE TRIGGER email_events_set_updated_at
  BEFORE UPDATE ON public.email_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
