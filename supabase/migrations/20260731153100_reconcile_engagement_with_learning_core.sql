begin;

-- Correct the first engagement migration before any application code writes to
-- it. `knowledge_content_item` is already the shared governed content identity;
-- retaining a parallel `learning_contents` table would create split ownership.
-- These tables contain only this task's two seed rows and no learner/session
-- activity, so the corrective drop loses no production behavior or data.
drop table public.learning_progress_events;
drop table public.learning_progress;
drop table public.learning_contents;
drop function public.set_learning_contents_updated_at();

-- Documentation-hosted walkthroughs are a distinct source owner. Their
-- playable media remains on Mintlify, while the governed identity lives in the
-- existing content catalog.
alter type public.knowledge_source_type add value if not exists 'docs';

comment on table public.app_usage_sessions is
  'Privacy-limited authenticated product-session receipts, not a page-view stream.';

notify pgrst, 'reload schema';

commit;
