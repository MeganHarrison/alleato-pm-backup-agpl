# Handoff — Ingestion pipeline completion + observability

**Created:** 2026-06-24 · **For:** a separate Claude Code (cloud) session · **Owner of this handoff:** Megan

You are picking up the **sync → embed → intelligence pipeline completion** workstream.
The goal: every email, Teams message, meeting transcript, and document that syncs each
day should reliably **finish through to completion** (vectorized + project-assigned +
intelligence-updated), and the `/rag` dashboard should accurately show that funnel.

This is self-contained — read it cold and execute. Do not assume prior context.

---

## 0. Architecture you must know first

Two Supabase projects (using the wrong one silently fails):

| Project | Ref | Holds |
|---|---|---|
| **PM APP** | `lgveqfnpkxvzbnnwuled` | `projects`, `document_metadata` (the app catalog), `intelligence_packets`, etc. |
| **AI DB (RAG)** | `fqcvmfqldlewvbsuxdvz` | `rag_document_metadata` (per-doc embedding state), `document_chunks` (vectors), `outlook_email_intake` (raw inbox), `source_processing_jobs`, `pipeline_model_usage`, `system_alerts` |

The pipeline funnel (what `/rag` visualizes per source per day):
**Synced → Vectorized → Project-assigned → Tasks extracted → Project-intelligence updated.**

- "Synced" = a row landed in `document_metadata` / `rag_document_metadata` / `outlook_email_intake`.
- "Vectorized / completed" = `rag_document_metadata.embedding_status = 'embedded'` and rows exist in `document_chunks`.
- Embedding model: `text-embedding-3-large` (halfvec 3072). Embed code:
  `backend/src/services/integrations/microsoft_graph/embed.py` (`embed_pending_graph_documents`).
- Embedding runs from the `alleato-graph-sync` Render cron (every 2h, `embed_limit=25`) and inline at end of each graph sync. There is also a redundant Vercel cron (`/api/cron/graph-embed`) — see the rebuild plan.

Provider auth note: embedding + synthesis use `get_openai_client()` in
`backend/src/services/ai_transport.py` — Vercel AI Gateway (`AI_GATEWAY_API_KEY`) with
direct-OpenAI fallback (`OPENAI_API_KEY`). **Per-cron key drift is the recurring failure
class.** When embedding "suddenly fails," check that key first.

---

## TASK 1 (do first) — Clear today's embedding error backlog

As of 2026-06-24 ~17:30, today's `rag_document_metadata` (created today, UTC) shows a
**completion gap**:

| Source | Synced today | Embedded | **Errored** | In progress |
|---|---|---|---|---|
| Teams | 254 | 128 | **31** | 95 |
| Outlook (emails) | 43 | 18 | **25** | 0 |
| Meetings | 5 | 0 | 0 | 5 |

~56 docs are stuck at `embedding_status='error'`. **Hypothesis:** residue from this
morning's AI-gateway key outage (the gateway key 401'd ~Jun 17–24; Megan refreshed it
~10:00 today and embedding was confirmed working again). The "in progress" rows are
normal cron lag and will clear on their own; the **errored** rows will NOT retry once
past the attempt cap — they need a re-drive.

**Steps:**
1. Confirm the errors are stale (auth) not fresh. Query AI DB:
   ```sql
   SELECT left(coalesce(embedding_error,'(none)'),120) AS err, count(*),
          to_char(max(embedding_last_attempt_at),'HH24:MI') AS last_attempt
   FROM public.rag_document_metadata
   WHERE embedding_status='error'
   GROUP BY 1 ORDER BY 2 DESC;
   ```
   If the error is `401 ... AI_GATEWAY_API_KEY` / "Authentication failed", it's the stale
   auth outage → safe to re-drive. If it's a content/parse error, investigate that doc.
2. Verify the key actually works now (no new outage). From repo root with `.env`:
   ```bash
   OPENAI_KEY=$(grep -E '^OPENAI_API_KEY=' .env | cut -d= -f2- | tr -d '"')
   GW_KEY=$(grep -E '^AI_GATEWAY_API_KEY=' .env | cut -d= -f2- | tr -d '"')
   curl -s -o /dev/null -w "OpenAI %{http_code}\n" https://api.openai.com/v1/embeddings \
     -H "Authorization: Bearer $OPENAI_KEY" -H "Content-Type: application/json" \
     -d '{"model":"text-embedding-3-large","input":"ping","dimensions":3072}'
   curl -s -o /dev/null -w "Gateway %{http_code}\n" https://ai-gateway.vercel.sh/v1/embeddings \
     -H "Authorization: Bearer $GW_KEY" -H "Content-Type: application/json" \
     -d '{"model":"text-embedding-3-large","input":"ping","dimensions":3072}'
   ```
   Both must be `200`. If `401`, the key drifted again — fix it on Render (the
   `alleato-graph-sync` cron crn-d827dut7vvec73b33fa0) and re-test before re-driving.
