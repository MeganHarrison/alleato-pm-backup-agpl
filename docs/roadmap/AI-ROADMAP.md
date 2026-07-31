# Alleato AI Implementation Roadmap

> **Status:** Active — this is the single ranked map for all AI work.
> **Created:** 2026-07-10 · **Owner:** Megan
> **Rule:** One initiative in flight at a time. An item is DONE only when it passes its
> Definition of Done (below). Update the Status Ledger at the bottom every session that
> touches an item.
>
> Phase names align with the shipped `/ai-vision` admin page (P1 Data Foundation = live,
> P2 Proactive Intelligence = building, P3 Workflow Automation = planned, P4 Strategic
> Advisory = planned). This doc is the execution-order companion to that page.

---

## The one-paragraph diagnosis (read this when overwhelmed)

The codebase audit (2026-07-10) found that **the bottleneck is not building AI — it is
activating and verifying AI that is already built.** Four major systems are complete and
sitting behind feature flags that default to OFF (`EXECUTIVE_DAILY_BRIEF_ENABLED`,
`MICROSOFT_EXECUTIVE_ASSISTANT_SCHEDULED_ENABLED`, `AUTONOMOUS_TRIAGE_ENABLED`,
`AI_ASSISTANT_LEARNING_PROPOSALS_ENABLED`). AI Submittal Review — which felt like a
future project — is the *most complete* non-chat AI feature in the repo and just needs
real-world validation. The genuinely-new builds (RFI drafting, form pre-fill) are
days-scale because they reuse existing patterns. Only **AI Estimating** and
**predictive analytics** are quarter-scale efforts, and both have a cheap "crawl" version
that ships in about a week. So the plan is: **activate → verify → adopt → then build**,
one item at a time, in the order below.

---

## Why some things take 2 hours and others take 2 months

Effort is driven by four questions, not by how impressive the feature sounds:

| Question | Cheap answer | Expensive answer |
|---|---|---|
| **Is the data already ingested + embedded?** | Yes (emails, meetings, Teams, docs, Acumatica are all in RAG today) | No — new ingestion pipeline needed (e.g. takeoff quantities from drawings) |
| **Is the output a draft a human reviews?** | Draft/suggestion (wrong = mildly annoying) | Autonomous action or a *number someone bids with* (wrong = money lost) |
| **Does a pattern already exist in the repo?** | Yes — copy submittal-review or email-draft pattern | No — invent architecture, evals, and trust loop from scratch |
| **Does trust already exist?** | Feature extends something people already use | Users must change behavior AND learn to calibrate trust |

**Effort scale used below:** `S` = hours–1 day · `M` = 2–5 days · `L` = 1–3 weeks ·
`XL` = 1–3 months (or buy-vs-build question).

---

## The maturity ladder (what "done at this level" means)

Every AI surface gets graded L0–L4. The goal is never "build it" — it's "move it up one
level and verify before touching anything else."

- **L0 — Doesn't exist.** No code.
- **L1 — Built.** Code merged, may be flag-gated. *Most of Alleato's AI is here or L2.*
- **L2 — Verified.** Eval/contract gates green AND exercised end-to-end on real project
  data with the output read by a human.
- **L3 — Adopted.** On by default; used in the real weekly workflow ≥2 weeks; failures
  are loud (no silent degradation).
- **L4 — Learning.** Corrections flow back (ai_feedback_events → learning promotions)
  and measurably improve output.

**Definition of Done for any roadmap item = reaches its target level + evidence
(screenshot / eval run link) recorded in the Status Ledger.**

---

## HORIZON 1 — Activate & verify what's already built (~2 weeks total)

Highest ROI in the entire plan. Zero new features — just flag flips, verification, and a
week of real use each. Work top to bottom.

