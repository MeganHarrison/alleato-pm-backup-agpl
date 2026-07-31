-- Persist administrator feedback on discovery candidates so the finder keeps
-- a durable good/bad decision record alongside the URL it already deduplicates.

begin;

alter table public.training_resource
  add column reviewer_notes text null;

alter table public.training_resource
  add constraint training_resource_reviewer_notes_check
  check (
    reviewer_notes is null
    or (
      char_length(btrim(reviewer_notes)) between 8 and 1000
      and reviewer_notes = btrim(reviewer_notes)
    )
  );

comment on column public.training_resource.reviewer_notes is
  'Administrator explanation for a publish/archive decision. Archived URLs remain in the finder dedupe memory, so rejected resources are not proposed again.';

commit;
