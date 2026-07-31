# Task: Historical Outlook Attribution Adjudication

Status: Complete
Owner: Codex S144
Created: 2026-07-14
Task ID: AAI-1067
Linear Issue: AAI-1067 - https://linear.app/megankharrison/issue/AAI-1067/adjudicate-historical-outlook-attribution-conflicts-for-operational
Related Handoff: `docs/ops/handoffs/2026-07-14-S144-historical-outlook-attribution-adjudication.md`

## Objective

Adjudicate all 16 historical Outlook identities found by the AAI-1066 verifier,
repair only conflicts with decisive source evidence, and produce a durable
inclusion/exclusion ledger for the Operational Loss Baseline.

## Scope

- Inspect source content, project records, assignment lineage, exact-message
  copies, and downstream retrieval metadata for each conflict.
- Classify each identity as confirmed error, valid multi-project thread,
  duplicate-project alias, or unresolved/excluded.
- Apply idempotent, source-backed corrections and propagate them to retrieval
  metadata/chunks where safe.
- Exclude unresolved identities from recurrence counting.
- Excludes unrelated unassigned mail and general project deduplication unless a
  duplicate project is the direct cause of one of the 16 conflicts.

## Source of Truth

- RAG `outlook_email_intake`, `rag_document_metadata`, and `document_chunks`.
- App `projects` and downstream intelligence/task records when a confirmed
  attribution error contaminated derived output.
- `internet_message_id` for exact cross-mailbox copies and mailbox plus
  `conversation_id` for thread consistency.

## Acceptance Criteria

- [x] All 16 verifier conflicts have a source-backed disposition.
- [x] Confirmed repairs preserve before/after attribution lineage.
- [x] Unresolved or legitimate multi-project identities are explicitly excluded from recurrence counts.
- [x] Retrieval documents/chunks match every repaired source assignment.
- [x] The post-repair verifier reports only documented exceptions.
- [x] A machine-readable baseline inclusion/exclusion ledger is published.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Scoped repair is idempotent and refuses evidence drift.

Planned task-owned paths:

- `scripts/repair/adjudicate_outlook_attribution_conflicts.mjs`
- Focused verifier/repair tests if pure adjudication logic is introduced
- `docs/ops/evidence/2026-07-14-historical-outlook-attribution-adjudication/**`
- This task, S144 handoff, and S144 orchestration rows

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual live-system readback proves every applied correction.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: one identity has multiple project IDs without a reviewed disposition.
- Detection path: the historical verifier and adjudication ledger name the identity, source rows, assignments, and disposition.
- Recovery path: repair from decisive evidence or retain an explicit exclusion with reviewer rationale.

## Incident Learning

- Failure fingerprint: `ingestion.outlook-conversation-project-drift`
- Root cause: Independent message/mailbox attribution and historical manual/reconciliation paths produced inconsistent project IDs.
- Detection gap: Conflicts were not measured before longitudinal pattern synthesis.
- Prevention: Source-backed adjudication ledger plus verifier-gated baseline inclusion.
- Guardrail evidence: `docs/ops/evidence/2026-07-14-historical-outlook-attribution-adjudication/REPORT.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Intake | AAI-1066 180-day verifier | Pass | 4,920 rows, 3,175 identities, 16 conflicts. |
| Adjudication | `ledger.json` | Pass | 14 initial episodes repaired, two excluded; connected McLane identity also repaired. |
| Live repair | `node scripts/repair/adjudicate_outlook_attribution_conflicts.mjs --write` | Pass | 28 intake rows, four attachments, 24 documents, 62 chunks, 13 candidates, and 10 cards corrected/invalidated. |
| Historical guard | verifier with `--exceptions-file` | Pass | 4,942 rows, 3,184 identities, zero undocumented conflicts, two documented exceptions. |
| Idempotence | adjudicator dry-run | Pass | Zero remaining writes. |
| Static | `node --check` on repair and verifier | Pass | Both scripts parse. |
| Publication | `npm run codex:finish -- --message "Adjudicate historical Outlook attribution conflicts" --staged-only` | Pass | Published at `acafafc7fa`; HEAD matched `origin/main`. |

## Remaining Risk

- Shawnee Collective has no canonical project row and remains excluded.
- The legitimate multi-project Checks thread remains excluded until its evidence
  can be split below conversation level.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred identities have cause, detection gap, prevention step, owner, and next action.
