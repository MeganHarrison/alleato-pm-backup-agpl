# Task: Outlook Conversation Attribution Repair

Status: Complete
Owner: Codex S143
Created: 2026-07-14
Task ID: AAI-1066
Linear Issue: AAI-1066 - https://linear.app/megankharrison/issue/AAI-1066/repair-cross-mailbox-outlook-project-attribution-drift-in-deep-read
Related Handoff: `docs/ops/handoffs/2026-07-14-S143-outlook-conversation-attribution-repair.md`

## Objective

Correct the Superior Sprinklers conversation and every contaminated derived
record to project 178, refresh the affected Deep Read outputs, and prevent one
logical Outlook conversation from carrying conflicting project assignments
across mailbox copies.

## Scope

- Live RAG/app database repair for the seven July 13 Superior Sprinklers source
  rows and affected metadata, chunks, candidate, task, and project intelligence.
- Shared Outlook conversation-attribution boundary and deterministic regression
  guardrail.
- Focused verification and corrected operational-loss baseline continuation.
- Excludes unrelated Graph sync, general retrieval ranking, and other projects'
  attribution unless the verifier discovers the same confirmed conflict shape.

## Source of Truth

- Canonical runtime/data owner: RAG `outlook_email_intake`,
  `rag_document_metadata`, and `document_chunks`, with app `tasks` and packet
  consumers downstream.
- Existing shared primitives/services:
  `backend/src/services/integrations/microsoft_graph/project_inference.py`,
  `backend/src/services/integrations/microsoft_graph/outlook.py`, and
  `scripts/intelligence/daily-deep-read-consumers.mjs`.
- Deprecated or parallel paths: application-side Outlook intake is not the live
  owner of `source_signal_candidates`; the split RAG database owns candidates.

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.
- [x] All Superior Sprinklers source copies and derived retrieval metadata resolve to project 178.
- [x] The false Uniqlo candidate/task is removed or corrected without losing source lineage.
- [x] A cross-mailbox conversation conflict is review-gated or fails a deterministic verifier.
- [x] The affected Deep Read/project-intelligence chain is regenerated and read back.
- [x] The operational-loss baseline is updated from corrected evidence.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.
- [x] Scoped repair is idempotent and records before/after evidence without exposing secrets.

Planned task-owned implementation paths:

- `backend/src/services/integrations/microsoft_graph/outlook_attribution.py`
- `backend/src/services/integrations/microsoft_graph/outlook.py`
- `backend/src/services/integrations/microsoft_graph/outlook_conversations.py`
- `backend/tests/test_outlook_attribution.py`
- `backend/tests/test_outlook_conversations.py`
- `scripts/verify/verify_outlook_conversation_attribution_consistency.mjs`
- `scripts/repair/repair_outlook_conversation_attribution.mjs`
- Task, handoff, evidence, and corrected operational-loss baseline docs owned by AAI-1066

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: one logical conversation has more than one non-null project ID across mailbox copies.
- Detection path: scoped conversation-attribution verifier exits non-zero with conversation, project IDs, source count, and remediation.
- Recovery path: review/repair the canonical conversation assignment, propagate it to metadata/chunks, invalidate contaminated candidates/tasks, and refresh the affected packet.

## Incident Learning

- Failure fingerprint: `ingestion.outlook-conversation-project-drift`
- Root cause: Cross-mailbox copies were attributed independently; a lower-confidence company-domain match selected Uniqlo and later `existing_document` assignments propagated it.
- Detection gap: No mailbox-independent conversation consistency gate ran before Deep Read candidate/task generation.
- Prevention: Canonical conversation fingerprint plus conflict review/fail-loud verifier before project-specific promotion.
- Guardrail evidence: `docs/ops/evidence/2026-07-14-outlook-conversation-attribution-repair/REPORT.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Full task, Linear issue, and ownership captured before implementation. |
| Runtime localization | Live app/RAG DB read-back | Pass | Seven July 13 Superior Sprinklers rows split 3 to project 178 and 4 to project 31; false candidate and open task confirmed. Exact duplicate copies share `internet_message_id`; mailbox Graph conversation IDs differ. |
| Focused prevention tests | `cd backend && pytest -q tests/test_outlook_attribution.py tests/test_outlook_conversations.py` | Pass | 8 passed. |
| Scoped live repair | `repair_outlook_conversation_attribution.mjs ... --write` | Pass | Four intake rows, four documents, and 110 chunks repaired; false candidate/task deleted. |
| Attribution read-back | `verify_outlook_conversation_attribution_consistency.mjs --subject "Superior Sprinklers" --date 2026-07-13 --expected-project-id 178` | Pass | Seven rows, six identities, zero conflicts, zero unexpected projects. |
| Deep Read regeneration | Packet `163e5716-9eae-45c3-b30a-ff23f01d5f1f` | Pass | Corrected packet and all consumers completed; live task/candidate/current-state read-back passed. |
| Historical measurement | 180-day attribution verifier | Follow-up | 4,920 rows and 3,175 identities scanned; 16 other conflicts require adjudication before baseline use. |
| Broader Outlook intake tests | `cd backend && pytest -q tests/test_outlook_intake.py tests/test_outlook_attribution.py tests/test_outlook_conversations.py` | Unrelated failures | 21 passed, 7 failed because `test_outlook_intake.py` monkeypatches already-removed source-intelligence compiler symbols. |
| Publication | `npm run codex:finish -- --message "Repair Outlook conversation attribution drift" --staged-only` | Pass | Published commit `559d8cef78` to `origin/main`. |

## Remaining Risk

- Sixteen historical conversation/message identities remain conflicted. They
  are explicitly excluded from recurrence analysis until source adjudication;
  no unsafe bulk rewrite was attempted.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
