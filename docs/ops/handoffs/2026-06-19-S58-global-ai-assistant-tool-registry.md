# Handoff: 2026-06-19 - Global AI Assistant Tool Registry

## Intake Block

1) Session ID: S58
2) Task ID: AAI-554
3) Linear issue: AAI-554
4) Linear URL: https://linear.app/megankharrison/issue/AAI-554/implement-global-ai-assistant-tool-registry
5) Current status: Complete, pending publish
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-19-global-ai-assistant-tool-registry.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-19-S58-global-ai-assistant-tool-registry.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`; `/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-RAG-ARCHITECTURE.md`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tool-registry.ts`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/orchestrator.ts`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/__tests__/tool-registry.test.ts`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/tool-registry.ts`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/__tests__/workflow-pack.test.ts`; `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_ai_assistant_tool_registry.mjs`; `/Users/meganharrison/Documents/alleato-pm/package.json`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-19-global-ai-assistant-tool-registry.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-19-S58-global-ai-assistant-tool-registry.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-RAG-ARCHITECTURE.md`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/orchestrator.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tool-registry.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/__tests__/tool-registry.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/tool-registry.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/__tests__/workflow-pack.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_ai_assistant_tool_registry.mjs`
   - `/Users/meganharrison/Documents/alleato-pm/package.json`
