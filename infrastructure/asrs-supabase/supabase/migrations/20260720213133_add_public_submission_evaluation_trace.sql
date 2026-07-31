-- Trace every new public FM Global submission to the exact immutable FMDS
-- revision and deterministic evaluator result used to produce it. Legacy rows
-- remain valid with an entirely null trace; partial traces are rejected.

begin;

alter table public.fm_form_submissions
  add column corpus_revision_id uuid
    references public.fmds_corpus_revisions(id) on delete restrict,
  add column evaluator_key text,
  add column evaluator_inputs jsonb,
  add column evaluation_result jsonb,
  add column evaluation_status text
    check (evaluation_status in ('verified', 'pending_review')),
  add constraint fm_form_submissions_evaluator_key_not_blank
    check (evaluator_key is null or length(btrim(evaluator_key)) > 0),
  add constraint fm_form_submissions_evaluation_trace_complete
    check (
      (
        corpus_revision_id is null
        and evaluator_key is null
        and evaluator_inputs is null
        and evaluation_result is null
        and evaluation_status is null
      )
      or
      (
        corpus_revision_id is not null
        and evaluator_key is not null
        and evaluator_inputs is not null
        and evaluation_result is not null
        and evaluation_status is not null
      )
    );

create index fm_form_submissions_revision_status_idx
  on public.fm_form_submissions (corpus_revision_id, evaluation_status, created_at desc);

-- All application access is server-side through the dedicated ASRS service
-- credential. Keep this public-schema table out of the anon/authenticated Data
-- API surface and use RLS as defense in depth.
alter table public.fm_form_submissions enable row level security;
revoke all on table public.fm_form_submissions from anon, authenticated;
grant all on table public.fm_form_submissions to service_role;

commit;
