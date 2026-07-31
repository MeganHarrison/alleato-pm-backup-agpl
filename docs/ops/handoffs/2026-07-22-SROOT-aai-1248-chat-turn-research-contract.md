# Handoff: AAI-1248 Chat-turn Research Contract

Status: In Progress — reopened
Session: SROOT-AAI-1248
Task: AAI-1248 — https://linear.app/megankharrison/issue/AAI-1248/deepen-ai-chat-mixed-source-research-contract

## Intake Block

1) Session ID: SROOT-AAI-1248
2) Task ID: AAI-1248
3) Linear issue: AAI-1248
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1248/deepen-ai-chat-mixed-source-research-contract
5) Current status: In Progress — meetings and FMDS revision pinning verified; publication pending
6) Files changed (absolute paths): task, handoff, ADR, glossary, learning fingerprint, and exact AI retrieval paths listed in the writer lease
7) Commands run and outcome (pass/fail counts): PASS reopened focused Jest 4 suites / 43 tests; PASS targeted ESLint; PASS `typecheck:changed`; PASS exact authenticated `/ai` flow and persisted row readback; APPROVED independent review; KNOWN BASELINE FAIL full frontend typecheck with no diagnostics on current changed lines
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-22-aai-1248-chat-turn-research-contract/exact-question-final.png`; Linear attachment `381bddcd-946e-4ca3-83fa-484307e5ea9a`; persisted Chat row `b1950010-c9e7-49f7-bb41-f27aacf43d56`
9) Top 3 findings (frontend-visible issues first): a universal timeout killed valid meeting reads; broadening one source to multiple queries recreated the timeout because aggregate budget did not scale; successful prefetch readers remained model-visible and enabled contradictory retries
10) Recommended next action (one line): accept independent review, publish the exact task-owned files, attach the new canonical screenshot, and preserve the separate FMDS revision-integrity failure as explicit follow-up.
11) Handoff file path: `docs/ops/handoffs/2026-07-22-SROOT-aai-1248-chat-turn-research-contract.md`
12) Migration ledger evidence: Not applicable; no database migration is in scope.

## Linear Updates

- Kickoff comment: posted to AAI-1248 before implementation.
- Milestone comments: implementation and verification evidence posted as comment `38658dc5-a221-4b40-be89-875b6c87f37f`.
- Completion/blocker comment: reopened verification posted as Linear comment `d906f580-72f1-4322-8a68-c6076ba0a2a2`; screenshot attachment `8af04f9f-10d1-4a70-8586-1a53b410a786`.

## Scope And Ownership

- One typed mixed-source research contract and receipt projection.
- Exact AI retrieval, task, ADR, glossary, learning, and evidence paths held by lease `SROOT-AAI-1248`.
- Unrelated ASRS/table/main-activity leases and dirty paths are explicitly excluded.

## Evidence

- Writer lease acquired and audited on 2026-07-22.
- AAI-1248 created and related to AAI-1244.
- Runtime boundary already localized under AAI-1244: the plan requested source research, then later tool composition removed the required readers.
- One `ChatTurnResearchContract` now owns source recognition, tool mapping, prefetch, direct reader visibility, prompts, receipts, citations, and coverage.
- Live retries reconcile into the same ordered receipts used for final citations and persistence; successful reads cannot be downgraded by failed retries.
- Chat row `c9993b6c-8c0d-4314-8b24-bb919a9bbb5d` persisted FMDS `complete`, meetings `timed_out`, email `complete`, Teams `complete`, and `research_coverage_complete=false`.
- Its 12 persisted citations include FMDS, email, and Teams via per-source round-robin allocation.
- Focused Jest: 6 suites / 126 tests passed.
- Targeted ESLint and `npm run typecheck:changed` passed.
- `npm run rag:verify:source-specific` passed.
- Full `npm run typecheck` remains red on pre-existing repo debt, including unchanged lines in `handler-v2.ts` and `executor.ts`; the new contract and tests have no full-typecheck errors.
- `npm run rag:verify:chat-architecture` remains red on existing approval/resume/Ask Alleato contracts unrelated to AAI-1248.
- Lease audit observed an unrelated concurrent mutation to `frontend/src/lib/navigation-config.ts` under the active main-activity owner; it is excluded from this task's publication set.
- Independent review initially returned `NEEDS REWORK` for message-shaped meeting access denials; the classifier and exact regression assertion were corrected, and re-review returned `APPROVED`.
- Commit `7af007a6e0afc7157b597cd1eb626664da1afff5` is published and equals `origin/main`.
- `codex:finish` created the task commit but its duplicate changed-file ESLint and remote publisher paths failed on intentionally deleted files. Cause: both scripts passed deleted paths to commands that require files to exist. Detection gap: deletion handling was not covered in those finish-flow adapters. Prevention: task checks and the required verification contract passed before using explicit `git push origin main`; the finish tooling needs its own follow-up owner.
- Reopened after user correction: failure-loud handling was working, but the required meetings request still failed. Runtime history localized the first divergence to the executor's universal 3000 ms external-source timeout; three primary meeting receipts ended at 3002–3019 ms while a later live retry returned six results.
- The first timeout correction was itself too shallow: expanding each source into three operating queries kept one fixed aggregate budget. A live run measured meetings at 15139 ms and email/Teams at 12320–12321 ms, again forcing model retries.
- The deepened research module now owns a bounded per-query budget and derives aggregate timeout from required query count. Successful primary receipts remove their live reader from the model tool set, preventing duplicate contradictory retries.
- Exact authenticated rerun persisted Chat row `f8ec6e63-4b29-4650-b219-6fb36b61477f`: meetings `complete` in 29454 ms with 6 items, email `complete` in 2280 ms with 7, and Teams `complete` in 6118 ms with 3. The trace contains no later live communication-reader retry.
- The rendered answer used actual meeting/email/Teams evidence in an Alleato ASRS process map. Screenshot: `docs/ops/evidence/2026-07-22-aai-1248-chat-turn-research-contract/exact-prompt-meetings-evidence.png`.
- FMDS remained `unavailable` because candidates came from a different revision. This is a separate revision-integrity failure; the assistant correctly refused to substitute other revisions, so total mixed-source coverage remained false.
- Independent review rejected the first completed run because aliases had replaced the user's exact operating question. The contract now searches the exact question first and uses aliases only as recovery attempts.
- Final authenticated row `b1950010-c9e7-49f7-bb41-f27aacf43d56` persisted primary meetings `complete` in 37939 ms with 6 items, email `complete` in 4246 ms with 13, and Teams `complete` in 8978 ms with 9. No live retry of those readers appears in the trace.
- Final screenshot: `docs/ops/evidence/2026-07-22-aai-1248-chat-turn-research-contract/exact-question-final.png`.
- Independent review re-review returned `APPROVED` after exact-question preservation was added.
- FMDS runtime repair: the selected vector revision is now passed explicitly into both table and figure loaders. Live row `a14edd0e-f98a-43d6-b736-28827b42c408` returned FMDS `complete`, 8 items, 1778 ms, coverage `true`; screenshot `docs/ops/evidence/2026-07-22-aai-1248-chat-turn-research-contract/fmds-revision-pinned-final.png`.
- Reopened independent review returned `APPROVED` after the exact-question semantic correction.
- Linear screenshot attachment: `381bddcd-946e-4ca3-83fa-484307e5ea9a`.

## Risks And Next Step

- Risk: communication latency remains variable, but the timeout now scales with declared workload and remains bounded.
- Next: publish the verified communications fix, attach the new screenshot to AAI-1248, and route the separate FMDS revision mismatch to the active FMDS owner without weakening revision isolation.
