begin;

create or replace function public.update_knowledge_content_display_area(
  p_content_item_id uuid,
  p_display_area public.knowledge_display_area
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception
      using
        errcode = '42501',
        message = 'Content placement update requires an authenticated user.';
  end if;

  if not public.current_is_learning_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Content placement update requires learning administrator access.';
  end if;

  update public.knowledge_content_item
  set
    display_area = p_display_area,
    updated_at = now()
  where id = p_content_item_id
  returning id into updated_id;

  if updated_id is null then
    raise exception
      using
        errcode = 'P0002',
        message = format(
          'Content placement update failed because catalog item %s does not exist.',
          p_content_item_id
        );
  end if;

  return updated_id;
end;
$$;

revoke all on function public.update_knowledge_content_display_area(
  uuid,
  public.knowledge_display_area
) from public;

grant execute on function public.update_knowledge_content_display_area(
  uuid,
  public.knowledge_display_area
) to authenticated;

commit;
