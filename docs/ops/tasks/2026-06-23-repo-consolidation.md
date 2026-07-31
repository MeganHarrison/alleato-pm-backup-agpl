# Task Brief: Consolidate `render.yaml` + triage one-off scripts

> Self-contained handoff for a fresh Claude Code session. Front-loads the facts
> and landmines so it can act without prior conversation context.
> Created 2026-06-23.

## Context you need (verify, don't trust)
- This repo deploys to **Render**. **No Render blueprint is linked**
  (`GET https://api.render.com/v1/blueprints` returns empty), so **`render.yaml`
  is documentation only — nothing auto-applies it.** Live crons/services are
  managed directly via the Render API. `RENDER_API_KEY` is in root `.env`.
- A pre-commit guard (`.husky/pre-commit`) now blocks re-adding `archive/`
  folders or `.bak/.old/.orig` files under `scripts/`/`backend/`. Deletions are fine.
- **Do not expose secret values** in output/logs/commits.

---

## Task A — Consolidate the two `render.yaml` files into one

**Problem:** two configs disagree and both are stale:
- root `render.yaml` — 17 services, current, includes the `alleato-pipeline-alert` cron.
- `backend/render.yaml` — 9 services, outdated subset; `backend/deploy.sh` tells people to use it.

**These reference `backend/render.yaml` and must be updated if you delete it:**
```
AGENTS.md
backend/deploy.sh
.agents/skills/deep-agents-backend-module/SKILL.md
docs/architecture/AI-RAG-ARCHITECTURE.md
scripts/verify/verify-render-web-scheduler-disabled.mjs
scripts/verify/verify_deep_agents_docs_wiki_render_env.mjs
scripts/verify/verify_deep_agents_nonprod_readiness.mjs
scripts/verify/verify_project_intelligence_live_paths.mjs
```

**Steps:**
1. Fetch the live truth: `GET /v1/services?limit=50` (Bearer `RENDER_API_KEY`).
   For each cron, also read its `serviceDetails.schedule` and `dockerCommand`.
   This is the **actual** state.
2. Make **root `render.yaml`** the single canonical file. Reconcile it so every
   service/schedule/command **matches live exactly** (add anything live that's
   missing, e.g. confirm `alleato-pipeline-alert` and `alleato-graph-sync`; note
   the `alleato-graph-embedding` 5-min cron in `backend/render.yaml` does **not**
   exist live).
3. `git rm backend/render.yaml`. Update the 8 referencing files to point to root
   `render.yaml`.
4. **Do NOT link the blueprint to Render** as part of this task. Linking a
   blueprint that doesn't perfectly match live makes Render create/modify/**delete**
   services on sync — destructive. Keep `render.yaml` as the documented single
   source; add a `# NOTE: not blueprint-linked; live config is managed via Render API`
   header. Linking can be a separate, deliberate task only after the file is
   verified byte-accurate against live.

**Done when:** one `render.yaml`, no references to `backend/render.yaml` remain
(`git grep backend/render.yaml` is clean except git history), and the file
matches `GET /v1/services`.

---

## Task B — Triage one-off scripts (selective delete, NOT blanket)

**Hard exclusions — do NOT delete these (they are not dead code):**
- `supabase/migrations/*backfill*` — applied migration history. Never delete.
- `backend/src/services/**/*backfill*.py` — imported service modules.
- `frontend/src/app/api/**/*backfill*` — live API routes.
- Anything imported by another `.py`/`.ts` (grep before deleting).

**KEEP (load-bearing — confirmed via `package.json` refs + the S88 handoff):**
```
backend/src/scripts/run_graph_sync_phase.py
backend/src/scripts/backfill_source_operating_records.py
backend/src/scripts/backfill_fireflies_meeting_embeddings.py
scripts/backfill-brandon-tasks.mjs
scripts/backfill-fireflies-transcript-chunks-from-storage.mjs
scripts/backfill-recent-meeting-chunks.mjs
scripts/verify/backfill_onedrive_project_assignments_from_source_path.mjs
scripts/verify/backfill_project_assignments_from_compiler_jobs.mjs
scripts/verify/backfill_source_lifecycle_from_current_state.mjs
```

**Candidate set to evaluate:** the remaining ad-hoc scripts under `scripts/` and
`backend/src/scripts/` (one-off backfills/imports/repairs). For **each**
candidate, confirm it is referenced by **none** of:
- `render.yaml` or any live Render cron `dockerCommand` (`GET /v1/services` + per-cron command),
- `package.json` / `frontend/package.json` scripts,
- `backend/src/services/scheduler.py`,
- `docs/ops/tasks/**` (active task ledgers),
- any source import (`git grep <basename>`).

If it's referenced by **nothing live** → delete it. Read
`docs/ops/handoffs/2026-06-23-S88-rag-pipeline-dashboard-and-lifecycle.md` →
section **"Code That Still Exists And Should Be Archived Or Consolidated"** for
specific per-file guidance (e.g. `backend/src/scripts/backfill_transcript_chunks.py`
is flagged as a superseded duplicate).

**Done when:** every remaining `*backfill*`/one-off script under `scripts/` and
`backend/src/scripts/` is either on the KEEP list or actively referenced; the
rest are deleted in one commit (recoverable via git history). Run
`cd frontend && npm run quality` before committing.

---

## Global rules for both tasks
- Work on `main`, commit directly, no `Co-Authored-By` lines (breaks Vercel deploys).
- Run `cd frontend && npm run quality` before any commit.
- Don't touch production Render config/env in these tasks — they are repo-hygiene only.

---

## Background: why this cleanup exists
On 2026-06-23 the RAG embedding pipeline was found 100% silently failing (capped
AI gateway + drifting per-service OpenAI keys + a poison-pill loop, no alerting).
While fixing it, two sources of rot surfaced and wasted significant agent time:
two disagreeing `render.yaml` files, and a pile of one-off backfill scripts —
made worse by `archive/` folders kept in the working tree. The archive folders
and a `.bak` were deleted and a guard added. These two tasks finish the job:
one canonical infra config, and only maintained scripts in the tree.
