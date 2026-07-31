-- Extend insight_cards.card_type CHECK constraint to allow two new types
-- emitted by Pipeline B:
--   * sentiment         — team/owner emotional signal extracted from comms
--                         ("Where are employees confused?", "Who's frustrated?")
--   * initiative_signal — strategic direction signals from comms
--                         ("Company is shifting focus", "New BD push")
--
-- Mirrors the InsightCardType union in
-- frontend/src/lib/ai/intelligence/types.ts and the INSIGHT_CARD_TYPES set
-- in backend/src/services/intelligence/compiler.py.
--
-- Original constraint added in 20260430095000_ai_intelligence_packets.sql.

alter table public.insight_cards
  drop constraint if exists insight_cards_card_type_check;

alter table public.insight_cards
  add constraint insight_cards_card_type_check
  check (card_type in (
    'risk',
    'decision',
    'blocker',
    'task',
    'product_need',
    'process_issue',
    'project_update',
    'open_question',
    'requirement',
    'financial_exposure',
    'change_management',
    'schedule_risk',
    'sentiment',
    'initiative_signal'
  ));
