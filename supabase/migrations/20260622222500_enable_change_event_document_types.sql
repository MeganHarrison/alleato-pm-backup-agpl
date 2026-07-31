-- Enable document type assignment for change event attachments.
--
-- Change event attachments already use Pattern C through
-- public.change_event_documents.document_type. The shared document picker only
-- exposes taxonomy rows whose applies_to includes the entity type, so these
-- canonical construction document types must explicitly apply to change_event.

update public.document_type_taxonomy
set applies_to = array_append(applies_to, 'change_event')
where type_key in (
  'change_order',
  'rfi',
  'drawing',
  'estimate',
  'proposal',
  'specification',
  'photo',
  'email_attachment',
  'other'
)
and not ('change_event' = any(applies_to));