7) Commands run and outcome (pass/fail counts): Pass: AI SDK docs/source checked for current `tool({ inputSchema, execute })` API; Pass: Linear issue AAI-554 created and kickoff comment posted; Pass: assistant tool factories inventoried; Pass: focused ESLint for registry/workflow/orchestrator files; Pass: focused Jest registry/workflow-pack tests; Pass: `npm run rag:verify:assistant-tool-registry`; Pass: `npm run linear:codex:check -- docs/ops/handoffs/2026-06-19-S58-global-ai-assistant-tool-registry.md`; Pass: policy/visibility Jest tests and CMO orchestrator registration tests; Pass: live `/ai` assistant smoke on current repo dev server at `http://localhost:3002/ai`; Fail unrelated repo debt: delegated `cd frontend && npm run typecheck` timed out after 60s; Invalid smoke method: direct TSX-based orchestrator import hit Next `server-only` guard; Blocked then remediated: first `npm run codex:finish -- --message "Add global assistant tool registry foundation" --files ...` was stopped by the RAG docs gate until `docs/architecture/AI-RAG-ARCHITECTURE.md` was updated.
   - Pass: read `docs/ops/tasks/2026-06-19-global-ai-assistant-tool-registry.md`.
   - Pass: read AI SDK skill and checked local `node_modules/ai/docs` for current `tool({ inputSchema, execute })` tool API.
   - Pass: created Linear issue AAI-554.
   - Pass: inventoried initial assistant tool assembly entry points in `frontend/src/lib/ai/orchestrator.ts`, `frontend/src/lib/ai/bot-core.ts`, and `frontend/src/lib/ai/tools/**`.
   - Pass: added canonical global assistant registry contract at `frontend/src/lib/ai/tool-registry.ts`.
   - Pass: registered Executive Daily Brief source, generation, artifact, and delivery tools in the global registry with owner, category, capabilities, workflows, actor modes, source families, write/delivery policy, channel policy, evidence policy, and factory metadata.
   - Pass: rewired `frontend/src/lib/ai-ops/tool-registry.ts` to consume `toolDefinitionsForWorkflow()` from the global registry instead of owning standalone workflow-local tool definitions.
   - Pass: added `frontend/src/lib/ai/__tests__/tool-registry.test.ts` for checked-in registry validation, duplicate-name failure, source-bearing metadata failure, delivery-channel metadata failure, Executive Daily Brief subset filtering, and AI Ops definition projection.
   - Pass: extended `frontend/src/lib/ai-ops/__tests__/workflow-pack.test.ts` to prove Executive Daily Brief uses the global registry subset.
   - Pass: added `scripts/verify/verify_ai_assistant_tool_registry.mjs` and `npm run rag:verify:assistant-tool-registry` to prevent Executive Daily Brief from regressing back to workflow-local definitions.
   - Pass: `cd frontend && npx eslint src/lib/ai/tool-registry.ts src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai-ops/tool-registry.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts --runInBand` passed 2 suites / 14 tests.
   - Pass: `npm run rag:verify:assistant-tool-registry`.
   - Pass: `cd frontend && npx eslint src/lib/ai/tool-registry.ts src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai/orchestrator.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts --runInBand` passed 1 suite / 9 tests.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai/__tests__/cmo-orchestrator.test.ts --runInBand` passed 2 suites / 12 tests.
   - Pass: `cd frontend && npx eslint src/lib/ai/tool-registry.ts src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai/orchestrator.ts src/lib/ai/__tests__/cmo-orchestrator.test.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai/__tests__/cmo-orchestrator.test.ts --runInBand` passed 2 suites / 15 tests after optional-provider, project-scope, and source-family policy coverage was added.
   - Pass: `agent-browser open http://localhost:3002/ai` plus prompt `In one sentence, say what tools are available for project questions without taking any actions.` against this repo's dev server. `/api/ai-assistant/chat` returned 200, session `c1956283-00ed-42ce-9c1a-d8198ef57592` was created, `tool_count` was 94 after project-scope filtering, no tools were called, and no registry errors appeared.
   - Fail unrelated repo debt: delegated `cd frontend && npm run typecheck` timed out after 60s with no current-task type error surfaced.
   - Invalid smoke method: direct TSX-based orchestrator import hit Next `server-only` guard through `microsoft-graph/calendar-events.ts`.
   - Blocked then remediated: first `npm run codex:finish -- --message "Add global assistant tool registry foundation" --files ...` was stopped by the RAG docs gate until `docs/architecture/AI-RAG-ARCHITECTURE.md` was updated.
   - Pass: posted Linear kickoff comment `4aa72d25-b339-4f0e-9527-c0f9a6c0bb45`.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/tasks/2026-06-19-global-ai-assistant-tool-registry.md`; `docs/ops/handoffs/2026-06-19-S58-global-ai-assistant-tool-registry.md`; `docs/architecture/AI-RAG-ARCHITECTURE.md`; `frontend/src/lib/ai/tool-registry.ts`; `frontend/src/lib/ai/orchestrator.ts`; `frontend/src/lib/ai/__tests__/tool-registry.test.ts`; `frontend/src/lib/ai-ops/tool-registry.ts`; `frontend/src/lib/ai-ops/__tests__/workflow-pack.test.ts`; `scripts/verify/verify_ai_assistant_tool_registry.mjs`; `tests/agent-browser-runs/2026-06-19-assistant-tool-registry-smoke/ai-tool-registry-project-policy-smoke.png`
   - `docs/ops/tasks/2026-06-19-global-ai-assistant-tool-registry.md`
   - `docs/ops/handoffs/2026-06-19-S58-global-ai-assistant-tool-registry.md`
   - `docs/architecture/AI-RAG-ARCHITECTURE.md`
   - `frontend/src/lib/ai/tool-registry.ts`
   - `frontend/src/lib/ai/orchestrator.ts`
   - `frontend/src/lib/ai/__tests__/tool-registry.test.ts`
   - `scripts/verify/verify_ai_assistant_tool_registry.mjs`
   - `tests/agent-browser-runs/2026-06-19-assistant-tool-registry-smoke/ai-tool-registry-project-policy-smoke.png`
9) Top 3 findings (frontend-visible issues first): Live `/ai` assistant smoke now passes on this repo with registry-filtered tool visibility; Executive Daily Brief and main Strategist/specialist tool assembly consume global registry-filtered subsets; actor/workflow/project/source/write/delivery/channel policy and visibility trace are wired.
   - First implementation slice established the global registry contract and migrated Executive Daily Brief only.
   - Second implementation slice registered aggregate project/action/operational/financial/Acumatica/schedule/progress/document/intelligence/marketing/workspace/web/structured factories and routed Strategist/specialist assembly through `filterRegisteredToolSet()`.
   - Broad direct `tool({ ... })` guardrail now has an explicit allowlist for approved factory/constructor files and non-assistant helpers.
10) Recommended next action (one line): Publish the final registry slice, then open a separate repo-debt task for the unrelated bounded typecheck timeout and Velt token 500.
11) Handoff file path: docs/ops/handoffs/2026-06-19-S58-global-ai-assistant-tool-registry.md
12) Migration ledger evidence: Not applicable; no Supabase migrations touched.

## Linear Updates

- Kickoff comment: 4aa72d25-b339-4f0e-9527-c0f9a6c0bb45
- Foundation milestone comment: c2033f0f-e360-41ca-98d3-175af1bf27a5
- Runtime factory filtering milestone comment: d468704f-39bb-460a-952a-6376cf2af6a5
- Policy and visibility milestone comment: eb2983d7-1ae9-4aab-96ea-34b137b9fbbe
- Smoke and project/source policy milestone comment: 662aa639-f372-4325-9e6b-7cba6f0ffabd

## Current Status

- Created the canonical global assistant tool registry at `frontend/src/lib/ai/tool-registry.ts`.
- Registered Executive Daily Brief source, generation, artifact, Teams delivery, and email delivery tools with owner, workflow, actor, source-family, delivery-channel, write policy, evidence policy, and execution metadata.
- Rewired `frontend/src/lib/ai-ops/tool-registry.ts` so Executive Daily Brief consumes `toolDefinitionsForWorkflow()` from the global registry instead of owning standalone definitions.
- Added focused registry contract tests and a static guardrail that prevents Executive Daily Brief from regressing back to workflow-local tool definitions.
- Updated `docs/architecture/AI-RAG-ARCHITECTURE.md` after the RAG docs gate correctly blocked the first finish attempt.
- Registered the main assistant chat factories and changed Strategist/specialist assembly to call `filterRegisteredToolSet()` before exposing factory tools to the model.
- Expanded `scripts/verify/verify_ai_assistant_tool_registry.mjs` so raw orchestrator spreads of migrated factories fail.
- Added actor/write/delivery/channel policy filtering, Strategist `assistantToolVisibility` trace output, and direct `tool({ ... })` constructor guardrails with explicit allowlist reasons.
- Added project-scope and source-family policy filtering, optional provider-disabled factory handling for Tavily-backed web search, and live `/ai` assistant smoke evidence against this repo's dev server.

## Known Pitfalls

- Full frontend typecheck remains blocked by unrelated bounded-timeout repo debt; focused current-task checks and live assistant smoke passed.
- Direct `tool({ ... })` definitions still exist inside approved factory modules by design; new bypasses outside the allowlist fail the registry guardrail.
- The live `/ai` page still logs an unrelated Velt token 500 in page chrome; assistant conversation/chat routes returned 200 and completed.

## Working Notes

- Current Executive Daily Brief registry lives at `frontend/src/lib/ai-ops/tool-registry.ts`.
- Broad assistant tools still live under `frontend/src/lib/ai/tools/**`.
- Runtime assembly currently happens through factories such as `createProjectTools`, `createActionTools`, `createExecutiveBriefTools`, and `createStrategistTools`.
