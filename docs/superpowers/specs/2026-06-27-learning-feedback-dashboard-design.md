# Learning & Feedback Dashboard — Design

**Date:** 2026-06-27
**Status:** Approved (design), pending implementation
**Author:** Megan + Claude

## Goal

One admin-facing front door for the AI learning/feedback system. The building
blocks already exist but are scattered across `ai/learning-promotions`,
`feedback-inbox`, `tables-directory`, and the raw tables. This page consolidates
"what needs my attention" into a single dashboard — it links into those existing
pages, it does not replace them.

## Audience & placement

- **Audience:** all `is_admin` users.
- **Route:** `/(admin)/learning-feedback` → URL `/learning-feedback`.
- **Nav:** entry in `navigation-config.ts` (admin tools).
- **Gating:** `requireAdmin()` from `@/app/api/admin/_shared` (mirrors
  `ai/learning-promotions/page.tsx`).
- Server component, `export const dynamic = "force-dynamic"`, data via
  `createServiceClient()`.

## Sections (top → bottom)

1. **Needs your decision** — KPI row (`@/components/ds/kpi`):
   - triageable learning candidates: `agent_learnings` where
     `status='candidate' AND source IN ('thumbs_down','eval_failure')`
   - promotions awaiting review: `ai_learning_promotions` where
     `status IN ('candidate','approved')`
   - open feedback-inbox items: `admin_feedback_items` (open/active status)
   - Each KPI deep-links to the page that resolves it
     (`/ai/learning-promotions`, `/feedback-inbox`).

2. **Feedback coverage** — read-only list (NOT a `<table>` — flex rows, to stay
   clear of the table-page gate and keep it noise-light). From
   `ai_feedback_events` grouped by `surface` × `signal`: each known surface
   (chat/ai_assistant, daily_brief, progress_report, submittal_review/document
   review, insight_card) with 👍 / 👎 counts and last-feedback date. Surfaces
   with zero feedback are shown explicitly ("silent") — that's the signal.

3. **Review recent AI output** — short list of links to where feedback can be
   given: latest exec brief (`/executive`), open PCO/insight cards
   (`/potential-change-orders`), recent submittal reviews, recent progress
   reports. Plus one link to **Tables Directory** for raw data sources
   (meetings, emails, teams, documents). No new sidebar.

4. **Autonomous triage** — current state only (v1): candidate pile-up by source
   (triageable vs excluded admin_feedback), recent activations
   (`agent_learnings.activated_at` in last 7d), active/archived counts, and the
   flag state. NOTE: the cron logs via `logEvent` and does not persist run
   history, so this shows current state, not per-run history.

## Components & layout

- `PageShell variant="dashboard"` (or `content`) with title/description.
- `SectionRuleHeading` per section; spacing-separated, **no card borders, no
  decorative icons/badges** (noise gate).
- KPI row via `KpiRow`/`KpiBlock`. Coverage + lists via simple flex rows with
  `DetailField`-style label/value, and `EmptyState` where a list is empty.
- Mostly server-rendered (static counts + links). No client island needed in v1
  — the thumbs control already lives on each output surface.

## Non-goals (v1)

- No new data-source sidebar (reuse Tables Directory).
- No `triage_runs` history table (current-state only).
- Does not replace `ai/learning-promotions` or `feedback-inbox` — links to them.
- No write actions on this page (it's a launcher/overview).

## Verification

- Aggregate queries validated against live DB (counts match direct SQL).
- `requireAdmin` gate confirmed (non-admin redirected).
- Typecheck/lint clean (delegated). Nav entry resolves.
