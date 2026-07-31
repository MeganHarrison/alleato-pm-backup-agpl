# Handoff: 2026-06-23 - RAG Pipeline Dashboard And Lifecycle Recovery

## Intake Block

1) Session ID: S88
2) Task ID: rag-pipeline-dashboard-and-lifecycle
3) Linear issue: AAI-598
4) Linear URL: https://linear.app/megankharrison/issue/AAI-598/build-daily-rag-pipeline-trust-dashboard-and-failure-alerts
5) Current status: In Progress
6) Files changed (absolute paths):
   - /Users/meganharrison/Documents/alleato-pm/backend/src/scripts/backfill_fireflies_meeting_embeddings.py
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-23-rag-pipeline-remaining-work.md
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-23-S88-rag-pipeline-dashboard-and-lifecycle.md
7) Commands run and outcome (pass/fail counts):
   - PASS: `python3 - <<'PY' ... yaml.safe_load(open('backend/render.yaml')) ... PY` parsed Render YAML and found `alleato-graph-sync` plus `alleato-graph-embedding`.
   - PASS: `cd backend && APP_DB_PRESSURE_GUARD_REQUIRED=true MICROSOFT_SYNC_USERS=bclymer@alleatogroup.com OUTLOOK_SYNC_MAX_USERS=1 OUTLOOK_SYNC_MAX_MESSAGES_PER_MAILBOX=50 GRAPH_DELTA_MAX_PAGES=3 GRAPH_DELTA_MAX_ITEMS=250 ../backend/.venv/bin/python src/scripts/run_graph_sync_phase.py outlook --skip-embedding --skip-ocr --skip-attachment-promotion` synced `41` Outlook rows.
   - PASS: same fetch-only Outlook phase for `awehner@alleatogroup.com` synced `14` rows.
   - PASS: `PYTHONPATH=/Users/meganharrison/Documents/alleato-pm/backend APP_DB_PRESSURE_GUARD_REQUIRED=true backend/.venv/bin/python backend/src/scripts/backfill_outlook_rag_metadata_to_app_documents.py --days 1 --limit 200 --apply true` created `17` app `document_metadata` bridge rows.
   - PASS: `PYTHONPATH=/Users/meganharrison/Documents/alleato-pm/backend APP_DB_PRESSURE_GUARD_REQUIRED=true ALLOW_PM_APP_FINAL_PROJECTIONS=true backend/.venv/bin/python backend/src/scripts/backfill_source_operating_records.py --limit 5 --recent-days 1 --force` processed `5/5` Outlook rows into task outcomes and Project Intelligence evidence.
   - PASS: `PYTHONPATH=/Users/meganharrison/Documents/alleato-pm/backend APP_DB_PRESSURE_GUARD_REQUIRED=true backend/.venv/bin/python -m src.scripts.backfill_fireflies_meeting_embeddings --limit 10` embedded `9` Fireflies meetings with `68` chunks and `0` errors after the AI Gateway patch.
   - PASS: `PYTHONPATH=/Users/meganharrison/Documents/alleato-pm/backend APP_DB_PRESSURE_GUARD_REQUIRED=true ALLOW_PM_APP_FINAL_PROJECTIONS=true backend/.venv/bin/python backend/src/scripts/backfill_source_operating_records.py --ids-json '[...]' --force` processed `8/8` assigned Fireflies meetings into task outcomes and Project Intelligence evidence.
   - PASS: `node scripts/verify/backfill_source_lifecycle_from_current_state.mjs --days 1 --source-limit 1500` wrote `727` lifecycle rows after each bounded compiler batch.
   - PASS: `cd frontend && npx eslint src/app/'(admin)'/rag/page.tsx src/app/api/admin/rag-snapshots/route.ts --cache --cache-strategy content`.
   - PASS: `PYTHONPATH=/Users/meganharrison/Documents/alleato-pm/backend backend/.venv/bin/python -m py_compile backend/src/scripts/backfill_fireflies_meeting_embeddings.py`.
   - FAIL/HANDLED: `cd backend && APP_DB_PRESSURE_GUARD_REQUIRED=true GRAPH_EMBEDDING_LIMIT=25 ... _run_graph_embedding(limit=25)` was blocked by app DB pressure guard: `total_connections=36>35`. Do not bypass this guard.
   - FAIL/HANDLED: pre-patch `backfill_fireflies_meeting_embeddings.py --limit 10` called direct OpenAI and failed `9/9` rows with `insufficient_quota`. This is the failure that the AI Gateway patch fixes.
