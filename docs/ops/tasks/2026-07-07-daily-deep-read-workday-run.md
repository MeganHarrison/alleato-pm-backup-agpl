# Task: July 7 Workday Daily Deep Read Run

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: N/A
Related Handoff: N/A

## Objective

Run the Daily Deep Read for the July 7, 2026 workday window, defined as 6:00 AM to 6:00 PM America/New_York, then run the downstream consumer step so the packet can feed executive brief, review-gated task/risk/decision/initiative candidates, and project intelligence updates.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Source-of-truth run window defined as 2026-07-07T10:00:00.000Z to 2026-07-07T22:00:00.000Z.
- [x] Existing runner reviewed before changing code.
- [x] Full-source Deep Read path verified to use transcript storage markdown for meetings.
- [x] Deprecated packet compiler path excluded from this run.
- [x] Failure-loudly behavior defined: invalid window timestamps throw before model/database writes.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Runner supports explicit covered-start and covered-end timestamps.
- [x] Source inclusion uses timestamp window, not only calendar date.
- [x] Database writes complete for the current Daily Deep Read packet.
- [x] Downstream consumer run complete for the generated packet.

## Verification Checklist

- [x] No-write preflight run captured.
- [x] Live packet write run captured.
- [x] Consumer run captured.
- [x] Database read-back confirms current packet window and source coverage.
- [x] Browser read-back confirms executive brief and project 876 candidate surface render.
- [x] Evidence artifacts recorded below.

## Files Expected To Change

- `scripts/intelligence/daily-executive-brief.mjs`
- `docs/ops/tasks/2026-07-07-daily-deep-read-workday-run.md`
- `docs/ops/evidence/2026-07-07-daily-deep-read-workday/**`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Task setup | `docs/ops/tasks/2026-07-07-daily-deep-read-workday-run.md` | Pass | Working definition of done created before live run. |
| Runner hardening | `scripts/intelligence/daily-executive-brief.mjs` | Pass | Added explicit `--covered-start-at` / `--covered-end-at`, timestamp inclusion, and 180s model timeout. |
| No-write preflight | `node scripts/intelligence/daily-executive-brief.mjs --date 2026-07-07 --packetType current --covered-start-at 2026-07-07T10:00:00.000Z --covered-end-at 2026-07-07T22:00:00.000Z --evidence-dir docs/ops/evidence/2026-07-07-daily-deep-read-workday --no-write` | Pass | 600 rows considered; included 11 meetings, 95 emails, 0 Teams messages, 16 documents; 478 skipped. |
| Live packet write | `node scripts/intelligence/daily-executive-brief.mjs --date 2026-07-07 --packetType current --covered-start-at 2026-07-07T10:00:00.000Z --covered-end-at 2026-07-07T22:00:00.000Z --evidence-dir docs/ops/evidence/2026-07-07-daily-deep-read-workday` | Pass | Wrote current packet `e081fd85-7314-4636-9fea-dc193bd7051c`, generated `2026-07-07T22:04:26.777Z`. |
| Packet evidence | `docs/ops/evidence/2026-07-07-daily-deep-read-workday/2026-07-07/brief.md` | Pass | Executive Daily Brief generated from the workday source corpus. |
| Source corpus | `docs/ops/evidence/2026-07-07-daily-deep-read-workday/2026-07-07/source-corpus.md` | Pass | Full included source text persisted for audit. |
| Source manifest | `docs/ops/evidence/2026-07-07-daily-deep-read-workday/2026-07-07/source-manifest.json` | Pass | Records explicit window, rows considered, included sources, skipped sources, and per-source metadata. |
| Consumer run | `node scripts/intelligence/daily-deep-read-consumers.mjs --packetId e081fd85-7314-4636-9fea-dc193bd7051c` | Pass | Inserted 26 review-gated candidates. |
| Consumer evidence | `docs/ops/evidence/2026-07-07-daily-deep-read-consumers/2026-07-07/consumer-run-summary.json` | Pass | Read-back: 4 decisions, 1 process issue, 15 project updates, 3 risks, 3 tasks, all `needs_review`. |
| Packet DB read-back | `select current daily-executive-brief packet from intelligence_packets` | Pass | Current packet covers `2026-07-07T10:00:00.000Z` to `2026-07-07T22:00:00.000Z`; source counts match 11 meetings, 95 emails, 0 Teams, 16 documents. |
| Candidate DB read-back | `select signal_type, status, count(*) from source_signal_candidates where extraction_json->>'daily_packet_id' = 'e081fd85-7314-4636-9fea-dc193bd7051c'` | Pass | Counts match consumer output. |
| Project 876 assignment | `select project_id, signal_type, count(*) from source_signal_candidates where daily_packet_id = packet` | Pass | Project `876` has 1 decision, 1 process issue, 1 project update, and 1 task candidate. |
| Browser: executive brief | `agent-browser open http://localhost:3001/executive/intelligence-brief` | Pass | Page rendered `2026-07-07 · 122 sources · intelligence_packets`; saved screenshot at `docs/ops/evidence/2026-07-07-daily-deep-read-workday/executive-brief-page.png`. |
| Browser: project 876 intelligence | `agent-browser open http://localhost:3001/876/intelligence` | Pass | Page rendered four review candidate Accept/Reject pairs for project 876; saved screenshot at `docs/ops/evidence/2026-07-07-daily-deep-read-workday/project-876-intelligence.png`. |
| Syntax check | `node --check scripts/intelligence/daily-executive-brief.mjs` | Pass | Script syntax valid after runner changes. |

## Risks / Gaps

- Downstream task/risk/decision/initiative updates are review-gated; this run created candidates, not silently auto-promoted unreviewed work.
- Project intelligence refresh depends on the canonical backend refresh path after candidate promotion, not the retired packet refresh job path.
- Teams source count was 0 for the explicit July 7 6am-6pm ET window. That means no Teams rows matched the current ingestion metadata/window, not that the brief runner ignored Teams.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
