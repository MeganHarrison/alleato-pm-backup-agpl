# Friction Mining Plan — Finding the Recurring Issues That Cost the Most

> Goal: stop guessing (or extracting from Brandon) which problems matter. Mine the
> communication corpus we already have — meeting transcripts, emails, extracted
> intelligence signals — for recurring patterns that cause delays, rework, client
> frustration, and lost revenue. Rank them by real cost. Then design AI/automation
> systems targeted at the top patterns, not at hypotheticals.
>
> Created: 2026-07-14. Owner: Megan. Feeds into `docs/roadmap/AI-ROADMAP.md`
> (the single ranked map — this plan produces evidence that re-ranks it, it does
> not compete with it).

---

## Why this will work here (the data already exists)

| Corpus | Where it lives | Volume (2026-07) | Readiness |
|--------|----------------|------------------|-----------|
| Meeting transcripts (Fireflies) | `meetings` (1.4k) → `document_metadata` → `meeting_segments` (~19.5k chunks, embedded) | ~1,400 meetings | ✅ Ready — chunked AND embedded |
| Email | `outlook_email_intake` (2.1k raw) + `project_emails` (1.3k project-matched) + RAG-side intake (4.6k) | ~2–5k threads | ✅ Ready |
| Extracted signals | `insight_cards` (~6k durable signals: risk, schedule_risk, financial_exposure, decision, task, sentiment…) + `insight_card_evidence` (6.2k source links) | ~6k signals | ✅ Ready — seed layer, already source-linked |
| Structured workflow data | RFIs, submittals, change events, tasks (845, auto-extracted), invoices | full app DB | ✅ Ready — lets us corroborate "X was late" with dates |
| Microsoft Teams messages | `document_metadata` `category='teams_message'` (synced by `microsoft_graph/teams.py` since 2026-03-18) → embedded as `document_chunks` `source_type='teams_dm'`/`'teams_channel'` in the AI DB | 28,463 docs / ~36k embedded chunks (live count 2026-07-14) | ✅ Ready — DMs strong; **channel coverage thin (13 threads / 34 chunks)** |

> ⚠️ Do not confuse `team_chat_messages` with Microsoft Teams — it backs **Team Chat**
> (`/team-chat`), the app's own internal chat product (built, not yet rolled out —
> issue #23). Microsoft Teams history lives in `document_metadata`:
> `type='teams_dm'` (legacy per-message docs, ~24.6k), `type='teams_dm_conversation'`
> (grouped DM daily docs, ~3.8k), `type='teams_message'` (channel threads, 13).
> This is now documented bluntly in `docs/architecture/tables.yaml` on both tables.