8) Evidence artifacts (screenshot/video/report/log paths):
   - `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/rag-outlook-5-complete-desktop-loaded-2026-06-23.png`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/rag-meetings-outlook-progress-loaded2-2026-06-23.png`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/rag-sync-history-added-complete-no-icon-noise.png`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/rag-outlook-ai-db-added-complete.png`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-23-rag-pipeline-remaining-work.md`
9) Top 3 findings (frontend-visible issues first):
   - `/rag` is now showing the right kind of daily truth for Outlook and Meetings: added versus complete, where complete means vectorized, project assigned, task outcome, and Project Intelligence evidence.
   - Outlook was syncing into the AI/RAG database while older app-mirror reads made it look stale; `/rag` now reads Outlook inventory from `rag_document_metadata`.
   - Fireflies meeting embedding had a real provider split: the old script bypassed AI Gateway and used quota-limited direct OpenAI. The patched script uses shared `ai_transport.get_openai_client()`.
10) Recommended next action (one line): Fix the four remaining 2026-06-23 meeting blockers first, then continue bounded Outlook compiler/vectorization batches.
11) Handoff file path: docs/ops/handoffs/2026-06-23-S88-rag-pipeline-dashboard-and-lifecycle.md
12) Migration ledger evidence: No migration in this slice.

## Linear Updates

- Kickoff comment: Not posted from this session; this handoff is a continuation of active AAI-598 RAG recovery work already tracked in the task ledger.
- Milestone comments: Not posted from this session. Use this handoff content as the next Linear update body if the next session has Linear connector access.
- Completion/blocker comment: Not posted because the task is still `In Progress`, not ready for review or acceptance.

## Current Status

This is not complete. It is materially improved and now has concrete current-state evidence.

Current visible `/rag` dashboard state after the latest browser refresh:

| Date | Outlook Added | Outlook Complete | Meetings Added | Meetings Complete | Teams Synced | Day Total | Open |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tue, Jun 23 | 56 | 5 | 10 | 6 | 92 | 158 | 55 |

Current direct table read-back for 2026-06-23:

| Source | Added | Vectorized | Project Assigned | Tasks Extracted | PI Updated | Complete |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Outlook | 56 | 30 | 17 | 5 | 5 | 5 |
| Meetings | 10 | 9 | 8 | 8 | 7 | 6 |

Lifecycle refresh after the meeting compiler batch wrote `727` rows and reported:

- `fireflies`: `9` `project_intelligence_updated`, `2` `project_assignment_review`
- `microsoft_graph_outlook`: `57` `project_intelligence_updated`, `175` `indexed_for_rag`, `12` `project_assigned`, `261` `project_assignment_review`
- `microsoft_graph_teams`: `14` `failed_permanent`, `25` `project_assignment_review`
- `microsoft_graph_sharepoint`: `46` `project_intelligence_updated`, `126` `project_assignment_review`

## Exact Files Used Or Inspected

Primary UI/API files:

- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(admin)/rag/page.tsx`
  - `/rag` tabbed dashboard.
  - Relevant logic: `firstColumnLabel`, `secondColumnLabel`, `firstValueFor`, `secondValueFor`, `rowTotalFailed`, and `DailySyncHistory`.
  - Current behavior: Outlook and Meetings show `Added / Complete`; other sources show `Synced / Failed`.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/admin/rag-snapshots/route.ts`
  - Daily sync history API.
  - Current behavior: Meeting counts come from app `document_metadata`; Outlook counts come from RAG `rag_document_metadata`.
  - Important stage fields added earlier in this work: `outlook_added`, `outlook_vectorized`, `outlook_project_assigned`, `outlook_tasks_extracted`, `outlook_project_intelligence_updated`, `outlook_complete`; same pattern exists for meetings.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/admin/operations-readiness/status/route.ts`
  - Inspected for stale `graph_sync_state` reads.
  - It already uses `createRagServiceClient()` for `graph_sync_state`.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/source-health.ts`
  - Inspected for stale source health.
  - It already reads `source_sync_health_snapshots` and `graph_subscriptions` from the RAG DB.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tools/operational.ts`
  - Inspected for Outlook assistant path.
  - It already uses `createRagServiceClient()` for `outlook_email_intake` and `graph_sync_state`.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tools/outlook-operations.ts`
  - Inspected by search; already uses RAG service client.

Backend/runtime files:

- `/Users/meganharrison/Documents/alleato-pm/backend/render.yaml`
  - Important local changes were already present when this handoff was written:
    - `alleato-graph-sync` is fetch-only: `run_embedding=False`, `run_ocr=False`, `run_attachment_promotion=False`.
    - `GRAPH_SYNC_ONEDRIVE` is `false`.
    - `GRAPH_SYNC_SHAREPOINT` is `true`.
    - new `alleato-graph-embedding` cron runs `_run_graph_embedding(limit=25)` every 5 minutes.
  - YAML parse passed. Verify whether these changes are already committed/deployed before assuming production is fixed.
- `/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/run_graph_sync_phase.py`
  - Used for bounded fetch-only Outlook sync.
- `/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/backfill_outlook_rag_metadata_to_app_documents.py`
  - Used to bridge assigned RAG-only Outlook rows into app `document_metadata`.
  - This is still needed while the compiler is app-catalog-first.
- `/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/backfill_source_operating_records.py`
  - Used to run bounded compiler batches.
  - Requires `ALLOW_PM_APP_FINAL_PROJECTIONS=true` for bounded final projection runs, or it fails at `project_operating_snapshot_projection`.
- `/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/backfill_fireflies_meeting_embeddings.py`
  - Modified in this slice.
  - Now loads root env and uses shared AI Gateway-aware `get_openai_client()` plus `retry_ai_call()`.
- `/Users/meganharrison/Documents/alleato-pm/backend/src/services/ai_transport.py`
  - Source of truth for AI provider path.
  - `get_openai_client()` prefers AI Gateway when `AI_GATEWAY_API_KEY` exists.
- `/Users/meganharrison/Documents/alleato-pm/backend/src/services/integrations/microsoft_graph/embed.py`
  - Used as reference for gateway-aware embedding pattern.
  - Already uses `get_openai_client()` and `retry_ai_call()`.
- `/Users/meganharrison/Documents/alleato-pm/backend/src/services/health/source_sync_health.py`
  - Inspected; Graph sync state reads use `get_rag_read_client()`.

Verification and lifecycle files:

- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/backfill_source_lifecycle_from_current_state.mjs`
  - Run after compiler batches.
  - This is what made `/rag` and lifecycle status reflect current state.
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_source_lifecycle_health.mjs`
  - Use this next for compact authoritative source-stage health.
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_source_processing_provider_auth.mjs`
  - Use this for provider-auth regression after deploy.
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_graph_embedding_contract.mjs`
  - Use after app DB pressure drops or in a subagent.

Task/evidence files:

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-23-rag-pipeline-remaining-work.md`
  - Updated with current Outlook and Meetings evidence.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-23-S88-rag-pipeline-dashboard-and-lifecycle.md`
  - This handoff.

## Exact Next Step

Start with the four meeting blockers because they are bounded and the user specifically called out meetings:

1. Investigate why `Interview Alleato Group (Accountant-Francis)` has task/PI but still fails strict vectorized count.
2. Investigate why `Weekly OPS (Estimators)` has task evidence but no accepted full-transcript read proof.
3. Classify `Union Invoices` and `End of the year party-Folllow up` as either project-assigned or explicit non-project/excluded. Do not guess.
4. Refresh lifecycle:

