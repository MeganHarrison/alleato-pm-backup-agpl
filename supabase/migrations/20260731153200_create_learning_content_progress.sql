begin;

-- Per-user state belongs to the learning system and references its canonical
-- identity (`knowledge_content_item`). It intentionally does not duplicate the
-- training-resource catalog or the training-doc authoring model.
create table public.learning_content_progress (
  content_item_id uuid not null
    references public.knowledge_content_item(id) on delete cascade,
  learner_id uuid not null
    references public.user_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  highest_checkpoint smallint not null default 0,
  completed_at timestamptz null,
  watch_seconds integer not null default 0,
  last_position_seconds integer not null default 0,
  primary key (content_item_id, learner_id),
  constraint learning_content_progress_checkpoint_check
    check (highest_checkpoint in (0, 25, 50, 75, 90)),
  constraint learning_content_progress_watch_seconds_nonnegative_check
    check (watch_seconds >= 0),
  constraint learning_content_progress_position_nonnegative_check
    check (last_position_seconds >= 0),
  constraint learning_content_progress_completion_checkpoint_check
    check (completed_at is null or highest_checkpoint = 90)
);

create index learning_content_progress_learner_last_viewed_idx
  on public.learning_content_progress (learner_id, last_viewed_at desc);
create index learning_content_progress_content_last_viewed_idx
  on public.learning_content_progress (content_item_id, last_viewed_at desc);

alter table public.learning_content_progress enable row level security;

revoke all on table public.learning_content_progress from anon, authenticated;
grant select on table public.learning_content_progress to authenticated;
grant select, insert, update, delete on table public.learning_content_progress to service_role;

create policy learning_content_progress_select_owner_or_admin
  on public.learning_content_progress
  for select to authenticated
  using (
    learner_id = auth.uid()
    or public.current_is_learning_admin()
  );

comment on table public.learning_content_progress is
  'Current privacy-limited video progress per learner and canonical knowledge content identity.';

notify pgrst, 'reload schema';

commit;
