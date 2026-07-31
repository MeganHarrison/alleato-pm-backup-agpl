-- Allow Teams compiler non-project initiative and sentiment signals in insights.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

alter table public.insights
  drop constraint if exists insights_type_check;

alter table public.insights
  add constraint insights_type_check
  check (
    type = any (
      array[
        'decision'::text,
        'risk'::text,
        'opportunity'::text,
        'action_item'::text,
        'sentiment'::text,
        'initiative_signal'::text,
        'issue'::text
      ]
    )
  );

commit;
