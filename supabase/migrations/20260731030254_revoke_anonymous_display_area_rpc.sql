begin;

revoke all on function public.update_knowledge_content_display_area(
  uuid,
  public.knowledge_display_area
) from anon;

commit;
