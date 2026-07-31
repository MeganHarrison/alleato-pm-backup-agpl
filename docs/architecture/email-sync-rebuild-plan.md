# Email / Microsoft Graph Sync — Controlled Rebuild Plan

**Status:** triage complete · **Started:** 2026-06-24 · **Last updated:** 2026-06-24 ~10:50 UTC

> **This file is the live source of truth and MUST be updated in real time as each
> step lands — before moving on, not in a batch afterward.** A stale plan is worthless.
> **Current state:** the two recent silent-failure modes (2026-06-17 ingestion block,
> 2026-06-24 embedding 401) are FIXED + GUARDED; pipeline verified healthy; emails read
> a live source. Remaining = Phase 3 (cron consolidation) + Phase 4 (legacy retirement),
> both deliberate improvements that carry sync-dark / break-reader risk — do NOT rush.

## Why this exists

The email/Teams/SharePoint ingestion pipeline has broken repeatedly, each time
discovered by accident days later. Root causes are systemic, not in the sync
logic itself:

1. **Silent failures.** Guards/projections that fail without raising — the
   2026-06-17 `document_metadata` block returned `null` for 7 days (~4,085 writes
   dropped); the `project_emails` projection died silently on 2026-06-16. Both
   looked fine from the UI.
2. **Config drift across many crons.** Graph sync is triggered from **two**
   platforms (Render every 2h *and* Vercel daily), and 9 Render crons each carry
   their own env. One drifts → a source goes dark with no alarm.
3. **Interwoven sprawl with no single owner.** `outlook_email_intake` (AI DB) ⊇
   `document_metadata` (PM APP) ⊇ `project_emails` (PM APP, legacy) + the
   `document_chunks` embedding store, spanning two Supabase projects, plus
   hand-applied in-DB triggers that exist nowhere in the repo.

## Target architecture

1. **UI reads Microsoft Graph live** (source of truth). Already proven for Teams
   (`frontend/src/lib/microsoft-graph/teams-live.ts` + `/api/teams-live`). A sync
   hiccup can never again make a page look stale, because the page doesn't depend
   on the synced copy.
2. **One ingestion module feeds RAG only.** Graph → `document_metadata` →
   `document_chunks`. That is the sync's *only* job: feed the AI. Nothing in the
   UI read path depends on it.
3. **One config source, fewer triggers.** Collapse the double-trigger and the 9
   crons toward ~3 (ingest+embed, health, subscription-reconcile) sharing one env.
4. **Silent failure is structurally impossible.** Guards `RAISE EXCEPTION`; writes
   that fail are loud; the existing source-dark alarm (`pipeline_alert_notifier.py`,
   `/api/admin/source-sync/active-alerts`) is the backstop.

## Verified reality (2026-06-24) — what is NOT safe to delete

A read-only inventory initially flagged a lot of "dead/legacy" code. Grep
verification showed most of it is **load-bearing** — do not delete without first
migrating readers:

| Thing | Status | Evidence |
|---|---|---|
| `project_emails` table + writer | **LIVE** — ~25 readers | `/api/emails`, email-thread, advisor-synthesis, assignment-inbox, progress-reports |
| `email_attachments` table | **LIVE** — 6 read routes + `embed.py` | `/api/email-attachments/*`, `/api/projects/*/email-attachments/*` |
| webhook/subscription code | **WIRED** | `scheduler.py`, `api/main.py`, `run_graph_subscription_reconcile` cron |
| `/api/cron/graph-sync`, `/graph-embed` | **ACTIVE Vercel crons** | `frontend/vercel.json` (daily 6am / 7am) — redundant w/ Render every-2h, but live |
| `onedrive_project_assignment_backfill` | **WIRED** | imported by `admin_endpoints.py` |
| `project_document_backfill` (module) | **TESTED** utility | `test_graph_project_document_backfill.py` |

**Genuinely orphaned/retired one-off scripts:** `promote_outlook_attachments.py`,
`backfill_fireflies_meeting_embeddings.py`,
`microsoft_graph/cli_extract_attachment_text.py`, and the former incident bridge
`backfill_outlook_rag_metadata_to_app_documents.py` (retired by AAI-732 after
canonical Outlook intake repair replaced it).

## Phased execution — LIVE STATUS (replace-then-remove, never delete-first)

- [x] **Phase 0 — stop the bleeding** *(done 2026-06-24)*. Lifted the 2026-06-17
  silent block via migration `20260624072508_lift_outlook_ingestion_incident_block_2026_06_17.sql`;
  0 block triggers remain; deleted 4 orphan scripts. Committed + on `origin/main`.
- [x] **Phase 1 — backfill the gap** *(done 2026-06-24)*. Verified the real gap was
  **45** project-assigned docs — not the feared ~1,657 (those were duplicate retries
  or already-embedded). The one-time incident bridge created 45 rows and was later
  retired by AAI-732. Current repairs use `backfill_outlook_intake_rag_documents()`
  and the live Outlook sync path through `SupabaseRagStore.upsert_document_metadata()`.
- [x] **Phase 5 — guardrail** *(done + DEPLOYED LIVE 2026-06-24, commit `ad54606aa`)*.
  `backend/src/services/health/outlook_promotion_freshness.py` detects "intake fresh
  but document store stale"; wired into `pipeline_alert_notifier.py` (run_pipeline_alert_check)
  (15-min cron `alleato-pipeline-alert`, confirmed live with all creds). DMs Teams +
  `/rag` banner + auto-resolve. Verified healthy, no false page.