| # | Item | Now → Target | Effort | What it actually takes |
|---|------|-------------|--------|------------------------|
| 1 | **Executive Daily Brief → ON** | L1 → L3 | **S** (2–6 hrs + 5-day observation) | Flip `EXECUTIVE_DAILY_BRIEF_ENABLED`, run `verify_executive_daily_brief_fresh.mjs`, confirm Teams delivery, then read it daily for a week and log corrections. The Daily Deep Read review queue (`/executive/daily-deep-read-review`) already exists — commit to clearing it 2×/week or the human-gate becomes the silent failure. |
| 2 | **AI Submittal Review → validated on real submittals** | L1/L2 → L3 | **M** (1–2 days) | It's built: "AI Review" tab on submittal detail, contract test, learning loop. Run it on 5 real submittals with linked drawings, judge the output quality, fix what's wrong, screenshot the wins. This is the fastest path to a "wow" feature already paid for. Constraint: needs drawings linked + OCR'd (Morrisville's 63 drawings all have OCR text). |
| 3 | **Microsoft Exec Assistant scheduled check → ON** | L1 → L2 | **S/M** | Flip `MICROSOFT_EXECUTIVE_ASSISTANT_SCHEDULED_ENABLED` (15-min Render cron), watch one day of runs, verify inbox evals stay green (`rag:verify:inbox-evals:prod`). |
| 4 | **Learning loops → ON** | L1 → L2 | **M** | Flip `AI_ASSISTANT_LEARNING_PROPOSALS_ENABLED` + `AUTONOMOUS_TRIAGE_ENABLED`; the 51-stuck-candidates problem is exactly what autonomous triage was built for. Requires the same review-queue discipline as #1. |
| 5 | **RAG pipeline stays green** (standing guardrail, not a project) | L3 hold | **S** recurring | The 4 verifier gates in `docs/ops/plans/2026-06-30-rag-pipeline-green-plan.md` + provider-credit runway. Every horizon below silently degrades if embedding coverage rots. Decision pending: accept/reject the Vercel-orchestration consolidation proposal (`docs/ops/rag-pipeline-consolidation/`, AAI-848) — decide before investing more in Render cron plumbing. |

**Exit criteria for Horizon 1:** you and Brandon each consume ≥1 AI output daily
(brief, submittal review, or triage) and trust it enough to act on it.

---

## HORIZON 2 — The AI Project Manager v1 (~3–4 weeks)

This is the centerpiece and it is **assembly, not invention** — intelligence_packets,
insight_cards, the compilers, and notification-routing code all exist. The three
documented gaps (AI-RAG-ARCHITECTURE §12) are: no proactive generation cadence, no
notification routing to users, no dashboard surface.

| # | Item | Now → Target | Effort | What it actually takes |
|---|------|-------------|--------|------------------------|
| 6 | **Proactive insight generation cadence** | L1 → L2 | **M** | insight_cards populate from meetings/emails/Teams compilers today, but generation → surfacing is thin. Define the cadence (post-sync compile is already wired), tighten the promote gate, verify with `verify_ai_packet_synthesis_quality.mjs`. |
| 7 | **AI briefing card on the project dashboard** | L0 → L3 | **M** (3–5 days) | The single highest-visibility deliverable in the plan: every project home shows "what the AI thinks you need to know today" from the existing packet — no chat required. Data layer exists (`packet-service.ts`); this is one UI card + noise-gate discipline. |
| 8 | **Notification routing** | L1 → L2 | **M** | `notification-routing.ts` + decision ledger exist. Wire insight_cards → Teams DM / in-app for high-severity cards only (start narrow: financial exposure + schedule risk). |
| 9 | **Meetings AI Phase 2 — close the transcript loop** | L1 → L2 | **L** (~1 wk) | Architecture already locked in `docs/superpowers/plans/2026-07-01-meetings-tool.md`: auto-attach Fireflies transcripts to the matching meeting, extract-actions → confirm-panel → tasks, minutes drafting. Don't re-plan; execute the locked plan. |

**Deliberately skipped:** wiring the COO/CHRO/CRO/VP BD persona agents. More personas ≠
more value; the Strategist + CFO + Microsoft EA cover the real question traffic. Revisit
only if a concrete question class falls through.

**Exit criteria:** a PM (or Brandon) can go a full day without asking the chat anything
because the project surfaces pushed what mattered.

---

## HORIZON 3 — Workflow automation: AI that drafts (~4–6 weeks)

Phase 3 territory. Everything here is a *draft a human approves*, which keeps effort at
M — the patterns (RAG context + structured generation + confirm panel) already exist in
submittal review and email drafting.

