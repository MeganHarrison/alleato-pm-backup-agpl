# Task: Canonical Daily Brief And Deep Read Fan-Out

Status: In Progress
Owner: Codex S145
Created: 2026-07-14
Task ID: AAI-1068
Linear Issue: AAI-1068 — https://linear.app/megankharrison/issue/AAI-1068/consolidate-daily-executive-brief-and-expose-deep-read-fan-out-proof
Related Handoff: `docs/ops/handoffs/2026-07-14-S145-canonical-daily-brief-fanout.md`

## Objective

Make `/daily-briefs/{briefId}` the canonical full written Daily Brief history,
make `/daily-brief` the current-run dashboard that consumes the newest canonical
packet, remove duplicate or archived brief renderers, and expose a truthful admin
readback of the canonical Deep Read's full downstream fan-out.

## Scope

- Remove or deliberately redirect duplicate brief routes and their archived
  snapshot/fallback implementations.
- Redirect retired executive briefing routes to `/daily-brief`; do not preserve
  a second dashboard renderer.
- Add one admin page that loads a packet-specific fan-out readback for the brief,
  project assignment, tasks, homepage/project intelligence, insight cards, and
  progress reports.
- The admin page is a single Daily Brief run ledger with source-content tabs for
  Meetings, Teams, Messages, Emails, and Documents; the written report;
  generated tasks; a project-intelligence table; and all remaining packet/output
  records with explicit empty or missing states.
- Prove the July 13 packet's actual fan-out against live records.
- Exclude changing source ingestion or the scheduled compiler unless the audit
  proves the existing canonical contract is wrong.

## Detailed Executive Report Contract

The persisted Daily Brief Markdown artifact is an executive analysis, not a
source-by-source recap and not the dashboard's expanded copy. The Deep Read
must synthesize its complete source set into a report that explains what the
evidence means for the company and each affected project.

- Explain material patterns, causal connections, cross-source corroboration,
  contradictions, risk trajectory, and opportunities.
- Analyze preventable or partially preventable failures separately: state the
  observed condition, the missing control or detection gap, a durable
  preventive system, accountable role, and a leading indicator. Preserve
  uncertainty when the evidence cannot establish preventability.
- Translate evidence into decisions, consequences, ownership, timing, and
  recommended actions; retain citations so each conclusion can be inspected.
- Include enough meeting, email, message, and document context for an executive
  to understand what happened without reading every source first.
- Produce dashboard cards, project intelligence, tasks, risks, issues,
  decisions, and progress reports as derived downstream outputs. They must not
  constrain, replace, or duplicate the detailed report.
- Surface gaps or uncertainty explicitly instead of fabricating a conclusion.
- Quality gate: reject a report that omits any required analytical section,
  lacks source citations, or is materially too short for the included source set.
- Regeneration contract: history exposes only the newest canonical packet per
  business date; superseded packets remain available only as audit history.

## Source of Truth

- Canonical brief/data owner: `intelligence_packets` target
  `daily-executive-brief`, rendered by `/daily-briefs/{briefId}`.
- Existing readback primitives: `canonical-packets.ts`,
  `daily-deep-read-consumers.mjs`, project intelligence/progress report writers,
  and `source_signal_candidates`.
- Deprecated/parallel paths: `/daily-brief`, `/executive/morning-brief-v2`,
  `/executive/morning-brief`, and any static July snapshot fallback.

## Acceptance Criteria

- [ ] Daily Brief history links to a normal application report page that renders
  the persisted `briefMarkdown` artifact in full; `/daily-brief` renders the
  newest canonical packet as the current dashboard.
- [ ] Archived duplicate snapshot code and route entry points are removed or
  redirected to canonical history/detail without preserving a second renderer.
- [ ] `/executive` is not called or linked as the Daily Brief.
- [ ] The admin fan-out page identifies one packet and shows each requested
  downstream output with record counts, links, and an explicit missing/partial state.
- [ ] Source tabs expose the actual source content used by the selected daily
  packet, grouped into Meetings, Teams, Messages, Emails, and Documents.
- [ ] Project rows link to the canonical `/{projectId}/intelligence` surface in
  a new tab.
- [ ] July 13 Deep Read results are verified from live records for every stage.
- [ ] Failure-loudly behavior and a regression guardrail prevent future owner drift.

