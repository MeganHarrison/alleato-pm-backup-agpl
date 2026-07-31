# Handoff: 2026-07-20 — FMDS Structured RAG Embeddings

## Intake Block

1) Session ID: S209
2) Task ID: AAI-1231
3) Linear issue: AAI-1231
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1231/embed-approved-fmds-table-and-figure-structures-for-rag
5) Current status: Accepted — implementation, live ASRS readback, frontend proof, independent review, canonical publish, and local/remote readback pass.
6) Files changed (absolute paths): `/private/tmp/fmds0834-main.nWXPil/infrastructure/asrs-supabase/supabase/migrations/20260720233500_add_fmds_structured_rag_embeddings.sql`, `/private/tmp/fmds0834-main.nWXPil/infrastructure/asrs-supabase/supabase/migrations/20260720235000_fix_fmds_structured_retrieval_ambiguity.sql`, `/private/tmp/fmds0834-main.nWXPil/scripts/asrs/fmds_embedding_utils.py`, `/private/tmp/fmds0834-main.nWXPil/scripts/asrs/ingest_fmds0834.py`, `/private/tmp/fmds0834-main.nWXPil/scripts/asrs/embed_reviewed_fmds_structures.py`, `/private/tmp/fmds0834-main.nWXPil/scripts/asrs/verify_fmds0834.py`, `/private/tmp/fmds0834-main.nWXPil/scripts/asrs/tests/test_embed_reviewed_fmds_structures.py`, `/private/tmp/fmds0834-main.nWXPil/frontend/src/lib/fmds/fmds-chat.ts`, `/private/tmp/fmds0834-main.nWXPil/frontend/src/lib/fmds/fmds-chat.server.ts`, `/private/tmp/fmds0834-main.nWXPil/frontend/src/lib/fmds/__tests__/fmds-chat.server.test.ts`, `/private/tmp/fmds0834-main.nWXPil/frontend/src/lib/ai/retrieval/types.ts`, `/private/tmp/fmds0834-main.nWXPil/frontend/src/lib/ai/retrieval/planner.ts`, `/private/tmp/fmds0834-main.nWXPil/frontend/src/lib/ai/retrieval/collection-planner.ts`, `/private/tmp/fmds0834-main.nWXPil/frontend/src/lib/ai/retrieval/deps.ts`, `/private/tmp/fmds0834-main.nWXPil/frontend/src/app/api/ai-assistant/chat/handler-v2.ts`, focused tests, architecture/task/handoff/orchestration docs, and evidence artifacts.
7) Commands run and outcome (pass/fail counts): Python serializer tests 5/5 pass; focused frontend Jest 135/135 pass; targeted ESLint pass; `typecheck:changed` pass; Python module compilation pass; route-conflict check pass; verification contract pass; `rag:verify:source-specific` pass; migration push and two-version remote ledger readback pass; live backfill/retrieval/browser checks pass; broader `rag:verify:chat-architecture` reports existing unrelated architecture debt.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-20-fmds-structured-rag-embeddings/backfill.json`, `idempotence.json`, `verification.json`, `frontend-proof.md`, `structured-rag-chat-desktop.png`, `structured-rag-chat-mobile.png`, `independent-review.md`, `verification-manifest.json`, and `verification-result.json`.
9) Top 3 findings (frontend-visible issues first): `/ai` initially misrouted the FMDS request into 1,921 meeting records because the meeting-only semantic classifier could override the unused FMDS detector; native 225/225 coverage did not represent reviewed table/figure structures; page-proximity association could not prove the exact approved source.
10) Recommended next action (one line): Continue the FMDS visual-review queue; rerun the idempotent approved-structure backfill after new approvals, without activating the revision early.
11) Handoff file path: `docs/ops/handoffs/2026-07-20-S209-fmds-structured-rag-embeddings.md`
12) Migration ledger evidence: ASRS project migration list shows Local/Remote `20260720233500` and Local/Remote `20260720235000`; guarded insert rejected an unreviewed source; coverage view reads 2/2 reviewed tables and 7/7 reviewed figures embedded.

## Linear Updates

- Kickoff comment: `6ec1b9aa-7b80-4234-8d95-4fb5702ac2b3`
- Milestone/screenshot comment: `2902f781-6601-4a14-ae72-23434e0a12eb`
- Desktop attachment: `fa176c28-cc61-4342-b04c-017b8185466a`
- Mobile attachment: `7e0c942b-0c32-4402-805f-c17e27b103c0`
- Completion comment: `00e8a2e3-d2f8-4f6d-8bb0-21a009ebdb5b`

## Current Status

Every currently approved FMDS0834 table/figure source is represented by one
3072-dimension structured vector with immutable revision, source, candidate,
and approval-event provenance. The 225 native vectors remain unchanged.
Combined staging retrieval returns exact structured identity, while active
retrieval correctly excludes this staging revision.

The live Alleato AI flow now routes FMDS engineering questions to
`fmdsEvidence` only, bypasses the meeting-only collection planner, and limits
the tool set to the dedicated FMDS search/evaluator. The persisted frontend
proof retrieved one exact structured table match and returned the reviewed
Table 2.1.4.5.4 row with page citation.

Exact table citations open the table review record. Exact figure citations use
the structured source ID to open a stable evidence endpoint, which verifies the
figure belongs to FMDS0834 and generates a short-lived URL for its private
evidence image. The live Figure 2.2.1.4.1.1 check returned the page-017 image;
the independent re-review found no remaining P0-P2 issues.

## Failure, Detection Gap, and Prevention

- Cause: coverage counted only native `fmds_chunks`; the typed FMDS detector and tool restriction existed but were not wired into the canonical planner/handler; the semantic collection classifier could override the request.
- Detection gap: no reviewed-source embedding coverage, no exact structured identity in chat traces, and no live prompt regression proving the request stayed out of meeting retrieval.
- Prevention: guarded approved-only database writes, coverage drift view, idempotent serializer, exact-source match RPC fields, typed domain-first planning, meeting-classifier bypass, restricted tools, persisted exact-match traces, focused tests, and screenshot proof.

## Provider Evidence

Vercel AI Gateway returned HTTP 402 requiring a positive Gateway credit balance
during embedding. The explicit direct OpenAI path completed the 9 reviewed
embeddings and the live chat proof. Failed rows retained their errors until the
successful rerun cleared them; no provider failure was silently swallowed.

## Known Remaining Scope

- 56 tables and 54 figures remain `needs_review` and are intentionally not structured embeddings.
- The revision remains staging and active retrieval returns zero until the review gate is complete.
- The broad chat-architecture verifier still reports pre-existing registry-derived tool approval/shared-secret/client-resume and legacy `needsApproval` debt outside the FMDS-owned path.

## Publication Readback

- Implementation commit: `cdc26e2dd9`
- Published branch: `origin/main`
- Local/remote equality: verified by `codex:finish`
- Linear status: Done
- Next step: continue human review of the remaining 56 tables and 54 figures,
  then rerun the idempotent structured backfill. Keep revision 2026-04 staging
  until the activation gate reports no pending review blockers.
