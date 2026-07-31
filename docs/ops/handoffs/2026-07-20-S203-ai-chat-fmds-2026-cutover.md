# Handoff: 2026-07-20 — AI Chat FMDS 2026 Cutover

## Intake Block

1) Session ID: S203
2) Task ID: AAI-1207
Task file: `docs/ops/tasks/2026-07-20-ai-chat-fmds-2026-cutover.md`
3) Linear issue: AAI-1207
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1207/cut-over-ai-chat-retrieval-to-the-versioned-2026-fmds-corpus
5) Current status: Complete — the revision-scoped retrieval cutover, live Gateway path, cited answers, clickable source routes, and Pending Review behavior are verified on the canonical authenticated `/ai` route.
6) Files changed (absolute paths): task/handoff/control-plane docs; retrieval planner/executor/types/system prompt; FMDS server/domain adapter; ASRS AI SDK tools; strategist registry/restriction policy; handler trace/error boundary; focused tests and evidence artifacts. No database migration.
7) Commands run and outcome (pass/fail counts): focused cutover Jest 10 suites/142 tests pass; citation widget Jest 1 suite/12 tests pass; targeted ESLint passes with one unrelated pre-existing warning; source-specific RAG guard passes; `git diff --check` passes; live Gateway smoke passes; authenticated supported-answer and Pending Review browser flows pass.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ai-plan/councils/2026-07-20-rag-strategy-council-asrs-fmds-cutover.md`; `docs/ops/evidence/2026-07-20-ai-chat-fmds-2026-cutover/fmds-clickable-citations.png`; `docs/ops/evidence/2026-07-20-ai-chat-fmds-2026-cutover/pending-review-proof.png`; persisted session `473d4379-2f8a-4fd8-b81d-1982a53d30bf`.
9) Top 3 findings (frontend-visible issues first): canonical `/ai` returns revision-scoped FMDS0834 2026 answers and explicit Pending Review states; its evidence cards now link to the exact FMDS table detail route; the adapter remains fail-closed against generic/legacy fallback and cross-edition blending.
10) Recommended next action (one line): Keep the corpus staging/active promotion decision separate, then expand deterministic estimator rules only from reviewed FMDS evidence.
11) Handoff file path: `docs/ops/handoffs/2026-07-20-S203-ai-chat-fmds-2026-cutover.md`
12) Migration ledger evidence: Not applicable; the first slice uses already-applied ASRS schema and RPCs.

## Linear Updates

- Kickoff comment: `c46000ba-7c8e-4bd7-83f0-339fb52a3085`
- Milestone/blocker comment: `a3861e60-07be-4dcd-b477-18db4431a47e`, with attached desktop and mobile proof.
- Completion comment: `108dbd6c-8c58-4361-aace-b8877cec6c2e`; provider access restored, live answer proof captured, source links verified, and cutover accepted.

## Current Status

Typed retrieval, tools, prompt contract, no-fallback policy, trace, provider path, clickable citations, and failure-loudly behavior are implemented and verified end to end.

## Exact Next Step

Make the explicit corpus activation decision in its own governed task; this chat cutover intentionally works with one latest eligible revision without changing revision lifecycle state.

## Known Pitfalls

- Do not expose ASRS service credentials to the client.
- Do not activate the staging corpus as part of chat integration.
- Do not route FMDS questions through generic project semantic search or web search.
- Do not promote extracted table/figure text to Verified without reviewed rule ownership.
- Do not add prompt-specific synonym patches instead of a typed domain contract.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/github/project-management
npm run rag:verify:chat-architecture
npm run rag:verify:source-specific
```

## Evidence

- Council: `docs/ai-plan/councils/2026-07-20-rag-strategy-council-asrs-fmds-cutover.md`
- Live ASRS corpus: FMDS0834 `2026-04`, revision `65306e47-c25a-4397-92a0-c44c03903d0f`, 225/225 embedded chunks, 9 reviewed Batch 1 rule cards.
- Persisted chat session: `473d4379-2f8a-4fd8-b81d-1982a53d30bf`; plan reason `asrs_fmds_revision_scoped_evidence`; `genericFallbackAllowed=false`.
- Desktop: `docs/ops/evidence/2026-07-20-ai-chat-fmds-2026-cutover/provider-blocked-actionable-desktop.png`.
- Mobile: `docs/ops/evidence/2026-07-20-ai-chat-fmds-2026-cutover/provider-blocked-actionable-mobile.png`.
- Supported answer proof: `docs/ops/evidence/2026-07-20-ai-chat-fmds-2026-cutover/fmds-clickable-citations.png`.
- Pending Review proof: `docs/ops/evidence/2026-07-20-ai-chat-fmds-2026-cutover/pending-review-proof.png`.
- Linear screenshot attachments: supported answer `8f002e97-890f-4bda-a720-aa90bd153cb0`; Pending Review `2e0568c1-3c9a-4a95-bf42-76b4e379b245`.
- Published implementation: cutover source is present on `origin/main`; clickable citation guardrail commit `a420fcd5e17ef7c88286ca76081e372e4c241cc5` and closeout evidence commit `655ec32b3f3aefc910a92a2dae860155264c8d16` were read back from `origin/main`.

## Failure Classification

- Cause: the local runtime was using a stale Gateway credential, and persisted relative FMDS citation URLs were discarded by a client helper that accepted only absolute HTTP(S) URLs.
- Detection gap: provider health and citation clickability were not exercised in the original backend-focused proof.
- Prevention: provider configuration was read back across all Vercel environments, a live model smoke now proves the key path, relative first-party citation handling has regression coverage, and canonical browser proof exercises both answer modes.
- Owner: AI platform/runtime and shared assistant evidence renderer.
- Next action: monitor the provider independently and keep corpus activation as a separate revision-lifecycle operation.
- Unrelated repository debt: `npm run rag:verify:chat-architecture` fails on legacy action-tool approval metadata/Ask Alleato surface ownership; delegated full `tsc --noEmit` reports existing `handler-v2.ts` and `retrieval/deps.ts` errors outside task diff hunks.
