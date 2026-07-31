alter table public.drawing_revisions
  add column if not exists ocr_confidence_label text not null default 'unknown',
  add column if not exists ocr_confidence_score numeric(4,3),
  add column if not exists ocr_confidence_source text not null default 'not_run';

alter table public.drawing_revisions
  drop constraint if exists drawing_revisions_ocr_confidence_label_check;

alter table public.drawing_revisions
  add constraint drawing_revisions_ocr_confidence_label_check
  check (ocr_confidence_label in ('high', 'medium', 'low', 'unknown'));

alter table public.drawing_revisions
  drop constraint if exists drawing_revisions_ocr_confidence_score_check;

alter table public.drawing_revisions
  add constraint drawing_revisions_ocr_confidence_score_check
  check (ocr_confidence_score is null or (ocr_confidence_score >= 0 and ocr_confidence_score <= 1));

alter table public.drawing_revisions
  drop constraint if exists drawing_revisions_ocr_confidence_source_check;

alter table public.drawing_revisions
  add constraint drawing_revisions_ocr_confidence_source_check
  check (ocr_confidence_source in ('ocr', 'filename', 'manual', 'not_run'));

comment on column public.drawing_revisions.ocr_confidence_label is
  'Confidence label for extracted drawing metadata. Source may be OCR, filename fallback, manual review, or not_run.';

comment on column public.drawing_revisions.ocr_confidence_score is
  'Optional confidence score from 0 to 1 for extracted drawing metadata.';

comment on column public.drawing_revisions.ocr_confidence_source is
  'Source of metadata confidence: ocr, filename, manual, or not_run.';
