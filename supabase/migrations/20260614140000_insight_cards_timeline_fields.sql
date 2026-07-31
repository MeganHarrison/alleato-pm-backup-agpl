-- Intelligence redesign — Slice 2.1
-- Extend insight_cards into timeline events: real event date, risk severity,
-- entry linking, and flag->outcome calibration statuses + a 'flag' card type.
--
-- Purely additive + CHECK-widening. New columns are nullable / defaulted; the
-- card_type and current_status CHECKs only GAIN allowed values (supersets), so
-- every existing row remains valid. Reversible (see down notes at bottom).

-- 1. New timeline columns ---------------------------------------------------
alter table public.insight_cards
  add column if not exists occurred_at timestamptz,
  add column if not exists severity smallint,
  add column if not exists related_card_ids uuid[] not null default '{}'::uuid[];

-- severity is the AI-scored risk magnitude (1=low .. 5=critical); null for
-- non-risk card types.
alter table public.insight_cards
  drop constraint if exists insight_cards_severity_check;
alter table public.insight_cards
  add constraint insight_cards_severity_check
  check (severity is null or (severity between 1 and 5));

-- 2. Backfill occurred_at (best-effort real event date for timeline ordering)
update public.insight_cards
  set occurred_at = coalesce(first_seen_at, created_at)
  where occurred_at is null;

-- 3. Timeline read index: per-project, most-recent-first
create index if not exists insight_cards_timeline_idx
  on public.insight_cards (primary_target_id, occurred_at desc);

-- 4. Widen current_status for the flag->outcome calibration loop ------------
--    materialized / did_not_materialize: a predictive flag's outcome was
--    later observed. superseded: replaced by a newer entry.
alter table public.insight_cards
  drop constraint if exists insight_cards_current_status_check;
alter table public.insight_cards
  add constraint insight_cards_current_status_check
  check (current_status = any (array[
    'open', 'resolved', 'blocked', 'needs_review', 'stale', 'rejected',
    'materialized', 'did_not_materialize', 'superseded'
  ]));

-- 5. Widen card_type for predictive flags + timeline event types -----------
--    flag: AI prediction (e.g. potential change event). solution: resolution
--    of an issue/risk. milestone: notable project event.
alter table public.insight_cards
  drop constraint if exists insight_cards_card_type_check;
alter table public.insight_cards
  add constraint insight_cards_card_type_check
  check (card_type = any (array[
    'risk', 'decision', 'blocker', 'task', 'product_need', 'process_issue',
    'project_update', 'open_question', 'requirement', 'financial_exposure',
    'change_management', 'schedule_risk', 'sentiment', 'initiative_signal',
    'flag', 'solution', 'milestone'
  ]));

comment on column public.insight_cards.occurred_at is
  'Real-world date of the underlying event (from source doc), used for timeline ordering. Distinct from created_at (row insert time).';
comment on column public.insight_cards.severity is
  'AI-scored risk magnitude 1 (low) .. 5 (critical). Null for non-risk card types.';
comment on column public.insight_cards.related_card_ids is
  'Causal/outcome links to other insight_cards (e.g. a change_management card links back to the flag that predicted it).';

-- Down (manual): drop columns occurred_at, severity, related_card_ids; drop
-- insight_cards_timeline_idx; restore prior current_status / card_type CHECKs
-- (without flag/solution/milestone and without materialized/did_not_materialize/superseded).
