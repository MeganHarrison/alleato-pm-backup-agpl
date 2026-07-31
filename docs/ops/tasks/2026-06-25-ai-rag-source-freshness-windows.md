# AI/RAG Source Freshness Windows

Date: 2026-06-25
Linear: AAI-663
Parent: AAI-636
Status: Complete

## Objective

Apply the production-finalization freshness policy for communication-source backlog errors:

- Fireflies backlog errors older than two months are not active production-readiness blockers.
- Outlook email and Teams message backlog errors older than one week are not active production-readiness blockers.

Recent ingestion, embedding, project assignment, task extraction, and retrieval must still fail loudly.

## Scope

- `docs/architecture/AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `scripts/verify/verify_meeting_vectorization_health.mjs`

## Done Checklist

- [x] Create Linear issue before coding.
- [x] Create task markdown before coding.
- [x] Document freshness windows in the authoritative architecture.
- [x] Update central finalization checklist/blockers.
- [x] Update meeting verifier to use the two-month Fireflies backlog concern window.
- [x] Run `npm run rag:verify:meetings`.
- [x] Fill evidence section.
- [x] Publish to `origin/main`.

## Evidence

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/meetings-after-freshness-window-aai-663.txt`

Result:

- Recent meeting vectorization still passes with 75/75 recent meetings embedded.
- Fireflies backlog warning now scopes to jobs created in the last 60 days: 1,600 error-stage jobs.
- Outlook and Teams backlog concern window is documented as one week.

## Blockers

- None confirmed yet.

## Failure-Loud Guardrail

This task must not weaken recent-source gates. Fireflies recent meeting coverage remains governed by the recent meeting verifier window, and Outlook/Teams current-health work remains governed by one-week operational freshness.
