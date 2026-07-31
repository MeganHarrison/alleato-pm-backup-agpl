# Handoff: 2026-06-18 — Subagent Runtime Architecture

## Intake Block

<!-- markdownlint-disable MD029 MD034 -->
1) Session ID: S50
2) Task ID: AAI-532
3) Linear issue: AAI-532
4) Linear URL: https://linear.app/megankharrison/issue/AAI-532/build-subagent-delegation-runtime
5) Current status: Pending Review
6) Files changed (absolute paths):
   - `/Users/meganharrison/Documents/alleato-pm/docs/ai-plan/subagent-work-queue-runtime-architecture.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-18-S50-subagent-runtime-architecture.md`
7) Commands run and outcome (pass/fail counts):
   - Pass: `rg -n "AAI-532|S50|subagent|delegation|work queue|work-queue|tool trace|tool_trace|feedback|learning|agent runtime|assistant chat|chat" docs/ops docs/ai-plan docs/architecture frontend/src backend/src scripts package.json` (too broad; returned archived eval noise, so narrowed follow-up reads)
   - Pass: `sed -n '1,220p' docs/ai-plan/TASKS-AI.md`
   - Pass: `sed -n '1,260p' docs/ai-plan/AI-OS-GAP-MATRIX.md`
   - Pass: `sed -n '1,260p' docs/ai-plan/AI-OS-PHASE-1-IMPLEMENTATION-PLAN.md`
   - Pass: `sed -n '1,260p' docs/architecture/AI-RAG-ARCHITECTURE.md`
   - Pass: `sed -n '1,220p' docs/ops/handoffs/2026-06-18-S50-subagent-runtime-architecture.md`
   - Pass: `git status --short`
   - Pass: `rg -n "AAI-532|subagent delegation|work queue|AI Work Queue|Deep Agents|deep_project_intelligence|ai_learning_promotions|tool_trace" /Users/meganharrison/.codex/memories/MEMORY.md`
   - Pass: targeted reads of assistant chat handler, frontend AI orchestrator, feedback-event service, agent-learning service, action tools, shared tool utilities, Deep Agents project-status bridge, backend project-intelligence runtime/contracts/subagent files, source-processing service, and queue migrations.
   - Fail unrelated repo debt: `npx markdownlint-cli2 docs/ai-plan/subagent-work-queue-runtime-architecture.md docs/ops/handoffs/2026-06-18-S50-subagent-runtime-architecture.md` expanded repo-wide and found 29,579 existing Markdown errors outside S50 scope.
   - Initial scoped fail: `npx markdownlint-cli2 --no-globs docs/ai-plan/subagent-work-queue-runtime-architecture.md docs/ops/handoffs/2026-06-18-S50-subagent-runtime-architecture.md` found two existing bare Linear URLs in this handoff; fixed in this update.
8) Evidence artifacts (screenshot/video/report/log paths):
   - `/Users/meganharrison/Documents/alleato-pm/docs/ai-plan/subagent-work-queue-runtime-architecture.md`
9) Top 3 findings (frontend-visible issues first):
   - The frontend assistant already persists enough top-level run metadata in `chat_history.metadata` (`tool_trace`, `response_quality`, `source_debug`, retrieval plan, provider path, memory usage), but child delegation is not yet first-class/queryable.
   - The backend Deep Agents runtime already has domain subagents and tool gates, but subagent reports are not consistently persisted as parent-child work with normalized sources, failure states, and audit events.
   - Existing queue precedents (`source_processing_jobs`, `packet_refresh_jobs`, `fireflies_ingestion_jobs`) show the right status/retry/error pattern; AAI-532 should reuse that lifecycle shape instead of inventing an opaque background runner.
10) Recommended next action (one line): Implement the first read-only `ai_work_runs` parent-child ledger and `delegateProjectInvestigation` contract before any writes or AI Work Queue UI.
11) Handoff file path: `docs/ops/handoffs/2026-06-18-S50-subagent-runtime-architecture.md`
12) Migration ledger evidence: Not applicable; no migrations were created or changed.
<!-- markdownlint-enable MD029 MD034 -->

## Linear Updates

- Kickoff comment: [Linear kickoff](https://linear.app/megankharrison/issue/AAI-532#comment-e9a4abf4-bdf5-42a6-86e2-1babb9ae591e)
- Milestone comments: Pending
- Completion/blocker comment: Linear comment `63250769-799f-48d5-b19c-10fef89b6862`

## Current Status

Pending Review. Produced the repo-specific subagent/work-queue runtime architecture and first safe implementation slice. No code, migrations, admin review UI, browser verification, commit, or push performed.

## Exact Next Step

Review and accept the architecture spec, then open a separate implementation slice for the read-only parent-child work-run ledger and `delegateProjectInvestigation` tool contract.

## Known Pitfalls

- Do not invent a parallel platform if existing assistant, task, feedback, or learning services can own the workflow.
- Keep this repo-specific and implementation-ready; avoid generic agent theory.
- Do not touch `scripts/jobplanner/import-prime-contract.mjs`; it is unrelated existing dirt.
- Do not widen child agents to writes/external sends in the first slice; use read-only child reports and parent-controlled approval later.
- Do not make `TASKS-AI.md` edits from this S50 scope; suggested checklist updates are below.

## Resume Commands

```bash
rg -n "agent|subagent|work queue|ai_work|tool_trace|ai_learning_promotions|feedback_events" frontend/src backend/src docs/ai-plan
```

## Evidence

- Created architecture/spec: `docs/ai-plan/subagent-work-queue-runtime-architecture.md`
- Spec covers:
  - current repo anchors for assistant chat, traces, feedback events, learning promotions, queue ledgers, and backend Deep Agents
  - parent-child run model
  - child report schema
  - normalized evidence/source model
  - tool scoping and permission modes
  - runtime bounds
  - typed failure states
  - audit and learning event mappings
  - first safe implementation slice
  - exact likely frontend, backend, database, and verifier files for future implementation
- Unrelated dirty file observed and not touched: `scripts/jobplanner/import-prime-contract.mjs`

## Suggested TASKS-AI Updates

Do not edit `docs/ai-plan/TASKS-AI.md` in this S50 task. Suggested follow-up checklist split:

- Add subagent/work-run architecture spec.
- Add `ai_work_runs` schema and generated types.
- Add child report schema validation.
- Add read-only backend child runner.
- Add assistant `delegateProjectInvestigation` tool.
- Persist parent-child trace metadata to `chat_history`.
- Persist work-run events, sources, and tool calls.
- Add first AI Work Queue read-only list/detail surface.
- Add browser verification for a read-only delegated project investigation.

## Risks And Blockers

- No blocker for this documentation slice.
- Implementation risk: frontend AI SDK `consult*` delegation and backend Deep Agents delegation can diverge unless the future slice introduces one canonical persisted parent-child run contract.
- Verification risk: repo-wide Markdown lint currently fails on existing unrelated Markdown debt when invoked without `--no-globs`; use scoped lint for touched files.