```bash
node scripts/verify/backfill_source_lifecycle_from_current_state.mjs --days 1 --source-limit 1500
```

Then reload `/rag` and capture a new screenshot.

## Resume Commands

Environment note: do not print secret values. Use root `.env` only through `load_env()` or shell sourcing when required by older scripts.

Check current dirty state:

```bash
git status --short
git diff --stat
```

Re-read current 2026-06-23 Outlook and Meeting counts:

```bash
cd frontend
DOTENV_CONFIG_PATH=../.env node --input-type=module -r dotenv/config - <<'NODE'
import { createClient } from '@supabase/supabase-js';
const appUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const appKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const ragUrl = process.env.RAG_SUPABASE_URL || appUrl;
const ragKey = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY || appKey;
const app = createClient(appUrl, appKey, { auth: { persistSession: false } });
const rag = createClient(ragUrl, ragKey, { auth: { persistSession: false } });
const since = '2026-06-23T00:00:00.000Z';
const tomorrow = '2026-06-24T00:00:00.000Z';
async function all(p) { const { data, error } = await p; if (error) throw error; return data || []; }
function batches(a,n){let r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r;}
async function sourceCounts(kind){
  const isMeeting = kind === 'meeting';
  const docs = isMeeting
    ? await all(app.from('document_metadata').select('id,created_at,project_id,title').eq('type','meeting').eq('source','fireflies').gte('created_at', since).lt('created_at', tomorrow).limit(10000))
    : await all(rag.from('rag_document_metadata').select('id,created_at,project_id,title').eq('source','microsoft_graph').eq('type','email').gte('created_at', since).lt('created_at', tomorrow).limit(10000));
  const ids=docs.map(d=>d.id); let chunks=[], tasks=[], evidence=[], jobs=[];
  for (const b of batches(ids, 100)) {
    chunks.push(...await all(rag.from('document_chunks').select('document_id').in('document_id', b).not('embedding','is',null).limit(10000)));
    tasks.push(...await all(app.from('tasks').select('metadata_id').in('metadata_id', b).gte('created_at', since).limit(10000)));
    evidence.push(...await all(app.from('insight_card_evidence').select('source_document_id').in('source_document_id', b).gte('created_at', since).limit(10000)));
    jobs.push(...(await all(rag.from('source_intelligence_jobs').select('source_document_id,output_summary,updated_at,status').in('source_document_id', b).gte('updated_at', since).limit(10000))).map(j=>({metadata_id:j.source_document_id, job_metadata:j.output_summary, updated_at:j.updated_at, status:j.status})));
  }
  const embedded=new Set(chunks.map(r=>r.document_id));
  const taskIds=new Set(tasks.map(r=>r.metadata_id));
  const evidenceIds=new Set(evidence.map(r=>r.source_document_id).filter(Boolean));
  const jobMeta=new Map();
  for (const j of jobs) {
    if (!j.metadata_id) continue;
    const old=jobMeta.get(j.metadata_id);
    if (!old || String(j.updated_at||'') > String(old.updated_at||'')) jobMeta.set(j.metadata_id,j);
  }
  function hasTask(id){
    if(taskIds.has(id)) return true;
    const m=jobMeta.get(id)?.job_metadata||{};
    return ['task_signal_staged','tasks_created','no_actionable_tasks','external_assignee_skipped','skipped_no_project'].includes(m.task_extraction_status);
  }
  function hasReadProof(id){
    if(!isMeeting) return true;
    const m=jobMeta.get(id)?.job_metadata||{};
    const rp=m.read_proof||m.full_source_read_proof;
    return Boolean(rp && rp.status === 'full_source_read');
  }
  const counts={added:docs.length, vectorized:0, projectAssigned:0, tasksExtracted:0, projectIntelligenceUpdated:0, complete:0, missing:[]};
  for (const d of docs) {
    const v=embedded.has(d.id), p=d.project_id!=null, t=hasTask(d.id), pi=evidenceIds.has(d.id) && hasReadProof(d.id);
    const c=v&&p&&t&&pi;
    counts.vectorized+=v?1:0; counts.projectAssigned+=p?1:0; counts.tasksExtracted+=t?1:0; counts.projectIntelligenceUpdated+=pi?1:0; counts.complete+=c?1:0;
    if(!c) counts.missing.push({title:d.title,id:d.id,project_id:d.project_id,vectorized:v,task:t,pi});
  }
  return counts;
}
console.log(JSON.stringify({date:'2026-06-23', outlook: await sourceCounts('outlook'), meetings: await sourceCounts('meeting')}, null, 2));
NODE
```

