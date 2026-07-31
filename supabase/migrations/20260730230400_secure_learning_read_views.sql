-- Ensure all knowledge and learning read models execute with the caller's
-- privileges so base-table RLS remains the authorization boundary.
alter view public.knowledge_content_catalog_view
  set (security_invoker = true);

alter view public.training_library_view
  set (security_invoker = true);

alter view public.learner_assignments_view
  set (security_invoker = true);

alter view public.learner_course_progress_view
  set (security_invoker = true);

alter view public.content_governance_exceptions_view
  set (security_invoker = true);
