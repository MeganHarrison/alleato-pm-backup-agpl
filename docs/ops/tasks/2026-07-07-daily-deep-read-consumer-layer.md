# Task: Daily Deep Read Consumer Layer

Status: Complete - Daily Deep Read candidates staged and surfaced for project review
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1001 - https://linear.app/megankharrison/issue/AAI-1001/build-daily-deep-read-consumer-layer-for-review-gated-candidates
Related Handoff: Not created

## Objective

Turn the current canonical `daily_deep_read` packet into review-gated project update, task, risk, decision, and initiative candidates without independently synthesizing from chunks.

## Non-Negotiable Done Rule

This task is not done until the consumer reads the current packet, stages candidates idempotently, proves DB read-back counts by type, surfaces project-assigned candidates on the project intelligence page, and records evidence.

## Scope Checklist

- [x] Existing review queue tables reviewed.
- [x] Existing Daily Deep Read packet contract reviewed.
- [x] Source-of-truth owner chosen: current `intelligence_packets` row for `daily-executive-brief`.
- [x] Deprecated or bypassed path identified: direct synthesis from `document_chunks`.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.
- [x] Project intelligence page wired to read review-gated Daily Deep Read candidates.
- [x] Browser evidence captured for `/876/intelligence` with local or deployed app running.

## Acceptance Criteria

- Consumer reads `packet_json.sections` from the current `daily-executive-brief` packet.
- Consumer writes review-gated rows, not approved tasks.
- Candidate rows preserve packet ID, business date, section, source IDs, and source policy in metadata.
- Consumer is idempotent per packet ID/compiler version.
- No `document_chunks` query is used.
- Project intelligence page displays `needs_review` candidates from the Daily Deep Read consumer for the current project without promoting them into approved tasks/cards.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Schema fit | Existing `source_signal_candidates` migration and compiler writer reviewed | Pass | Supports review-gated risk/decision/task/project_update/process_issue candidates. |
| Syntax | `node --check scripts/intelligence/daily-deep-read-consumers.mjs && node --check scripts/verify/daily-brief-source-of-truth.mjs` | Pass | Consumer and guardrail parse cleanly. |
| Guardrail | `node scripts/verify/daily-brief-source-of-truth.mjs` | Pass | Consumer is covered by the no direct chunk-synthesis guardrail. |
| Dry run | `npm run intelligence:daily-consumers -- --dry-run` | Pass | Parsed 27 candidates from packet `f5ba7ef9-a3d2-40d0-8ed6-907c327f2f64` without writing. |
| Consumer run | `npm run intelligence:daily-consumers` | Pass | Inserted 27 `needs_review` candidates into `source_signal_candidates`. |
| Idempotency | `npm run intelligence:daily-consumers` rerun | Pass | Deleted 27 and reinserted 27 for the same packet/compiler version. |
| DB read-back | `consumer-run-summary.json` | Pass | Counts: 8 decisions, 1 process/initiative, 6 project updates, 5 risks, 7 tasks; all `needs_review`. |
| Page lint | `pnpm --dir frontend exec eslint 'src/app/(main)/[projectId]/intelligence/page.tsx'` | Pass with existing warning | New section has no lint error; one pre-existing `ErrorState` warning remains elsewhere on the page. |
| Changed type guard | `pnpm --dir frontend run typecheck:changed` | Pass | No new `any` type debt. |
| Unsafe-pattern guard | `pnpm --dir frontend run guardrails:unsafe-patterns` | Pass | Replaced new RAG reader double-cast with generated `source_signal_candidates` typing. |
| Browser route | Playwright authenticated check for `/876/intelligence` | Pass | HTTP 200, no login redirect; section hidden because project 876 has no assigned Daily Deep Read candidates. |
| Browser positive proof | Playwright authenticated check for `/1009/intelligence` | Pass | HTTP 200; section rendered; cleaned capture contains no `outlook_` tokens, no long encoded source IDs, and no `Candidate:` residue. Screenshot: `docs/ops/evidence/2026-07-07-daily-deep-read-consumers/browser/1009-intelligence-cleaned-v2.png`. |

## Files Changed

- `docs/ops/tasks/2026-07-07-daily-deep-read-consumer-layer.md` - task ledger.
- `scripts/intelligence/daily-deep-read-consumers.mjs` - reads current Daily Deep Read packet and stages review-gated candidates.
- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx` - reads `needs_review` Daily Deep Read candidates for the current project and renders them as review-gated candidates with source links when available.
- `package.json` - adds `intelligence:daily-consumers`.
- `scripts/verify/daily-brief-source-of-truth.mjs` - includes the consumer in the no direct chunk-synthesis guardrail.
- `docs/ops/evidence/2026-07-07-daily-deep-read-consumers/2026-07-06/` - candidate preview and run summary artifacts.

## Risks / Gaps

- Initiatives must be mapped to an existing candidate type because `source_signal_candidates.signal_type` does not include `initiative_signal`; use `process_issue` with metadata subtype until schema is intentionally extended.
- Rows remain candidates only. Promotion to cards/tasks is a later reviewed workflow.
- Candidate parsing is deterministic from Markdown sections. A future structured JSON packet schema would improve field quality and reduce parsing assumptions.
- Project assignment is improved but not perfect: `UQ Philipsburg` has no matching project row, and `Exol PA Phase 2` remains ambiguous against existing Exol projects.
- Browser proof confirms project 876 loads but has no Daily Deep Read candidates assigned. That is data truth, not a page failure.

## Final Status

- [x] Candidate staging evidence is recorded.
- [x] Browser evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