Two implications:
1. **Phases 1–3 need zero new product code.** This is an analysis campaign run by
   agents over existing data, not a build. The nightly intelligence pipeline
   (`backend/src/services/intelligence/`) already proves LLM extraction works on
   this corpus — but its lens is *forward-looking* ("what's happening now, what's
   at risk"). Nobody has run the *retrospective* lens: "what keeps going wrong,
   what did it cost."
2. **All three corpora are in — meetings, email, AND Teams DMs.** The only soft
   spot is Teams *channel* messages (13 threads captured vs. thousands of DM
   docs). Worth checking whether channel sync is scoped to only 2 channels or
   silently stalled — but it does not block the mining pass.

---

## Phase 0 — Data census (half a session)

Before extracting anything, establish what the corpus actually covers so the
findings aren't skewed by coverage holes:

- Date range and per-project counts for meetings, emails, insight cards.
- Which mailboxes are synced (Brandon only? others?). One mailbox = one
  perspective; findings get labeled accordingly.
- Meeting series coverage: which recurring meetings (OAC, subs, internal) have
  transcripts vs. which are dark.
- Output: a one-page coverage note at the top of the final report ("this analysis
  sees X% of client-facing communication").

## Phase 1 — Friction event extraction (the mining pass)

An LLM pass over every transcript and email thread with one fixed extraction
schema. Not "summarize this meeting" — specifically: **find moments where time,
money, or trust leaked.**

**Friction taxonomy v1** (extend as the data teaches us — the extractor is told
to use `other` + free-text when nothing fits, and `other` gets clustered later):

| Code | Pattern |
|------|---------|
| `waiting_on_decision` | Work stalled pending an answer/approval (internal or client) |
| `info_missing_or_late` | RFI-class churn: needed info arrived late, wrong, or never |
| `dropped_commitment` | "I'll send that by Friday" → never happened / chased repeatedly |
| `rework` | Something built/drawn/ordered twice because of miscommunication |
| `scope_ambiguity` | Unclear scope → dispute, unpaid work, or change-order fight |
| `handoff_gap` | Internal handoff where context was lost (office ↔ field, PM ↔ super) |
| `client_frustration` | Explicit or tonal client dissatisfaction, escalation, repeated asks |
| `billing_delay` | Invoicing/payment/pay-app friction, retainage disputes |
| `sub_coordination` | Subcontractor scheduling/sequencing failures |
| `repeated_explanation` | Same question answered over and over (knowledge never captured) |
| `tool_or_process_failure` | The process itself failed (lost file, wrong version, missed email) |

**Per-event record (JSON):** source id + link, date, project, people involved,
friction_type, one-sentence description, verbatim evidence quote, downstream
consequence (if stated), severity 1–5, cost signal (hours wasted / dollars /
relationship), and a `recurring_hint` flag when the speaker themselves says
"again" / "every time" / "like last time" — those are gold.

**Mechanics:**
- Meetings: process per-meeting using `meeting_segments` in windows, cheap model
  (Haiku-class) for extraction — same cost profile as the existing pipeline
  (`pipeline_model_usage` shows this is affordable).
- Emails: process per-thread from `project_emails` / `outlook_email_intake`.
- Seed with the existing ~6k `insight_cards` (risk / schedule_risk /
  financial_exposure / sentiment types) mapped into the same schema — free signal,
  already evidence-linked.
- Results land as JSONL under `docs/reports/friction-mining/` first (no schema
  work until the loop proves recurring value; then it becomes a table + nightly
  extractor).

## Phase 2 — Clustering and verification

1. Embed all friction events; cluster within and across taxonomy codes (the
   taxonomy says *what kind*, clustering says *which specific recurring issue* —
   e.g. `waiting_on_decision` may split into "client finish selections" vs.
   "internal pricing approvals").
2. Per cluster, a frontier-model synthesis: pattern name, frequency, projects and
   people involved, the typical causal chain, 3–5 representative quotes,
   aggregate cost estimate, trend over time (getting better or worse?).
3. **Adversarial verification for the top ~10 clusters:** a second agent re-reads
   the underlying sources and tries to *refute* the pattern (extraction artifact?
   one bad project, not a pattern? already fixed?). Only confirmed patterns make
   the report. Cross-check against structured data where possible (e.g. claimed
   RFI delays vs. actual RFI open/close dates in the DB).

## Phase 3 — The Friction Ledger (the deliverable)

Ranked report: **impact = frequency × severity × preventability.**

Each of the top 5–10 issues gets one page:
- Pattern name + plain-English description
- Evidence: quotes with deep links to the actual meetings/emails in the app
- Cost estimate (hours, dollars, relationship damage) with the reasoning shown
- Root cause chain
- Existing guardrail, if any (and why it isn't working)
- Proposed system (from Phase 4)

Delivered as: markdown report in `docs/reports/friction-mining/` + a visual
artifact dashboard for phone review. This becomes the evidence base you can put
in front of Brandon — instead of asking him what hurts, you show him what the
record says, with his own words quoted back.

## Phase 4 — Systems design (issue → intervention)

The final list comes from the data, but the anticipated mappings — chosen because
each has existing infrastructure at L2+ per the AI Roadmap, so they're
activations/extensions, not quarter-scale builds:

| Likely pattern | System | Builds on |
|---------------|--------|-----------|
| `dropped_commitment` | **Commitment tracker**: extract "I'll do X by Y" from every meeting/email, track, auto-nudge owner before due, escalate after | `task_extraction.py` cron + `tasks` table (already extracts tasks daily) |
| `waiting_on_decision` | **Ball-in-court monitor**: every open decision/RFI/submittal/unanswered client email gets an aging clock; daily Teams digest of "stuck > N days" | Executive Daily Brief (built, flag OFF) + RFI/submittal data |
| `info_missing_or_late` | **RFI/submittal aging + pre-emptive chase**: auto-drafted follow-ups when a response is approaching its due date | RFI response tokens + email send infra (exists) |
| `client_frustration` | **Sentiment early-warning**: per-client sentiment trend from the existing `sentiment` signal type; alert on decline before it becomes a call | intelligence pipeline `sentiment` signals (already extracted) |
| `repeated_explanation` / `handoff_gap` | **Decision log**: decisions auto-extracted, confirmed once, published & searchable so they stop being re-litigated | `decision` signal type + insight cards (already extracted) |
| `scope_ambiguity` | **Change-event drafter**: scope-change language in conversations auto-drafts a change event for review before it becomes a dispute | change events module + extraction pipeline |
| slow email response | **Response-SLA monitor** on inbound client email | outlook intake timestamps |

Each candidate gets scored: Friction Ledger impact × build effort × infra
maturity → merged into `AI-ROADMAP.md` as the new evidence-based ranking. The
one-initiative-in-flight rule holds; the ledger decides which one.

## Phase 5 — Make it a loop, not a one-off

- Add a `friction_signal` lens to the nightly intelligence pipeline (or a
  separate weekly extractor) so new friction events accumulate continuously.
- Monthly auto-synthesized "Friction Ledger delta": what's recurring, what a
  shipped system actually reduced (this is also how we measure whether the
  systems from Phase 4 work — closed loop).
- Investigate the thin Teams *channel* coverage (13 threads vs. ~24.6k DM docs):
  scoped to too few channels, or silently stalled? Fix before the second pass.

---

## Execution shape & cost

| Phase | Who/how | Effort |
|-------|---------|--------|
| 0 — Census | Agent, direct DB queries | half session |
| 1 — Extraction | Agent workflow, fan-out over ~1.4k meetings + ~2k threads, cheap model | 1 session, low $ (Haiku-class; same order as existing nightly pipeline runs) |
| 2 — Cluster + verify | Agent workflow, frontier model on top clusters only | same session |
| 3 — Ledger report | Synthesis + artifact | 1 session |
| 4 — Systems design | Working session with Megan on the ranked list | 1 session |
| 5 — Continuous loop | Small pipeline PR + Teams ingestion project | after Ledger proves value |

Total to first Friction Ledger: **~2–3 working sessions, no new product code.**

## Open decisions (need Megan)

1. **Analysis window** — everything, or last 9–12 months? (Recommend: everything
   for meetings — 1.4k is cheap; flag pre-2026 as historical context.)
2. **Green-light the mining pass** — it's a large but affordable batch of LLM
   calls over company communications.
3. **Teams channel coverage** — DMs are fully ingested (~24.6k docs), but only
   13 channel threads exist. OK to run the pass on meetings + email + Teams DMs
   now and chase channel coverage as a follow-up?
4. **People sensitivity** — the ledger will name people attached to patterns
   (e.g. dropped commitments cluster around a person). Keep names in the internal
   report, or aggregate to roles?
