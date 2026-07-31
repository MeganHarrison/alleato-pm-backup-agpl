-- Add invoice, meeting_minutes, and oac_meeting_minutes to the document type taxonomy.
-- These are manually-assigned types (not auto-classified from folder paths).

INSERT INTO public.document_type_taxonomy
  (type_key, display_name, category, applies_to, is_active, sort_order)
VALUES
  ('invoice',             'Invoice',             'financial', ARRAY['project'], true, 455),
  ('meeting_minutes',     'Meeting Minutes',     'other',     ARRAY['project'], true, 460),
  ('oac_meeting_minutes', 'OAC Meeting Minutes', 'other',     ARRAY['project'], true, 465)
ON CONFLICT (type_key) DO NOTHING;
