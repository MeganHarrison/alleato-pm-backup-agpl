begin;

-- A keyed advisory lock makes checkpoint accumulation and milestone events one
-- atomic transition even when a player sends adjacent heartbeats concurrently.
create or replace function public.record_video_learning_progress(
  p_content_item_id uuid,
  p_learner_id uuid,
  p_checkpoint smallint,
  p_position_seconds integer,
  p_watched_seconds integer,
  p_app_session_id uuid default null
)
returns table (checkpoint smallint, completed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prior public.learning_content_progress%rowtype;
  next_checkpoint smallint;
  completed_at_value timestamptz;
begin
  if p_checkpoint not in (0, 25, 50, 75, 90) or p_position_seconds < 0 or p_watched_seconds < 0 or p_watched_seconds > 120 then
    raise exception using errcode = '22023', message = 'Video progress payload is outside the accepted checkpoint or time bounds.';
  end if;
  if not exists (
    select 1 from public.knowledge_content_item item
    where item.id = p_content_item_id
      and item.content_kind = 'video'
      and item.source_type in ('training_resource', 'docs')
  ) then
    raise exception using errcode = '23503', message = 'Video progress must reference a supported cataloged video lesson.';
  end if;
  if p_app_session_id is not null and not exists (
    select 1 from public.app_usage_sessions session
    where session.id = p_app_session_id and session.user_id = p_learner_id
  ) then
    raise exception using errcode = '23503', message = 'Video progress references an unknown application session.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_content_item_id::text || p_learner_id::text));
  select * into prior from public.learning_content_progress
  where content_item_id = p_content_item_id and learner_id = p_learner_id;
  next_checkpoint := greatest(coalesce(prior.highest_checkpoint, 0), p_checkpoint);
  completed_at_value := case when next_checkpoint = 90 then coalesce(prior.completed_at, now()) else null end;

  insert into public.learning_content_progress (
    content_item_id, learner_id, highest_checkpoint, last_position_seconds,
    watch_seconds, last_viewed_at, completed_at
  ) values (
    p_content_item_id, p_learner_id, next_checkpoint, p_position_seconds,
    coalesce(prior.watch_seconds, 0) + p_watched_seconds, now(), completed_at_value
  ) on conflict (content_item_id, learner_id) do update set
    highest_checkpoint = excluded.highest_checkpoint,
    last_position_seconds = excluded.last_position_seconds,
    watch_seconds = excluded.watch_seconds,
    last_viewed_at = excluded.last_viewed_at,
    completed_at = excluded.completed_at;

  if prior.content_item_id is null or next_checkpoint > prior.highest_checkpoint then
    insert into public.learning_event (learner_id, actor_user_id, event_type, object_type, object_id, context)
    values (
      p_learner_id, p_learner_id,
      case when next_checkpoint = 0 then 'video_started' when next_checkpoint = 90 then 'video_completed' else 'video_checkpoint' end,
      'knowledge_content_item', p_content_item_id::text,
      jsonb_build_object('checkpoint', next_checkpoint, 'position_seconds', p_position_seconds, 'watch_seconds', p_watched_seconds)
        || case when p_app_session_id is null then '{}'::jsonb else jsonb_build_object('app_session_id', p_app_session_id) end
    );
  end if;
  return query select next_checkpoint, next_checkpoint = 90;
end;
$$;

revoke all on function public.record_video_learning_progress(uuid, uuid, smallint, integer, integer, uuid) from public;
grant execute on function public.record_video_learning_progress(uuid, uuid, smallint, integer, integer, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