| # | Item | Now → Target | Effort | What it actually takes |
|---|------|-------------|--------|------------------------|
| 10 | **"Generate Status Report" button** | L1 → L3 | **S/M** (1–2 days) | Sneaky-cheap: `progress-report-tools.ts` (5 tools) + daily cron already exist. Surface as an action on the project page → editable draft. |
| 11 | **RFI AI draft responses** | L0 → L2 | **M** (2–4 days) | The response *loop* exists (magic links, email ingestion); the missing piece is generation. RAG over specs/drawings + prior RFI answers → draft with citations, PM approves before send. Reuse email draft-reply pattern. |
| 12 | **Smart form pre-fill (RFI + change events)** | L0 → L2 | **M** | "Create from source": start an RFI/CE from an email or meeting item and let AI pre-fill subject, description, refs. Respect the FK-validation gate on every dropdown. |
| 13 | **Document auto-classification on upload** | L0 → L2 | **M** (3–5 days) | Classifier at ingestion (type/division/project confidence) feeding the existing assignment-inbox review flow instead of a new UI. |
| 14 | **Change order impact drafting** | L0 → L2 | **M/L** | From a change event: draft scope narrative + suggest affected budget lines (suggestion only — numbers stay human). Money-adjacent, so evals + citations required before anyone sees it. |

---

## HORIZON 4 — AI Estimating & prediction (the honest nightmare tier)

This is the one that *sounds* like one feature but is three, with wildly different costs.
Do NOT start here; start at crawl only after Horizons 1–2 hold.

| # | Item | Effort | Reality check |
|---|------|--------|---------------|
| 15 | **Crawl: Estimating copilot** | **M/L** (~1 wk) | Chat + estimate-page panel over data you already have: `estimates/benchmark` SQL (awarded-bid unit costs by division), Acumatica actuals, budget_lines history, `rag:ingest:estimating` corpus (target already exists with a verifier). "What did we bid drywall at on the last 3 jobs vs. what it actually cost?" No new numbers invented — retrieval + comparison only. |
| 16 | **Walk: AI-drafted estimate lines** | **L/XL** (2–4 wks) | From a scope doc/RFP: draft line items with ranges sourced from your history, every number cited, estimator edits everything. Hard part isn't the LLM — it's normalizing historical cost data enough to be quotable, and the eval bar (a bad number here loses a bid or wins a losing one). |
| 17 | **Run: drawing takeoff** | **XL** (months) | Quantity extraction from plans is a specialized computer-vision problem; companies exist that only do this (Togal.AI, Kreo, Buildertrend takeoff). **Recommendation: buy/integrate, don't build.** Revisit end of 2026. |
| 18 | **Predictive analytics** (overrun probability, completion forecasting) | **XL** | Needs enough *completed* projects with clean actuals to train/validate against. Park until the data foundation has more history; the threshold-based `financial-insights/scan` + daily-flags cover the interim. |

---

## Operating rules (how this map keeps your mind at ease)

1. **One initiative in flight.** Finish (per the DoD) or explicitly park with a dated
   note in the ledger. No third state.
2. **New idea mid-stream?** It goes in the Parking Lot below with one line, not into the
   codebase. Review the lot when picking the next item.
3. **Activation beats construction.** When torn between building something new and
   verifying something built, verify. L1→L3 on an existing surface beats a new L1 every
   time.
4. **Every AI output must be traceable** (claims link to sources) and every failure loud
   — inherited from CLAUDE.md core principles; non-negotiable for trust.
5. **This doc + GitHub Issues are the memory.** Chat sessions are ephemeral; if an item's
   status changed and the ledger didn't, the work didn't happen.

## Parking lot

- Wire COO/CHRO/CRO/VP BD persona agents (skipped in H2 — needs evidence of question
  classes falling through)
- Site Scribe voice daily-log validation (built, niche — validate when field crews ask)
- Automation blueprints (NL → scheduled automations) — half-built, no current pull
- Phone/telephony AI — nothing exists; no current pull
- Fix dangling `AI-MASTER-PLAN.md` references in `/ai-vision` page + AI-RAG-ARCHITECTURE
  doc registry (stale pointers to deleted files)

## Status ledger

| Date | Item | Level change | Evidence |
|------|------|-------------|----------|
| 2026-07-10 | Roadmap created from full codebase audit | — | This PR |
