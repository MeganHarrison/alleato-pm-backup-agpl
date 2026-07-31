# Handoff: 2026-06-19 - Code-Mode RPC Security Decision

## Intake Block

1) Session ID: S67
2) Task ID: AAI-566
3) Linear issue: AAI-566
4) Linear URL: https://linear.app/megankharrison/issue/AAI-566/goal-7-c10-code-mode-rpc-security-review-and-sandbox-decision
5) Current status: Published to `origin/main` at `e9d736b2df`; closeout evidence recorded.
6) Files changed (absolute paths):
- `/Users/meganharrison/Documents/alleato-pm/docs/ai-plan/security/code-mode-rpc-security-decision.md`
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_code_mode_rpc_guardrail.mjs`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-19-code-mode-rpc-security-decision.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-19-S67-code-mode-rpc-security-decision.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/review-queue.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-RAG-ARCHITECTURE.md`
7) Commands run and outcome (pass/fail counts):
- PASS: Goal 7 document reviewed.
- PASS: Hermes `tools/code_execution_tool.py` reviewed as REFERENCE only.
- PASS: Alleato anchors reviewed: net-policy egress guard, outbound action policy, assistant tool registry.
- PASS: `node --check scripts/verify/verify_code_mode_rpc_guardrail.mjs`.
- PASS: `node scripts/verify/verify_code_mode_rpc_guardrail.mjs`.
- PASS: `npm run linear:codex:check -- docs/ops/handoffs/2026-06-19-S67-code-mode-rpc-security-decision.md`.
- PASS: `npm run codex:finish -- --message "Add code-mode RPC security decision" --files ...` published to `origin/main` at `e9d736b2df`.
8) Evidence artifacts (screenshot/video/report/log paths):
- Task evidence: `docs/ops/tasks/2026-06-19-code-mode-rpc-security-decision.md`.
- Decision artifact: `docs/ai-plan/security/code-mode-rpc-security-decision.md`.
9) Top 3 findings (frontend-visible issues first):
- No UI changes; this slice blocks premature arbitrary-code-execution runtime work.
- Hermes allows filesystem mutation and terminal-like tool stubs inside its sandbox; Alleato should not copy that surface.
- Alleato already has useful prerequisites, but still lacks an approved isolated runtime and automated escape tests.
10) Recommended next action (one line): Start Goal 7 G5 unified delivery router.
11) Handoff file path: docs/ops/handoffs/2026-06-19-S67-code-mode-rpc-security-decision.md
12) Migration ledger evidence: Not applicable; no migration.

## Linear Updates

- Kickoff comment: 4c555aaa-cac1-4cf8-9e7d-3e8a30449d04
- Milestone comments: fdd01eaf-2fcc-4175-b448-29ae6273ed1a
- Completion/blocker comment: c43a04c6-f8c9-4ebc-824a-81f608d8e9da

## Current Status

C10 is not approved for implementation. The security decision requires an
external isolated runtime, exact env allowlist, read-only tool allowlist,
registry filtering, net-policy enforcement, strict limits, AI Ops ledger
observability, and escape tests before any Code-Mode RPC runtime can be built.

## Exact Next Step

Start Goal 7 G5 in a separate task/issue/handoff slice.

## Known Pitfalls

- Do not implement `eval`, `Function`, `vm`, local subprocess execution, or a
  Next.js in-process RPC listener.
- Do not include terminal, patch, write, delivery, Supabase admin, or MCP
  mutation tools in a first Code-Mode RPC allowlist.
- Do not claim C10 runtime is complete; this slice is the required
  security/sandbox decision before implementation.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
node scripts/verify/verify_code_mode_rpc_guardrail.mjs
npm run linear:codex:check -- docs/ops/handoffs/2026-06-19-S67-code-mode-rpc-security-decision.md
```

## Evidence

- Goal 7 C10 plan reviewed from `docs/ai-plan/hermes-openclaw-goals/goal-07-later-high-risk-work.md`.
- Hermes `tools/code_execution_tool.py` reviewed as REFERENCE only.
- Security decision drafted at `docs/ai-plan/security/code-mode-rpc-security-decision.md`.
- Guardrail verifier drafted at `scripts/verify/verify_code_mode_rpc_guardrail.mjs`.
- Guardrail verifier passed after fixing the initial `.mjs`/CommonJS syntax error.
- Linear handoff check passed.
- `codex:finish` published to `origin/main` at `e9d736b2df` and verified `HEAD == origin/main`.
