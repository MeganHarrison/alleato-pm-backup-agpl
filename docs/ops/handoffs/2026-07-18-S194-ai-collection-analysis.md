# Handoff: 2026-07-18 — Evidence-Gated AI Collection Analysis

## Intake Block

1) Session ID: S194
2) Task ID: AAI-1166
Task file: `docs/ops/tasks/2026-07-18-ai-collection-analysis.md`
Verification manifest: `docs/ops/evidence/2026-07-18-ai-collection-analysis/verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-18-ai-collection-analysis/verification-result.json`
3) Linear issue: AAI-1166
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1166/replace-keyword-routed-chat-retrieval-with-evidence-gated-collection
5) Current status: Accepted — implementation published to `origin/main` at `0f24872d4`; verification contract and independent review pass.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/retrieval/**`; `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/meetings/**`; `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/tools/read/meeting-tools.ts`; `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/tool-schemas/meeting-schemas.ts`; `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/score-response-quality.ts`; scoped handler/planner integrations; adjacent focused tests; `/Users/meganharrison/Documents/github/project-management/docs/ops/{tasks,handoffs,evidence,learning,orchestration}` S194 artifacts.

Detailed ownership:

   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/retrieval/collection-planner.ts`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/retrieval/meeting-collection.ts`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/retrieval/collection-synthesis.ts`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/retrieval/types.ts`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/retrieval/executor.ts`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/retrieval/deps.ts`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/retrieval/planner.ts` (shared-file scoped export only)
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/app/api/ai-assistant/chat/handler-v2.ts` (shared-file scoped collection integration only)
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/meetings/transcript-content.ts`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(tables)/meetings/[meetingId]/page.tsx`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/tools/read/meeting-tools.ts`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/tool-schemas/meeting-schemas.ts`
   - `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/score-response-quality.ts`
   - Focused tests under the adjacent `__tests__` directories.
   - Task, evidence, recurring-failure, and S194 control-plane artifacts under `/Users/meganharrison/Documents/github/project-management/docs/ops/`.
7) Commands run and outcome (pass/fail counts): PASS focused Jest 7 suites / 61 tests; PASS targeted ESLint; PASS `pnpm run typecheck:changed`; PASS live Supabase type equality; PASS registry audit 15 fingerprints on the integrated main base; PASS authenticated browser replay and persisted readback; FAIL full `pnpm run typecheck` on 177 unrelated shared errors.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-18-ai-collection-analysis/final-collection-coverage.png`; `docs/ops/evidence/2026-07-18-ai-collection-analysis/final-clean-collection-analysis.png`; `docs/ops/evidence/2026-07-18-ai-collection-analysis/final-clean-browser-trace.zip`; `docs/ops/evidence/2026-07-18-ai-collection-analysis/verification.md`; `docs/ops/evidence/2026-07-18-ai-collection-analysis/verification-result.json`; `docs/ops/evidence/2026-07-18-ai-collection-analysis/independent-review.md`.
9) Top 3 findings (frontend-visible issues first): exhaustive requests could become source-free fallback; semantic discovery was incorrectly standing in for corpus enumeration; quality scoring could count evidence-free discovery work.
10) Recommended next action (one line): Monitor the production assistant for collection coverage failures; use the persisted failure IDs rather than adding phrase-specific routing.
11) Handoff file path: `docs/ops/handoffs/2026-07-18-S194-ai-collection-analysis.md`
12) Migration ledger evidence: N/A — no database schema change.

## Linear Updates

- Kickoff comment: `141215e9-3504-4ba1-baf6-042b22aac487`
- Authenticated verification milestone: `71f5da5b-657e-4868-bc33-85f370a8a8de`
- Screenshot attachment: `aa330229-566f-4a42-b35f-7681996b9e8f`
- Completion comment: `01e6136a-0242-4101-b02b-f210538ef335`

## Current Status

Semantic typed planning, exhaustive full-transcript retrieval, evidence-gated synthesis, quality scoring, canonical source citations, focused guardrails, authenticated exact replay, persisted coverage readback, Linear screenshot evidence, and independent review are published to `origin/main` at `0f24872d4`.

## Known Pitfalls

- The checkout contains unrelated user and parallel-session changes; publish must use exact task-owned staging.
- Full repository typecheck is red on 177 unrelated shared errors; focused task files are clean.
- The broad tool-registry test has an unrelated `getRecentEmailsInputSchema` expectation mismatch.

## Root Cause and Prevention

- Cause: phrase-oriented synchronous routing did not establish a typed source contract for unseen collection wording, so the request fell into `conversational_fallback` with zero sources.
- Detection gap: no invariant connected exhaustive analysis to complete authorized enumeration, full-transcript retrieval, matched/retrieved/failed counts, and a synthesis refusal gate.
- Prevention: semantic typed planning, authorization-aware paged enumeration, canonical transcript loading, per-record failure accounting, exhaustive synthesis gate, source-bearing quality scoring, and the active recurring-failure fingerprint `ai.collection-analysis-source-free-fallback`.

## Implemented Contract

- Semantic planning returns operation, corpus, scope, structured filters, selection criteria, exclusion criteria, and exhaustive-coverage requirements without subject-specific trigger branches.
- Collection execution enumerates the authorized meeting corpus, selects matching records, expands repeated title families, retrieves canonical full transcripts, and records every failure.
- Synthesis processes all retrieved transcript chunks only when coverage is complete, exhaustive, and failure-free.
- The direct chat result persists coverage, source IDs/titles/dates, failures, tool traces, quality metadata, and one canonical citation per processed meeting.
- Generic single-meeting details remain summary-safe. Full transcript absence is a warning there; fail-closed behavior is scoped to exhaustive collection analysis.

## Verification

- Exact prompt: `Read all of the annual reviews and tell me your insights`
- Canonical local route: `http://localhost:3000/ai?session=155e5322-65f4-4c6d-93c7-23d7ff94b306`
- Persisted assistant row: `51f70f81-d5ef-4261-865a-bde2c90da7ec`
- Coverage: 1,913 enumerated; 31 matched; 31 retrieved; 0 failed; exhaustive true; 1,256,063 transcript characters.
- Synthesis: 42 chunks across all 31 meetings.
- Source audit: 31 canonical `/meetings/<id>` records; zero risk/project/financial/budget review false positives.
- Independent review: initially rejected the generic meeting-details transcript regression; remediation added a summary-safe contract and 3 focused tests; re-review APPROVED.
- Linear screenshot attachment: `aa330229-566f-4a42-b35f-7681996b9e8f`; milestone comment: `71f5da5b-657e-4868-bc33-85f370a8a8de`.

## Known Unrelated Debt

`cd frontend && pnpm run typecheck` exits 2 with 177 TypeScript errors. No error is in the new collection planner, collection executor, collection synthesis, transcript loader, or their focused tests. Representative unrelated owners are `project-tools.ts` (50 errors), `communication-tools.ts` (36), Daily Brief fanout (10), existing `handler-v2.ts` lines (9), and existing `retrieval/deps.ts` lines (5). The broader tool-registry test also has an existing `getRecentEmailsInputSchema` default mismatch unrelated to meeting collection work.

## Publication

- Product implementation and evidence published to `origin/main` at `0f24872d4` from an isolated worktree based on the then-current remote main.
- The isolated publication preserved later Prime Contract, owner billing-period, Accounting registry, and control-plane work already on main.
- Closeout metadata published at `83fe9cdc4`; final equality readback is recorded in Linear comment `2ffceb5b-8d03-44fc-bb98-153c4957de2b`.
