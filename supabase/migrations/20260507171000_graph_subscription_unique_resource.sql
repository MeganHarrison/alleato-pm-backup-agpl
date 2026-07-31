-- Ensure source/resource pairs can be safely upserted by subscription lifecycle jobs.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create unique index if not exists graph_subscriptions_source_resource_unique_idx
  on public.graph_subscriptions(source, resource_id);

commit;
