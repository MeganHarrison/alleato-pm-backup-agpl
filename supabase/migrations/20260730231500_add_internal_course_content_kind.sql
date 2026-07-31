-- Internal courses are catalog content in their own right, distinct from
-- standalone articles and externally hosted courses.
alter type public.knowledge_content_kind
  add value if not exists 'internal_course';
