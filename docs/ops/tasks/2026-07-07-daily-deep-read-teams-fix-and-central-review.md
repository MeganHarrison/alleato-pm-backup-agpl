# Task: Daily Deep Read Teams Fix, Orchestrator, and Central Review Queue

Status: Complete
Owner: Claude
Created: 2026-07-07
Linear Issue: N/A
Related Handoff: `docs/ops/handoffs/2026-07-07-teams-daily-deep-read-window-bug.md`

## Objective

1. Fix the Teams source-window inclusion bug that produced `teams: 0` in the July 7
   workday Daily Deep Read packet.
2. Rerun the workday packet live and let packet creation automatically trigger the
   consumer step (orchestrator).
3. Build a central review queue so every current-packet candidate — including
   unassigned/company-wide ones — is reviewable in one place, with project assignment
   for unassigned candidates so the hourly promotion cron has somewhere to write.
4. Keep the human review gate; the existing hourly cron promotes accepted candidates.

## Scope Checklist

- [x] Handoff root cause verified against ingestion code before changing the runner
      (`teams.py` writes Graph `createdDateTime` — message timestamps are **UTC**, not ET).
- [x] Existing runner/consumer/promotion/cron architecture reviewed before edits.
- [x] Failure-loudly behavior defined: lane-coverage assertion throws before live writes.
- [x] Human review gate preserved — nothing auto-accepts; cron only drains `status='candidate'`.

## Implementation Checklist

- [x] `scripts/intelligence/daily-executive-brief.mjs` — lane-aware inclusion:
      Teams per-message UTC timestamps; date-only headers never exclude on sub-day windows;
      `last_synced_at` added to row fallback; `assertLaneCoverage` guardrail;
      `--sources-only` preflight mode; post-write consumer chaining with `--skip-consumers`.
- [x] `scripts/intelligence/daily-deep-read-backfill.mjs` — passes `--skip-consumers`
      (backfill owns its own consumer step and evidence).
- [x] `frontend/src/app/api/executive/daily-deep-read-candidates/[candidateId]/route.ts` —
      central accept/reject PATCH, `view_executive_briefing` capability gated, optional
      `projectId` assignment for unassigned candidates, review lineage in `extraction_json`.
- [x] `frontend/src/app/(main)/executive/daily-deep-read-review/page.tsx` — central queue
      page: all current-packet candidates grouped Unassigned-first then by project,
      source-ID noise stripped from display text.
- [x] `frontend/src/features/intelligence/daily-deep-read-central-review.tsx` — client
      review component with project picker on unassigned rows.
- [x] `frontend/src/app/(main)/executive/intelligence-brief/page.tsx` — "Review candidates"
      footer link.

## Verification Checklist

- [x] Sources-only no-write preflight captured (teams > 0).
- [x] Live packet rerun captured; consumers auto-ran via orchestrator.
- [x] DB read-back: new packet current + source counts; old packet demoted to snapshot.
- [x] End-to-end central review write test as an authenticated app user: assign project +
      accept → RAG DB row read-back (`project_id`, `status='candidate'`, review lineage,
      `central_review_manual_assignment`) → reverted so the queue stayed unreviewed.
- [x] ESLint / typecheck:changed / check:routes / map:project / source-of-truth guardrail
      delegated to sub-agent — all pass.
- [x] Browser screenshots recorded (see Evidence).

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Root cause proof | `backend/src/services/integrations/microsoft_graph/teams.py` message line | Pass | `[{createdDateTime[:19]}]` → Teams message timestamps are UTC. |
| Preflight (sources only) | `node scripts/intelligence/daily-executive-brief.mjs --date 2026-07-07 --packetType current --covered-start-at 2026-07-07T10:00:00.000Z --covered-end-at 2026-07-07T22:00:00.000Z --evidence-dir docs/ops/evidence/2026-07-07-daily-deep-read-workday-teams-fix --no-write --sources-only` | Pass | 629 rows considered; included meetings 11, emails 98, **teams 15**, documents 20. |
| Teams inclusion basis | `docs/ops/evidence/2026-07-07-daily-deep-read-workday-teams-fix/2026-07-07/source-manifest.json` | Pass | All 15 included Teams rows `basis=teams-message-timestamps-utc`; 40 out-of-window Teams rows still skipped. |
| Live packet + orchestrator | same command without `--no-write --sources-only` | Pass | Packet `95317ddb-8ae4-4cc6-a80d-5fa34d93e36f` written; consumers auto-ran, 31 `needs_review` candidates (4 decision, 26 project_update, 1 risk). |
| Packet DB read-back | `intelligence_packets` query | Pass | New packet `current` with teams=15; old `e081fd85…` now `snapshot`. |
| Central queue browser proof | `docs/ops/evidence/2026-07-07-daily-deep-read-central-review/central-review-page.png` | Pass | 31 awaiting review; Unassigned (21) group with project pickers; clean summaries (no source-ID/base64 tokens). |
| Accept flow browser proof | `docs/ops/evidence/2026-07-07-daily-deep-read-central-review/central-review-accept-assigned.png` | Pass | Accepted candidate under "Alleato Office Remodel (1)" labeled "Accepted · promotes on the next hourly run". |
| Accept DB read-back | RAG `source_signal_candidates` query | Pass | `project_id` set, `status='candidate'`, review source `central_daily_deep_read_review`, method `central_review_manual_assignment`; then reverted (31/31 back to `needs_review`). |
| Executive brief proof | `docs/ops/evidence/2026-07-07-daily-deep-read-workday-teams-fix/executive-brief-teams-coverage.png` | Pass | `2026-07-07 · 144 sources`, teams 15 in Source coverage, "Review candidates" link. |
| Static checks | sub-agent: eslint (5 files), `typecheck:changed`, `check:routes`, `node --check`, `daily-brief-source-of-truth.mjs`, `map:project` | Pass | No failures related or unrelated. |

## Risks / Gaps

- Candidate **titles** from the consumer's bullet parser are still weak (e.g. "7/28",
  "$10k–$12k") — the summary carries the content. Improving title extraction is consumer
  parsing work, out of scope here.
- Accepting an unassigned candidate **without** choosing a project leaves it accepted but
  company-wide; the hourly drain only promotes project-assigned candidates. The row stays
  visible in the queue labeled "no project to promote into".
- The July 7 packet source counts grew slightly beyond the Teams fix (emails 95→98,
  documents 16→20) because more rows had synced between runs and `last_synced_at` was
  added to the fallback chain — all inside the same explicit window.

## Final Status

- [x] All checklist items complete, evidence recorded.
- [x] Test acceptances reverted; all 31 candidates remain `needs_review` for human review.
