begin;

insert into public.docs_learning_source (id, title, source_url, playback_url, provider)
values
  ('prime-contracts/create-a-prime-contract', 'Create a prime contract walkthrough', 'https://docs.alleatogroup.com/prime-contracts/create-a-prime-contract', 'https://docs.alleatogroup.com/images/help/training-docs/create-a-prime-contract/create-a-prime-contract.mp4', 'html5'),
  ('invoicing/create-an-owner-invoice', 'Create an owner invoice walkthrough', 'https://docs.alleatogroup.com/invoicing/create-an-owner-invoice', 'https://docs.alleatogroup.com/images/help/training-docs/create-an-owner-invoice/session.webm', 'html5')
on conflict (id) do update set
  title = excluded.title,
  source_url = excluded.source_url,
  playback_url = excluded.playback_url,
  provider = excluded.provider,
  updated_at = now();

insert into public.knowledge_content_item (
  slug, title, summary, content_kind, lifecycle_status, visibility,
  source_type, source_id, source_url, published_at, display_area, metadata
)
values
  ('docs-create-prime-contract-walkthrough', 'Create a prime contract walkthrough', 'Narrated prime-contract setup walkthrough hosted in Alleato documentation.', 'video', 'published', 'internal', 'docs', 'prime-contracts/create-a-prime-contract', 'https://docs.alleatogroup.com/prime-contracts/create-a-prime-contract', now(), 'training', jsonb_build_object('playback_url', 'https://docs.alleatogroup.com/images/help/training-docs/create-a-prime-contract/create-a-prime-contract.mp4', 'provider', 'html5')),
  ('docs-create-owner-invoice-walkthrough', 'Create an owner invoice walkthrough', 'Owner-invoice walkthrough hosted in Alleato documentation.', 'video', 'published', 'internal', 'docs', 'invoicing/create-an-owner-invoice', 'https://docs.alleatogroup.com/invoicing/create-an-owner-invoice', now(), 'training', jsonb_build_object('playback_url', 'https://docs.alleatogroup.com/images/help/training-docs/create-an-owner-invoice/session.webm', 'provider', 'html5'))
on conflict (source_type, source_id) do update
set
  title = excluded.title,
  summary = excluded.summary,
  source_url = excluded.source_url,
  lifecycle_status = 'published',
  published_at = coalesce(public.knowledge_content_item.published_at, excluded.published_at),
  display_area = 'training',
  metadata = excluded.metadata,
  updated_at = now();

notify pgrst, 'reload schema';

commit;