Run lifecycle refresh:

```bash
node scripts/verify/backfill_source_lifecycle_from_current_state.mjs --days 1 --source-limit 1500
```

Run frontend checks after touching `/rag`:

```bash
cd frontend
npx eslint src/app/'(admin)'/rag/page.tsx src/app/api/admin/rag-snapshots/route.ts --cache --cache-strategy content
```

Run Python syntax check after touching backend scripts:

```bash
PYTHONPATH=/Users/meganharrison/Documents/alleato-pm/backend backend/.venv/bin/python -m py_compile backend/src/scripts/backfill_fireflies_meeting_embeddings.py
```

Capture browser evidence:

```bash
agent-browser set viewport 1600 1200
agent-browser open http://localhost:3001/rag
agent-browser wait 10000
agent-browser screenshot --full frontend/tests/agent-browser-runs/rag-next-proof-2026-06-23.png
```

## Remaining Work

### Meeting Transcripts

- Fix or classify the four incomplete 2026-06-23 meetings:
  - `Weekly OPS (Estimators)` - vectorized and task outcome exists, but strict full-transcript read proof was not accepted in the read-back.
  - `Union Invoices` - vectorized, no project assignment, no task/PI.
  - `Interview Alleato Group (Accountant-Francis)` - task/PI exists, but strict vectorized count is false in the current read-back.
  - `End of the year party-Folllow up` - vectorized, no project assignment, no task/PI.
- Do not mark non-project meetings as complete unless the dashboard/API has an explicit exclusion path.

### Outlook

- Today is only `5/56` complete.
- Next likely steps:
  - Run graph embedding when app DB pressure guard allows it.
  - Continue `backfill_outlook_rag_metadata_to_app_documents.py` for assigned rows if new bridge gaps appear.
  - Run bounded compiler batches with `ALLOW_PM_APP_FINAL_PROJECTIONS=true`.
  - Refresh lifecycle after each batch.
- Do not run an unbounded compiler drain in the main thread.

### Teams

- Current lifecycle still shows Teams project assignment review and failed-permanent rows.
- Need normalize contradictory low-content/project-review rows before claiming health.
- Teams source lookup verification still pending.

### SharePoint

- SharePoint is the only active file source of truth; OneDrive sync should stay disabled.
- Current lifecycle still shows many SharePoint project-assignment-review rows.
- Need deterministic assignment/exclusion buckets only; do not guess projects.

### Notifications

- Notification proof remains pending.
- Need verify watchdog alert persistence plus immediate Teams/email notification handling.

### Deploy/Production

- Verify whether `backend/render.yaml` changes are committed and deployed.
- Production must have `AI_GATEWAY_API_KEY` configured on Render.
- The graph fetch cron must remain fetch-only; embedding must stay separate so provider/vectorization issues do not stop source ingestion.

## Known Pitfalls

- Plain `curl http://localhost:3001/api/admin/rag-snapshots` returns `401` without the browser session. Use browser/agent-browser or direct service-client read-back.
- The app DB and RAG DB are separate. Current Outlook source of truth is RAG DB `rag_document_metadata`, `outlook_email_intake`, `graph_sync_state`, and `source_sync_runs`, not app DB `document_metadata` alone.
- `backend/src/scripts/backfill_source_operating_records.py` will fail final projection unless `ALLOW_PM_APP_FINAL_PROJECTIONS=true` is set for bounded runs.
- App DB pressure guard blocked graph embedding at `total_connections=36>35`; do not bypass this. Wait, delegate, or run when pressure is lower.
- Some existing scripts do not auto-load root `.env`. The patched Fireflies embedding script now does; other scripts may still require shell sourcing or `src.services.env_loader.load_env()`.
- Do not expose secret values in logs or handoff comments.
- Do not use OneDrive as a file source; it is duplicate/stale for this workflow.

