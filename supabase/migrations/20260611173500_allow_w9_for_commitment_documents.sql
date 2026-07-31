-- Allow W-9 documents to be classified directly on commitment attachments.
update public.document_type_taxonomy
set applies_to = (
  select array_agg(distinct value order by value)
  from unnest(public.document_type_taxonomy.applies_to || array['commitment']) as value
)
where type_key = 'w9'
  and not applies_to @> array['commitment'];
