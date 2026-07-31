# Task: Daily Brief Operational Loss Tracker

Status: In Progress
Owner: Codex S148
Created: 2026-07-14
Task ID: AAI-1071
Linear Issue: AAI-1071 — https://linear.app/megankharrison/issue/AAI-1071/operational-loss-tracker-fed-by-daily-brief-prevention-analysis
Related Handoff: `docs/ops/handoffs/2026-07-14-S148-daily-brief-operational-loss-tracker.md`

## Objective

Turn the Daily Brief's prevention analysis into a canonical, evidence-backed
operational-loss tracker that records daily occurrences, categories, controls,
and recurrence without representing model inference as established fact.

## Scope

- Reuse `recurring_issues`, `recurring_issue_evidence`, and
  `recurring_issue_projects` as the master pattern and source-evidence owner.
- Add immutable packet-to-occurrence lineage so one daily packet can be
  rerun/replaced without inflating recurrence counts.
- Extract structured prevention findings from the Daily Brief generation path,
  write them through one idempotent server-side consumer, and show them in a
  leadership table.
- Exclude financial-loss scoring, person-level scoring, automated interventions,
  and silently promoted unverified causality.

## Source of Truth

- Canonical daily input: `intelligence_packets` target `daily-executive-brief`.
- Master pattern owner: `recurring_issues` and its existing evidence/project
  junction tables.
- Operational-loss calibration guardrail:
  `docs/ai-plan/operational-loss/episode-contract.schema.json`.
- Deprecated/parallel paths: a new standalone issue tracker table that copies
  pattern or evidence data is forbidden.

## Acceptance Criteria

- [ ] A daily prevention finding has category, evidence, preventability,
  missing control, durable system, accountable role, leading indicator, and
  explicit confidence/review state.
- [ ] Each canonical packet writes at most one occurrence per stable finding;
  replacing a packet does not inflate counts.
- [ ] The issue master reflects source-backed recurrence and links to projects
  and packet/source evidence.
- [ ] A leadership table exposes category, current status, occurrence count,
  first/last observed date, control, and review state with drill-ins.
- [ ] Missing citations, unknown project identity, and ambiguous pattern matching
  remain visibly review-gated rather than silently merged or counted.

## Workflow Map

User action: Daily Deep Read completes; leadership opens the operational-loss table.
Frontend owner: new shared table configuration and `/operational-losses` table route.
Shared primitive owner: `UnifiedTablePage` / table-page configuration.
Client state changed: none during read-only first release.
API/service: Daily Brief packet writer calls one idempotent operational-loss consumer;
table route reads a server-side query service.
Validation: structured prevention-finding schema and consumer contract tests.
Tables: `intelligence_packets`, `recurring_issues`, `recurring_issue_evidence`,
`recurring_issue_projects`, and a new packet-occurrence lineage table.
Live DB assumptions: existing recurring issue IDs are UUID; project IDs are bigint;
packet IDs are UUID; the new table must have a unique packet/finding identity.
Side effects: only the consumer write after a successful canonical packet write;
reruns must upsert/replace scoped records atomically.
Expected success evidence: one July 13 packet produces reviewable rows and visible
recurrence counts on the leadership table.
Expected failure behavior: no unsupported or uncited finding is counted; the
consumer returns a structured failure tied to packet/finding ID.

## Implementation Checklist

- [x] Existing operational-loss and recurring-issue contracts are mapped.
- [ ] Database migration and generated types are verified against the live DB.
- [ ] Shared structured-finding extractor and idempotent consumer are implemented.
- [ ] Daily Brief fan-out invokes the consumer and preserves error visibility.
- [ ] Leadership table uses the shared table system and exposes source/drill-in links.
- [ ] Targeted tests, live write/readback, and browser evidence pass.

## Failure-Loudly Contract

- Cause surfaced as: uncited findings, unresolved project identity, or an
  ambiguous pattern match is marked `needs_review` and excluded from confirmed
  recurrence totals; a failed write reports packet and finding identity.
- Detection path: packet-specific fan-out readback, database uniqueness/query
  checks, consumer tests, and the leadership table's explicit review state.
- Recovery path: inspect linked packet/source evidence, correct classification or
  attribution, then rerun the canonical packet consumer.

## Incident Learning

- Failure fingerprint: `architecture.operational-loss-subjective-recurrence`
- Root cause: daily narrative insights were not retained as packet-linked,
  evidence-calibrated occurrences, leaving recurrence vulnerable to memory and
  subjective re-attribution.
- Detection gap: no system-owned occurrence ledger or review state existed after
  a Daily Brief was published.
- Prevention: canonical packet lineage, idempotent write semantics, source
  evidence links, and visible review-gated totals.
- Guardrail evidence: `docs/ai-plan/operational-loss/episode-contract.schema.json`; `node scripts/ops/learning-registry.mjs audit --task docs/ops/tasks/2026-07-14-daily-brief-operational-loss-tracker.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Contract discovery | Existing operational-loss task and recurring-issues migration | Pass | Reusing the existing master/evidence model; only packet occurrence lineage is new. |
| Live type generation | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Pass | Existing recurring issue tables are present in the linked schema. |

## Remaining Risk

- Existing July 13 prevention prose is analytical Markdown, not yet a structured
  extraction payload; implementation must make that boundary explicit before it
  can reliably power recurrence counts.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