3. **Re-drive** (this exact procedure cleared 234 stuck docs earlier today):
   - AI DB — reset the failed embedding bookkeeping so they retry clean:
     ```sql
     UPDATE public.rag_document_metadata
     SET embedding_status=NULL, embedding_attempts=0, embedding_error=NULL
     WHERE embedding_status='error'
       AND embedding_error ILIKE '%uthentication failed%';   -- scope to the auth casualties
     ```
   - PM APP — un-park any docs parked past the attempt cap so the candidate query re-pulls
     them (the candidate query selects `status IN ('raw_ingested','segmented','compiled','error','ocr_partial')`):
     ```sql
     UPDATE public.document_metadata SET status='raw_ingested' WHERE status='embed_failed';
     ```
   - Drain the queue locally (proven pattern — needs repo-root `.env` with the working keys):
     ```bash
     RAG_DATABASE_READS_ENABLED=true RAG_DATABASE_WRITES_ENABLED=true \
     ALLOW_PM_APP_FINAL_PROJECTIONS=true PYTHONPATH=backend python3 -c "
     from dotenv import load_dotenv; load_dotenv('.env')
     from src.services.supabase_helpers import get_supabase_client
     from src.services.integrations.microsoft_graph.embed import embed_pending_graph_documents
     import json
     for i in range(8):
         r = embed_pending_graph_documents(get_supabase_client(), limit=50)
         print(json.dumps(r, default=str)[:400])
         if (r.get('embedded',0) or 0)==0 and (r.get('skipped',0) or 0)==0: break
     "
     ```
4. **Verify**: re-run the Task-1 table query — `errored` should drop to ~0 and `embedded`
   should rise. Confirm `document_chunks` got new rows for those `document_id`s.

---

## TASK 2 — Verify the `/rag` dashboard is accurate

`/rag` (`frontend/src/app/(admin)/rag/page.tsx`, admin-only) is the canonical view: per
source (SharePoint, Outlook, Meetings, Teams, Acumatica), the funnel
**Synced → Vectorized → Assigned → Tasks → Intelligence** per day. Data comes from
`/api/admin/rag-snapshots` (`DailySyncRow`) and a lifecycle endpoint
(`LifecycleDocumentsResponse`).

**These dashboards have had data-accuracy bugs** (false "stale" alerts; counts mislabeled).
Tasks:
1. Run the dev server (`/Users/meganharrison/Documents/alleato-pm`, port 3001 required —
   use the preview tooling, not raw `npm`), log in (`test1@mail.com` / `test12026!!!`),
   open `/rag`, screenshot today's column.
2. Cross-check the page's today numbers against the Task-1 raw SQL. If they disagree,
   the bug is in `/api/admin/rag-snapshots` or the lifecycle endpoint — find and fix the
   query (likely a timezone boundary or a source→category mapping mismatch).
3. Confirm the **"Packet Refresh Failed"** alert is gone (74 dead `packet_refresh_jobs`
   rows were retired 2026-06-24; that queue is dead legacy — see the rebuild plan).

---

## TASK 3 — Add a completion-lag guardrail (so this can't silently regress)

Two guardrails already exist and ride the `alleato-pipeline-alert` cron (every 15 min,
wired into `backend/src/services/health/pipeline_alert_notifier.py:run_pipeline_alert_check`):
- `backend/src/services/health/outlook_promotion_freshness.py` — intake fresh but document store stale.
- `backend/src/services/health/embedding_freshness.py` — burst of recent embedding errors.

**Gap:** neither catches a slow *completion lag* (lots synced, few embedded, but not a
hard error burst). Add a check (same pattern as the two above — a small isolated module
returning `{status, detail, exit_code}`, wired into `run_pipeline_alert_check` best-effort)
that pages when, over the last N hours, `embedded / synced` for a source drops below a
threshold (e.g. < 60% with ≥ 50 synced). Verify it reports healthy now, commit, push,
confirm the cron auto-deploys it (Render `alleato-pipeline-alert` autoDeploy=yes).

**Hard rules:** loud failures only (RAISE/return, never silent null); commit any in-DB
trigger as a migration; no `eslint-disable`; verify against the DB before claiming a path
dead. The pre-commit RAG-docs gate fires on `backend/src/services/intelligence/**` and
`backend/src/services/pipeline/**` and embed paths — update `docs/architecture/AI-RAG-ARCHITECTURE.md`
or use `[skip-rag-docs]` for genuine no-ops.

---

## Reference

- Full pipeline + rebuild context: `docs/architecture/email-sync-rebuild-plan.md`,
  `docs/architecture/COMMUNICATIONS-DATA-PIPELINE.md`, `docs/architecture/AI-RAG-ARCHITECTURE.md`.
- Render: `alleato-graph-sync` (crn-d827dut7vvec73b33fa0, embed every 2h),
  `alleato-pipeline-alert` (crn-d8th3jf7f7vs73f3e0jg, every 15 min). render.yaml is doc-only;
  env lives per-cron (drift is the recurring bug — re-converge keys via Render API).
- Test creds in repo-root `.env` (`TEST_USER_1`/`TEST_PASSWORD_1`); never ask Megan to log in.
- Best project for verification: 1009 (Union Collective) or 67 (Vermillion Rise).
