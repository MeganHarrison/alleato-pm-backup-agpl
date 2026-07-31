-- The training-doc publisher stores its resolved employee-facing path and tool
-- category in training_docs.metadata. Project those values into the shared
-- catalog so library links resolve to the exact guide instead of the hub.

begin;

create or replace function public.sync_training_doc_delivery_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.knowledge_content_item content
  set
    metadata = content.metadata || jsonb_strip_nulls(
      jsonb_build_object(
        'app_tool_category',
        coalesce(
          nullif(new.metadata ->> 'appToolCategory', ''),
          nullif(new.tool_category, '')
        ),
        'app_published_path',
        nullif(new.metadata ->> 'appPublishedPath', '')
      )
    ),
    updated_at = new.updated_at
  where content.source_type = 'training_doc'
    and content.source_id = new.id::text;

  if not found then
    raise exception
      using
        errcode = '23503',
        message = format(
          'Software guide "%s" has no catalog identity for delivery metadata.',
          new.title
        ),
        hint = 'Repair the training-doc catalog sync before publishing the guide.';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_sync_training_doc_delivery_metadata
  on public.training_docs;
create trigger zz_sync_training_doc_delivery_metadata
  after insert or update on public.training_docs
  for each row execute function public.sync_training_doc_delivery_metadata();

update public.knowledge_content_item content
set metadata = content.metadata || jsonb_strip_nulls(
  jsonb_build_object(
    'app_tool_category',
    coalesce(
      nullif(doc.metadata ->> 'appToolCategory', ''),
      nullif(doc.tool_category, '')
    ),
    'app_published_path',
    nullif(doc.metadata ->> 'appPublishedPath', '')
  )
)
from public.training_docs doc
where content.source_type = 'training_doc'
  and content.source_id = doc.id::text;

comment on function public.sync_training_doc_delivery_metadata() is
  'Projects resolved in-app guide category and published path into the shared knowledge catalog.';

commit;