- [x] **Phase 1.5 — FIX EMBEDDING AUTH (DONE 2026-06-24).** Run ledger:
  `microsoft_graph` is failing **~70% of runs** (464 failed / 116 ok / 87 warn over
  8 days), ALL in the **vectorization** stage. Root cause: **231 docs stuck
  `embedding_status='error'` with `401 Authentication failed … AI_GATEWAY_API_KEY`**
  (last 2026-06-24 09:35 UTC). The graph-sync cron's gateway key is dead and the
  gateway→OpenAI failover isn't rescuing it; `document_pipeline`/fireflies embedding
  *succeeds*, so a working key exists on a peer cron. **Action:** converge graph-sync
  (and peer embedding crons + web) onto a known-good provider key/path, re-drive the
  231 stuck docs, verify the failure rate collapses. *(Same class as
  `incident_graph_embed_gateway_cron_drift` — per-cron key drift recurred.)*
- [x] **Phase 2 — emails read a live, never-blocked source (CORE GOAL MET 2026-06-24).**
  `/api/emails` already reads `outlook_email_intake` (AI DB, never blocked); the dead
  PM-APP `project_emails` projection is abandoned. So the email UI is already immune to
  the `document_metadata` breakage class — the same resilience Teams got. Full
  Graph-*direct* reads (like `teams-live.ts`) remain OPTIONAL and were de-scoped: the
  intake table is already current and Graph-direct adds API load/latency for marginal
  gain. Revisit only if the intake sync itself proves unreliable.
- [ ] **Phase 3 — consolidate triggers.** *Unblocked by Phase 1.5 (sync now healthy),
  but REASSESSED as not-a-quick-deletion (2026-06-24).* The Vercel `graph-embed` route
  provides embedding throughput; removing it could starve embedding right after an
  outage. Needs a real throughput analysis (Render every-2h embed_limit=25 = ~300
  docs/day — is that enough vs the actual daily inflow?) BEFORE removing any trigger.
  De-prioritized below Phase 2. Do NOT blind-delete sync/embed triggers.
- [ ] **Phase 4 — retire legacy tables.** Once all readers are on the live model,
  remove `project_emails` / `email_attachments` write paths and tables.

### Live log
- 2026-06-24 09:25 — Phase 0/1/5 landed (block lifted, 45 bridged, guardrail live).
- 2026-06-24 09:40 — Phase 3 health-check surfaced the embedding-auth 401 → opened
  **Phase 1.5** as a blocker; began converging provider creds across embedding crons.
- 2026-06-24 09:50 — Confirmed embedding **flatlined today**: June 23 = 14 embedded / 0
  errors; June 24 = 1 embedded / **234 errors** (gateway 401). NOT old poison-pill noise —
  the provider auth broke today and ~all queued embeddings are failing now. Active outage.
- 2026-06-24 10:00 — Root cause: BOTH provider keys had hit an auth wall (code tries
  direct OpenAI first per `AI_PROVIDER_PATH=openai`, fails over to the gateway, records
  the gateway 401). Megan refreshed the **Vercel AI Gateway** key. Direct test now:
  OpenAI `HTTP 200` + gateway `HTTP 200`. Cron holds these same keys → auth wall cleared.
  REMAINING: re-drive the ~231 docs parked at `embedding_status='error'` (some at 8
  attempts, past the 6 cap — verify they get re-pulled, not stranded) + confirm failure
  rate collapses on the next runs.
- 2026-06-24 10:15 — Recovery underway. 211 PM-APP docs un-parked (`embed_failed` →
  `raw_ingested`) + 234 RAG records cleared (`embedding_status`/attempts/error reset).
  First drain batch: **embedded 40 / errors 0** — pipeline confirmed working with the
  refreshed key. Draining the remaining ~190 now.
- 2026-06-24 10:30 — Embedding **guardrail (b) DONE + DEPLOYED LIVE** (commit
  `26f874987`, cron `alleato-pipeline-alert` running it). `embedding_freshness.py`
  flags ≥40 recent embedding errors / 180 min; verified healthy. Recovery (a) ~95%:
  backlog drained from 234 → ~33 (drain still finishing); error rate collapsed. Both
  the promotion + embedding guardrails are now live on the 15-min alert cron.
- 2026-06-24 10:40 — **Phase 1.5 DONE.** Drain complete: 407 docs re-embedded, **0
  errors**. `embedding_status='error'` count **234 → 0**. Residual 15 `NULL` are
  intentionally-excluded (`skipped_disabled`) + normal new arrivals, not stuck. Both
  guardrails live.
- 2026-06-24 10:50 — **Pipeline verified healthy end-to-end.** Graph-sync runs since
  10:00: 7 succeeded / 1 warning / 2 failed (the 2 were a drain↔cron race, now 0 active
  errors, last embed success 10:15). Both guardrails report `healthy` against live data.
  `/api/emails` confirmed reading live `outlook_email_intake` (Phase 2 core goal met).
  **State of the actual problem (pipeline silently breaking): RESOLVED + GUARDED.** The
  two silent-failure modes that bit recently (2026-06-17 block, 2026-06-24 embed 401)
  are both fixed AND now have loud guardrails. Remaining phases (3 cron-consolidation,
  4 legacy-table retirement) are improvements that carry real "make-sync-dark" /
  "break-readers" risk and must NOT be rushed — deliberate next steps, not triage.

## Hard rules for this rebuild

- No new in-DB trigger that isn't also a committed migration file.
- No guard that returns `null` to reject a write — `RAISE EXCEPTION` only.
- Replace readers before removing their source table.
- Verify against the DB before claiming any path is dead.
