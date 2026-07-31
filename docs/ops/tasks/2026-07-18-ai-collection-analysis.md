# Task: Evidence-Gated AI Collection Analysis

Status: Complete
Owner: Codex S194
Created: 2026-07-18
Task ID: AAI-1166
Linear Issue: AAI-1166 — https://linear.app/megankharrison/issue/AAI-1166/replace-keyword-routed-chat-retrieval-with-evidence-gated-collection
Related Handoff: `docs/ops/handoffs/2026-07-18-S194-ai-collection-analysis.md`

## Objective

Make collection-analysis requests work from their meaning rather than phrase-specific routing: the assistant must plan a typed collection query, enumerate the complete authorized meeting-transcript corpus, retrieve every matched record, report auditable coverage, and refuse unsupported synthesis.

## Scope

- Generic collection-analysis planning and execution for meeting transcripts, including structured title/date/project filters and explicit exhaustive coverage.
- Generic canonical application URL parsing for exact meeting references.
- Evidence-gated synthesis metadata, fail-loud outcomes, trace summaries, quality scoring, and regression coverage.
- Preserve and accommodate existing uncommitted follow-up/deep-agent routing changes in shared planner and handler owners.
- Excludes database schema changes, write tools, other corpus executors, and UI redesign.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` and `public.document_metadata` meeting rows.
- Existing shared primitives/services: `frontend/src/lib/ai/retrieval/**`, `frontend/src/lib/ai/tools/read/meeting-tools.ts`, `frontend/src/lib/ai/score-response-quality.ts`.
- Deprecated or parallel paths: phrase-specific source detectors are not permitted to own exhaustive collection retrieval.

Verification contract: Required

## Acceptance Criteria

- [x] Varied unseen phrasings produce the same typed collection plan without adding subject-specific phrase branches.
- [x] Collection planning captures operation, corpus, filters, requested scope, and exhaustive-coverage requirement.
- [x] Matching meetings are enumerated with structured database filters and pagination-safe limits rather than semantic recall.
- [x] Every matched meeting is retrieved or recorded as a specific failure before synthesis.
- [x] Canonical `/meetings/<meetingId>` URLs resolve directly to exact meeting entities.
- [x] Exhaustive requests report matched, retrieved, and failed counts plus source references.
- [x] Incomplete or zero-evidence retrieval fails loudly and cannot be presented as a grounded synthesis.
- [x] Persisted traces contain auditable meeting IDs, titles, dates, source references, coverage, and failures.
- [x] MCP discovery and empty tool outputs do not inflate response-quality scoring.
- [x] The exact July 18 conversation is replayed end to end with viewable canonical-route evidence.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared typed collection abstraction owns cross-cutting planning and evidence contracts.
- [x] Meeting collection executor reuses canonical document metadata and meeting-detail ownership.
- [x] Handler integration preserves existing uncommitted shared-owner changes.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.
- [x] Recurring-failure guardrail is linked or added without overwriting existing registry edits.

## Integration and Verification

- [x] Focused collection planner/executor/scoring tests pass.
- [x] Targeted lint and changed-file type checks pass.
- [x] Actual authenticated AI-chat replay proves the requested outcome and fail-loud behavior.
- [x] Persisted chat-history/trace readback proves collection coverage evidence.
- [x] Canonical chat screenshot is attached to Linear or linked in its comments.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and the isolated publication worktree `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `collection_retrieval_incomplete` with matched, retrieved, failed, and authorized-scope counts plus per-record failures.
- Detection path: focused tests, persisted `chat_history.metadata`, trace panel, and authenticated chat replay.
- Recovery path: retry only failed record IDs or correct the structured corpus/filter/scope; never ask the user to invent narrower wording.

## Incident Learning

- Failure fingerprint: `ai.collection-analysis-source-free-fallback`
- Root cause: Exhaustive corpus requests can fall through a phrase-oriented router into a source-free conversational plan; tool success and quality scoring do not require auditable evidence.
- Detection gap: No invariant tied “all/every” analysis to complete enumeration/retrieval coverage, and empty discovery/tool metadata counted as success.
- Prevention: Typed collection plan, deterministic enumerator, evidence gate, and regression replay with unseen phrasing.
- Guardrail evidence: 7 focused suites / 61 tests, authenticated exact replay, persisted coverage readback, independent review approval, and registry audit pass.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Production `chat_history` session `f92dada1-aed7-4ba4-8c63-414eeb07d584` | Failed at request → retrieval-plan boundary | Request expected exhaustive meeting corpus; observed `conversational_fallback`, zero sources, and later unauditable success metadata. |
| Linear setup | AAI-1166 | Pass | Issue created in Alleato AI and set In Progress before product edits. |
| Focused regression suite | `pnpm exec jest --runInBand --runTestsByPath ...` | Pass | 7 suites, 61 tests; includes semantic wording, exhaustive retrieval, fail-closed synthesis, transcript ownership, response scoring, and single-meeting non-regression. |
| Targeted lint | `pnpm exec eslint <task-owned TypeScript files>` | Pass | No scoped ESLint findings. |
| Live database types | Supabase type generation plus `cmp` | Pass | Checked-in database types match the live project; no schema change required. |
| Direct collection execution | Exact original request | Pass | 1,913 enumerated; 31 matched/retrieved; 0 failed; 1,256,063 transcript characters; no unrelated review source. |
| Authenticated `/ai` replay | Session `155e5322-65f4-4c6d-93c7-23d7ff94b306` | Pass | Exact prompt produced exhaustive grounded analysis with 31 canonical meeting citations. |
| Persisted readback | Assistant row `51f70f81-d5ef-4261-865a-bde2c90da7ec` | Pass | Coverage, 42 synthesis chunks, 31 source records, zero failures, and fail-closed policy persisted. |
| Browser artifacts | `docs/ops/evidence/2026-07-18-ai-collection-analysis/` | Pass | Final screenshot and trace plus three rejected intermediate runs document the guardrails catching incomplete or off-topic evidence. |
| Linear screenshot | Attachment `aa330229-566f-4a42-b35f-7681996b9e8f` | Pass | Viewable exact-route screenshot attached to AAI-1166 and linked from milestone comment `71f5da5b-657e-4868-bc33-85f370a8a8de`. |
| Independent review | `independent-review.md` | Pass after rework | Reviewer rejected a generic meeting-details regression; remediation restored summary-safe behavior and the re-review approved. |
| Verification contract | `verification-result.json` | Pass | Required evidence and independent approval are present. |
| Full frontend typecheck | `cd frontend && pnpm run typecheck` | Unrelated repo debt | 177 existing shared errors; no errors in the new collection planner/executor/synthesis/transcript files. Representative owners: `project-tools.ts`, `communication-tools.ts`, Daily Brief fanout, and pre-existing handler/deps lines. |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |

## Remaining Risk

- Full repository typecheck remains red on 177 existing shared errors outside the collection-analysis implementation; focused and changed-file gates pass.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