## Code That Still Exists And Should Be Archived Or Consolidated

Archive only after confirming no scheduled job or task doc still references the path. The goal should be one maintained path per operation, not a pile of one-off repair scripts.

Strong archive/consolidation candidates:

- `/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/backfill_transcript_chunks.py`
  - Older Fireflies transcript repair path with manual `sys.path` bootstrap and direct Fireflies API flow.
  - It predates the current RAG DB/content/read-proof model.
  - Before archiving, verify whether any docs or active runbooks still prescribe it.
- `/Users/meganharrison/Documents/alleato-pm/scripts/backfill-fireflies-transcript-chunks-from-storage.mjs`
  - Another Fireflies transcript/chunk repair path outside backend.
  - Potentially overlaps with backend Fireflies ingestion and the newer meeting embedding repair.
  - Should be moved to `scripts/archive/...` or folded into a single maintained Fireflies repair command after checking current references.
- `/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/backfill_fireflies_meeting_embeddings.py`
  - Do not archive immediately because it was just patched and used successfully.
  - Long-term, this should become part of the normal Fireflies ingestion/vectorization path or a shared `fireflies embed pending` command, not remain as a standalone emergency script.
- `/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/backfill_outlook_rag_metadata_to_app_documents.py`
  - Do not archive now; it is currently required because the compiler is app-catalog-first.
  - Long-term, remove or archive it only after the ingestion/compiler contract guarantees assigned Outlook RAG rows automatically get app catalog rows or the compiler can process RAG-only documents directly.
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/backfill_onedrive_project_assignments_from_source_path.mjs`
  - Likely stale for this goal because OneDrive sync is intentionally disabled and SharePoint is the file source of truth.
  - Archive after verifying no active SharePoint path depends on it.
- `/Users/meganharrison/Documents/alleato-pm/scripts/archive/2026-06-22-root-helpers/backfill_outlook_document_metadata.py`
  - Already archived; do not resurrect it. Use `backend/src/scripts/backfill_outlook_rag_metadata_to_app_documents.py` if a bridge is still needed.
- `/Users/meganharrison/Documents/alleato-pm/scripts/archive/2026-06-22-root-helpers/backfill_outlook_intake_from_metadata.py`
  - Already archived; do not resurrect it.

Code that should remain active for now:

- `/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/run_graph_sync_phase.py`
- `/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/backfill_source_operating_records.py`
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/backfill_source_lifecycle_from_current_state.mjs`
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_source_lifecycle_health.mjs`
- `/Users/meganharrison/Documents/alleato-pm/backend/src/services/integrations/microsoft_graph/embed.py`
- `/Users/meganharrison/Documents/alleato-pm/backend/src/services/ai_transport.py`

## Evidence

- `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/rag-meetings-outlook-progress-loaded2-2026-06-23.png`
  - Shows `/rag` with Tue Jun 23 Outlook `56 added / 5 complete`, Meetings `10 added / 6 complete`, Day Total `158`, Open `55`.
- `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/rag-outlook-5-complete-desktop-loaded-2026-06-23.png`
  - Earlier proof after Outlook compiler batch.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-23-rag-pipeline-remaining-work.md`
  - Updated with current evidence and remaining blockers.

## Final Notes For Next Session

- Do not waste time re-litigating whether emails synced today. They did: today has `56` Outlook rows in RAG `rag_document_metadata`.
- The question is no longer "did source sync run?" The question is which rows finished all required stages.
- For Meetings, the next session can get a visible win quickly by resolving the four named blockers.
- For Outlook, the next session should use bounded batches and lifecycle refreshes. Do not wait on huge embedding drains in the main thread.
- If making code changes, keep the task file updated before claiming done.