## Implementation Checklist

- [x] Files/modules and route ownership are identified before edits.
- [ ] Shared fan-out readback service/API owns cross-surface status.
- [ ] Admin UI passes the noise gate and has source/record drill-ins.
- [ ] Retired routes and stale labels are removed or redirected.
- [ ] Targeted tests and live browser/API proof pass.

## Integration and Verification

- [ ] Canonical packet, source lane, and downstream-row DB/API readbacks pass.
- [ ] Admin page renders the July 13 packet and fan-out statuses live.
- [ ] User-facing route behavior is browser-verified.
- [ ] Evidence and Linear/handoff closeout are complete.
- [ ] Task-owned files are published and `HEAD == origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a stage shows `missing`, `partial`, or `failed` with the
  exact query/record condition; no stage can show green without readback rows.
- Detection path: admin fan-out page, its packet-specific API, and focused
  contract tests.
- Recovery path: open the canonical record/source or run the named repair path;
  never regenerate from an archived route.

## Admin Page Attention Brief

Primary user: Megan, auditing one completed Daily Brief run.
Primary job: Verify what the Deep Read read, wrote, assigned, and failed to create.
Primary decision: Whether the brief and every downstream output are trustworthy
enough to act on or require repair.
Tier 1: Source records, written brief, tasks, project intelligence, and missing
output stages for the selected packet.
Tier 2: Candidate/insight-card/progress-report drill-ins and project links.
Tier 3: Packet metadata and internal compiler identifiers.
Hide until requested: Raw JSON, source IDs, and low-level transport metadata.
Remove: KPI tiles, duplicate summaries, and separate executive/dashboard links.
Primary action: Open the exact source, task, report, or project intelligence
record; repair missing outputs from the named stage.
Failure-loudly behavior: Empty or unverifiable output is shown as `Missing` or
`Partial` with the exact absent lineage condition and recovery path.

## Incident Learning

- Failure fingerprint: `architecture.canonical-collaboration-owner-drift`
- Root cause: multiple active brief routes and an old static snapshot/fallback
  survived after canonical packet routing was introduced.
- Detection gap: no route-owner contract asserted that the report has one entry
  point or that all Deep Read fan-out writes have visible readback.
- Prevention: one canonical detail route, retired route redirects/removal, and
  a packet-specific fan-out contract page/test.
- Guardrail evidence: `scripts/intelligence/daily-executive-brief.mjs` now
  rejects a detailed report missing required analytical sections, citations, or
  sufficient source-scaled length; history selects only the newest packet per
  business date; `node --test scripts/intelligence/__tests__/daily-brief-v3.test.mjs`
  passed (16 tests) after the report-first pipeline change.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live canonical page | `/daily-briefs/163e5716-9eae-45c3-b30a-ff23f01d5f1f` | Pass | Browser and API both returned the July 13 canonical packet. |
| Route divergence | `/daily-brief` and `/executive/morning-brief-v2` source inspection | Fail | Legacy snapshot/fallback surfaces remain. |
| July 13 detailed regeneration | `docs/ops/evidence/2026-07-14-detailed-executive-report-regeneration/2026-07-13/brief.md` | Pass | New packet `719b309e-2ec1-49f8-b4b7-49f2e747e565`; 31,399 characters, 10 required analytical sections, 261 citations. |
| July 13 fan-out | `consumer-run.json` in the same evidence directory | Partial | 10 review candidates, 8 regenerated tasks (19 prior removed), 12 project-intelligence updates, 12 progress reports refreshed; 1 project unmatched, insight cards remain review-gated. |
| Prevention-system regeneration | `docs/ops/evidence/2026-07-14-prevention-system-regeneration/2026-07-13/brief.md` | Pass | New current packet `cd8fbd79-6d57-4e00-a932-73ec1d810c2d`; 37,507 characters, 11 analytical sections including prevention systems, and 455 citations. |
| Prevention-system fan-out | `consumer-run.json` in the same evidence directory | Partial | 11 review candidates, 9 regenerated tasks (8 prior removed), 14 project-intelligence updates, 12 progress reports refreshed/created; 1 project remains unmatched and candidates remain review-gated. |

## Remaining Risk

- Audit in progress: do not claim all requested fan-out stages completed until
  their exact live row/readback evidence is collected.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
