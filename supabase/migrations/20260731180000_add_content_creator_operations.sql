begin;

create index if not exists learning_content_progress_content_last_viewed_idx
  on public.learning_content_progress (content_item_id, last_viewed_at desc);

create index if not exists learning_course_item_content_item_idx
  on public.learning_course_item (content_item_id);

create or replace function public.get_knowledge_content_engagement_summary()
returns table (
  content_item_id uuid,
  tracking_supported boolean,
  unique_viewers bigint,
  completed_count bigint,
  completion_rate numeric,
  watch_seconds bigint,
  last_engaged_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception
      using
        errcode = '42501',
        message = 'Content engagement reporting requires an authenticated user.';
  end if;

  if not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Content engagement reporting requires learning administrator access.';
  end if;

  return query
  with activity as (
    select
      progress.content_item_id,
      progress.learner_id,
      progress.completed_at is not null as completed,
      progress.watch_seconds::bigint as watch_seconds,
      progress.last_viewed_at as last_engaged_at
    from public.learning_content_progress progress

    union all

    select
      course.content_item_id,
      enrollment.learner_id,
      enrollment.completed_at is not null
        or enrollment.status = 'completed' as completed,
      0::bigint as watch_seconds,
      coalesce(
        enrollment.completed_at,
        enrollment.updated_at,
        enrollment.started_at
      ) as last_engaged_at
    from public.learning_enrollment enrollment
    join public.learning_course course on course.id = enrollment.course_id
    where enrollment.started_at is not null
      or enrollment.completed_at is not null
      or enrollment.status = 'completed'

    union all

    select
      course_item.content_item_id,
      enrollment.learner_id,
      item_progress.completed_at is not null
        or item_progress.status = 'completed' as completed,
      0::bigint as watch_seconds,
      coalesce(
        item_progress.completed_at,
        item_progress.updated_at,
        item_progress.started_at
      ) as last_engaged_at
    from public.learning_item_progress item_progress
    join public.learning_course_item course_item
      on course_item.id = item_progress.course_item_id
    join public.learning_enrollment enrollment
      on enrollment.id = item_progress.enrollment_id
    where item_progress.started_at is not null
      or item_progress.completed_at is not null
      or item_progress.status <> 'not_started'
  ),
  learner_activity as (
    select
      activity.content_item_id,
      activity.learner_id,
      bool_or(activity.completed) as completed,
      sum(activity.watch_seconds)::bigint as watch_seconds,
      max(activity.last_engaged_at) as last_engaged_at
    from activity
    group by activity.content_item_id, activity.learner_id
  ),
  content_activity as (
    select
      learner_activity.content_item_id,
      count(*)::bigint as unique_viewers,
      count(*) filter (where learner_activity.completed)::bigint
        as completed_count,
      sum(learner_activity.watch_seconds)::bigint as watch_seconds,
      max(learner_activity.last_engaged_at) as last_engaged_at
    from learner_activity
    group by learner_activity.content_item_id
  )
  select
    item.id as content_item_id,
    (
      item.content_kind = 'video'
      or item.source_type = 'learning_course'
      or exists (
        select 1
        from public.learning_course_item tracked_item
        where tracked_item.content_item_id = item.id
      )
    ) as tracking_supported,
    coalesce(content_activity.unique_viewers, 0)::bigint as unique_viewers,
    coalesce(content_activity.completed_count, 0)::bigint as completed_count,
    case
      when coalesce(content_activity.unique_viewers, 0) = 0 then 0::numeric
      else round(
        content_activity.completed_count::numeric
          / content_activity.unique_viewers::numeric * 100,
        1
      )
    end as completion_rate,
    coalesce(content_activity.watch_seconds, 0)::bigint as watch_seconds,
    content_activity.last_engaged_at
  from public.knowledge_content_item item
  left join content_activity on content_activity.content_item_id = item.id
  order by item.updated_at desc;
end;
$$;

comment on function public.get_knowledge_content_engagement_summary() is
  'Returns admin-only aggregate learner engagement without exposing learner identities.';

revoke all on function public.get_knowledge_content_engagement_summary()
  from public, anon;
grant execute on function public.get_knowledge_content_engagement_summary()
  to authenticated;

create or replace function public.get_knowledge_content_managers()
returns table (
  user_id uuid,
  display_name text,
  email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception
      using
        errcode = '42501',
        message = 'Content manager lookup requires an authenticated user.';
  end if;

  if not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Content manager lookup requires learning administrator access.';
  end if;

  return query
  select
    profile.id as user_id,
    coalesce(nullif(btrim(profile.full_name), ''), profile.email) as display_name,
    profile.email
  from public.user_profiles profile
  where profile.is_active = true
  order by coalesce(nullif(btrim(profile.full_name), ''), profile.email);
end;
$$;

comment on function public.get_knowledge_content_managers() is
  'Returns active employees available for content owner and reviewer assignment.';

revoke all on function public.get_knowledge_content_managers()
  from public, anon;
grant execute on function public.get_knowledge_content_managers()
  to authenticated;

create or replace function public.bulk_update_knowledge_content_governance(
  p_content_item_ids uuid[],
  p_field text,
  p_value text default null
)
returns table (content_item_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_ids uuid[];
  normalized_value text := nullif(btrim(p_value), '');
  selected_display_area public.knowledge_display_area;
  selected_user_id uuid;
  selected_review_at timestamptz;
  updated_count integer;
begin
  if (select auth.uid()) is null then
    raise exception
      using
        errcode = '42501',
        message = 'Bulk content governance updates require an authenticated user.';
  end if;

  if not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Bulk content governance updates require learning administrator access.';
  end if;

  select coalesce(array_agg(distinct requested_id), '{}'::uuid[])
  into normalized_ids
  from unnest(coalesce(p_content_item_ids, '{}'::uuid[])) requested_id
  where requested_id is not null;

  if cardinality(normalized_ids) = 0 then
    raise exception
      using
        errcode = '22023',
        message = 'Bulk content governance update requires at least one catalog item.';
  end if;

  if cardinality(normalized_ids) > 200 then
    raise exception
      using
        errcode = '22023',
        message = 'Bulk content governance update is limited to 200 catalog items per request.';
  end if;

  if p_field not in (
    'display_area',
    'owner_user_id',
    'reviewer_user_id',
    'next_review_at'
  ) then
    raise exception
      using
        errcode = '22023',
        message = format('Unsupported bulk content governance field: %s.', p_field);
  end if;

  if p_field = 'display_area' then
    if normalized_value is null then
      raise exception
        using
          errcode = '22023',
          message = 'Content display area cannot be cleared.';
    end if;
    begin
      selected_display_area := normalized_value::public.knowledge_display_area;
    exception when invalid_text_representation then
      raise exception
        using
          errcode = '22023',
          message = format('Invalid content display area: %s.', normalized_value);
    end;

    update public.knowledge_content_item
    set display_area = selected_display_area, updated_at = now()
    where id = any(normalized_ids);
  elsif p_field in ('owner_user_id', 'reviewer_user_id') then
    if normalized_value is not null then
      begin
        selected_user_id := normalized_value::uuid;
      exception when invalid_text_representation then
        raise exception
          using
            errcode = '22023',
            message = format('Invalid content manager identifier: %s.', normalized_value);
      end;

      if not exists (
        select 1
        from public.user_profiles profile
        where profile.id = selected_user_id
          and profile.is_active = true
      ) then
        raise exception
          using
            errcode = '23503',
            message = format(
              'Content manager %s does not exist or is inactive.',
              selected_user_id
            );
      end if;
    end if;

    if p_field = 'owner_user_id' then
      update public.knowledge_content_item
      set owner_user_id = selected_user_id, updated_at = now()
      where id = any(normalized_ids);
    else
      update public.knowledge_content_item
      set reviewer_user_id = selected_user_id, updated_at = now()
      where id = any(normalized_ids);
    end if;
  else
    if normalized_value is not null then
      begin
        selected_review_at :=
          normalized_value::date::timestamp at time zone 'UTC';
      exception when invalid_datetime_format or datetime_field_overflow then
        raise exception
          using
            errcode = '22007',
            message = format('Invalid next review date: %s.', normalized_value);
      end;
    end if;

    update public.knowledge_content_item
    set next_review_at = selected_review_at, updated_at = now()
    where id = any(normalized_ids);
  end if;

  get diagnostics updated_count = row_count;

  if updated_count <> cardinality(normalized_ids) then
    raise exception
      using
        errcode = 'P0002',
        message = format(
          'Bulk content governance update matched %s of %s requested catalog items.',
          updated_count,
          cardinality(normalized_ids)
        );
  end if;

  return query
  select updated_id
  from unnest(normalized_ids) updated_id
  order by updated_id;
end;
$$;

comment on function public.bulk_update_knowledge_content_governance(
  uuid[], text, text
) is
  'Atomically updates one approved governance field across a bounded catalog selection.';

revoke all on function public.bulk_update_knowledge_content_governance(
  uuid[], text, text
) from public, anon;
grant execute on function public.bulk_update_knowledge_content_governance(
  uuid[], text, text
) to authenticated;

commit;
