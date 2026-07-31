# Handoff: 2026-05-13 - Deep Agents Project Intelligence Orchestrator PRP

## Intake Block

1) Session ID: S45
2) Task ID: AAI-356
3) Linear issue: AAI-356
4) Linear URL: https://linear.app/megankharrison/issue/AAI-356/evaluate-deep-agents-backend-orchestrator-for-alleato-project
5) Current status: Pending Review
6) Files changed (absolute paths):
- `/Users/meganharrison/Documents/alleato-pm/docs/PRPs/deep-agents-project-intelligence/prp-deep-agents-project-intelligence.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-05-13-S45-deep-agents-orchestrator-prp.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/review-queue.md`
- `/Users/meganharrison/Documents/alleato-pm/backend/src/api/main.py`
- `/Users/meganharrison/Documents/alleato-pm/backend/requirements.txt`
- `/Users/meganharrison/Documents/alleato-pm/backend/src/services/agents/__init__.py`
- `/Users/meganharrison/Documents/alleato-pm/backend/src/services/agents/deep_project_intelligence.py`
- `/Users/meganharrison/Documents/alleato-pm/backend/src/services/agents/deep_project_intelligence_contracts.py`
- `/Users/meganharrison/Documents/alleato-pm/backend/tests/test_deep_project_intelligence.py`
- `/Users/meganharrison/Documents/alleato-pm/render.yaml`
- `/Users/meganharrison/Documents/alleato-pm/backend/render.yaml`
- `/Users/meganharrison/Documents/alleato-pm/package.json`
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_deep_agents_nonprod_readiness.mjs`
7) Commands run and outcome (pass/fail counts):
- PASS: `rg --files docs docs/PRPs _bmad-output 2>/dev/null | rg 'PRP|ai|intelligence|rag|linear|orchestration' | head -120`
- PASS: `rg -n "Deep Agents|LangGraph|AI SDK|ToolLoopAgent|packet-first|intelligence orchestrator|project intelligence" docs frontend/src backend/src scripts package.json frontend/package.json backend/requirements.txt 2>/dev/null | head -160`
- PASS: `git diff --check -- docs/PRPs/deep-agents-project-intelligence/prp-deep-agents-project-intelligence.md docs/ops/handoffs/2026-05-13-S45-deep-agents-orchestrator-prp.md docs/ops/orchestration/session-board.md docs/ops/orchestration/review-queue.md`
- PASS: `npm run linear:codex:check -- docs/ops/handoffs/2026-05-13-S45-deep-agents-orchestrator-prp.md`
- PASS: `python -m pytest backend/tests/test_deep_project_intelligence.py -q`
- PASS: `python -m pytest backend/tests/test_deep_project_intelligence.py -q` after Slice 2 read-only source probes (`6 passed`)
- PASS: `python -m pytest backend/tests/test_deep_project_intelligence.py -q` after Slice 3A Deep Agents runtime hook (`8 passed`)
- PASS: `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_deep_project_intelligence.py -q` after installed Deep Agents graph smoke guardrail (`9 passed`)
- PASS: `PYTHONPATH=backend backend/.venv/bin/python -m py_compile backend/src/services/agents/deep_project_intelligence.py backend/src/services/agents/deep_project_intelligence_contracts.py backend/src/api/main.py backend/tests/test_deep_project_intelligence.py`
- PASS: local runtime smoke with `deepagents.create_deep_agent` and a bindable fake chat model returned `mode=deep_agents` with successful `deepagents_runtime` trace.
- PASS: `npm run test:unit -- --runInBand --runTestsByPath src/lib/ai/__tests__/deep-agent-project-status.test.ts` (`4 passed`)
- PASS: `npm run typecheck -- --pretty false`
- PASS: `npx eslint src/lib/ai/deep-agent-project-status.ts src/lib/ai/__tests__/deep-agent-project-status.test.ts src/lib/ai/chat-handler.ts --cache --cache-strategy content`
- PASS: `git diff --check -- frontend/src/lib/ai/deep-agent-project-status.ts frontend/src/lib/ai/__tests__/deep-agent-project-status.test.ts frontend/src/lib/ai/chat-handler.ts`
- PASS: `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_deep_project_intelligence.py -q` after project-lookup failure hardening (`11 passed`)
- PASS: local backend contract smoke on `http://127.0.0.1:8051/api/intelligence/deep-agent/project-status` returned `200`, `mode=contract_spike`, project 43, five checked source categories, and 10 evidence rows.
- PASS: local frontend bridge smoke with `BACKEND_URL=http://127.0.0.1:8051` and `AI_ASSISTANT_DEEP_AGENT_BRIDGE_ENABLED=true` returned `enabled=true`, `mode=contract_spike`, source evidence widget type `source_evidence_drawer`, and guardrail context present.
- WARN provider quota: local backend runtime smoke with `DEEP_AGENTS_PROJECT_INTELLIGENCE_RUNTIME=deep_agents` reached `deepagents_runtime` but fell back to `contract_spike` because direct OpenAI returned 429 `insufficient_quota`.
- PASS: `curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("openai/")) | .id] | reverse | .[]' | head -40` confirmed `openai/gpt-5.4-mini` is available through AI Gateway.
- PASS: `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_deep_project_intelligence.py -q` after AI Gateway model resolution (`14 passed`)
- PASS: `PYTHONPATH=backend backend/.venv/bin/python -m py_compile backend/src/services/agents/deep_project_intelligence.py backend/src/services/agents/deep_project_intelligence_contracts.py backend/src/api/main.py backend/tests/test_deep_project_intelligence.py`
- PASS: local backend/frontend bridge smoke with `DEEP_AGENTS_PROJECT_INTELLIGENCE_RUNTIME=deep_agents`, `DEEP_AGENTS_PROJECT_INTELLIGENCE_MODEL=gpt-5.4-mini`, `BACKEND_URL=http://127.0.0.1:8051`, and `AI_ASSISTANT_DEEP_AGENT_BRIDGE_ENABLED=true` returned `mode=deep_agents`, `sourceCount=9`, `evidenceCount=11`, and successful `deepagents_runtime` trace; backend logs confirmed AI Gateway `/v1/chat/completions` returned HTTP 200.
- PASS: `node scripts/verify/verify_render_ai_gateway_health.mjs` confirmed active Render backend health, AI Gateway configured, Supabase service configured, and AI Gateway balance above floor.
- PASS: active backend endpoint probe against `https://alleato-backend-rbnj.onrender.com/api/intelligence/deep-agent/project-status` returned expected 503 disabled state before non-production flags are enabled.
- PASS: `npm run rag:verify:deep-agents-nonprod` verifies Render manifest default-off flags, active backend health, endpoint state, and Render API service-mapping drift.
- PASS deployment mapping: the `.env`/`frontend/.env.local` `RENDER_API_KEY` resolves to the active `alleato-backend-rbnj` service (`srv-d8271ohj2pic739klb7g`); no other Render backend service should be used.
- PASS: `npm run verify:active-backend-url` now scans tracked docs/code plus local `.vercel`, `frontend/.vercel`, `frontend/.env.local`, `.claude`, and `claude-memory-compiler-main`; only `alleato-backend-rbnj.onrender.com` is allowed for Render backend URLs.
- PASS: hidden/no-ignore scan found no remaining stale Render backend host references after cleanup.
- PASS: Vercel env values for `NEXT_PUBLIC_AGENT_ENDPOINT`, `PYTHON_BACKEND_URL`, and `BACKEND_URL` were reset to `https://alleato-backend-rbnj.onrender.com` for production, development, preview, and preview `staging`; temp pulls for production/preview/staging found no stale backend host strings.
- PASS: `npm run rag:verify:deep-agents-nonprod` passes in default-off mode with the active `alleato-backend-rbnj` service, healthy AI Gateway, and healthy Supabase service visibility.
- PASS: Render env update via API on active service `srv-d8271ohj2pic739klb7g` set `DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED=true`, `DEEP_AGENTS_PROJECT_INTELLIGENCE_RUNTIME=deep_agents`, and `DEEP_AGENTS_PROJECT_INTELLIGENCE_MODEL=gpt-5.4-mini`.
- PASS: Render deploy `dep-d82dh883kofs73cn8i80` completed live on the active `alleato-backend-rbnj` service.
- PASS: `DEEP_AGENTS_EXPECT_ENABLED=true npm run rag:verify:deep-agents-nonprod` returned `endpointState=deep_agents` and `endpointMode=deep_agents`.
- PASS: Vercel preview `staging` now has `AI_ASSISTANT_DEEP_AGENT_BRIDGE_ENABLED=true`; production bridge remains off.
- WARN existing provider debt: `node scripts/verify/verify_ai_tool_calling_provider_matrix.mjs` exited 0 and refreshed `docs/ai-plan/evals/ai-tool-calling-provider-matrix-2026-04-30.json`, but the artifact currently reports `supportsToolCalling=false`; gateway `generateText` passed, direct OpenAI quota failed, and streamText paths did not produce a passing tool-call result.
- FAIL unrelated auth dependency: `npm run rag:verify:assistant-routing` failed in setup before route assertions because Supabase Auth timed out during `listUsers` after 30000ms in `frontend/tests/auth.setup.ts`.
- WARN unrelated environment debt: backend `.venv` emits `RequestsDependencyWarning` for `urllib3`/`chardet` or `charset_normalizer` version mismatch.
- FAIL unrelated: `python -m pytest backend/tests/test_deep_project_intelligence.py backend/tests/test_api_routes.py -q` failed in legacy Fireflies ingestion endpoint tests because the shared test harness still exposes the mocked admin dependency as required `args`/`kwargs` query params. New Deep Agents tests passed in the same run.
8) Evidence artifacts (screenshot/video/report/log paths):
- `docs/PRPs/deep-agents-project-intelligence/prp-deep-agents-project-intelligence.md`
- `backend/tests/test_deep_project_intelligence.py`
- `backend/src/services/agents/deep_project_intelligence.py`
- `backend/src/api/main.py`
- `frontend/src/lib/ai/deep-agent-project-status.ts`
- `frontend/src/lib/ai/__tests__/deep-agent-project-status.test.ts`
- `docs/ai-plan/evals/ai-tool-calling-provider-matrix-2026-04-30.json`
- Linear kickoff comment: `4f16e521-7217-405d-8089-26cace8d2657`
9) Top 3 findings (frontend-visible issues first):
- Deep Agents should not replace AI SDK UI/chat transport; it should be evaluated as a backend orchestration harness for complex project-intelligence workflows.
- Current repo evidence already has packet-first intelligence and AI SDK tool loops, but the product contract is distributed across route branches, fallbacks, and quality checks.
- Slice 3B now adds a feature-gated AI SDK bridge that calls the backend Deep Agents packet for selected-project owner-status/risk intents without moving LangChain into frontend code; local Deep Agents runtime now succeeds through AI Gateway.
- Non-production readiness is now guarded: default-off Render flags are declared in both manifests, active backend health passes, and stale Render service mapping is explicit.
10) Recommended next action (one line): Resolve active Render service API access or enable the Deep Agents env vars through the active Render dashboard, then run `DEEP_AGENTS_EXPECT_ENABLED=true npm run rag:verify:deep-agents-nonprod` and one authenticated selected-project owner-status prompt through `/api/ai-assistant/chat`.
11) Handoff file path: `docs/ops/handoffs/2026-05-13-S45-deep-agents-orchestrator-prp.md`
12) Migration ledger evidence: Not applicable; no migration created.

## Linear Updates

- Kickoff comment: Posted to AAI-356, comment id `4f16e521-7217-405d-8089-26cace8d2657`.
- Milestone comments: Completion comment posted after PRP/checks, comment id `331fa6a6-ff7d-4047-9929-725a6f57a99c`.
- Completion/blocker comment: Pending Review comment posted after validation, comment id `331fa6a6-ff7d-4047-9929-725a6f57a99c`.
- AI Gateway runtime update: Posted after local Deep Agents runtime succeeded through AI Gateway, comment id `2a2c0fcc-29d3-424c-abb7-20d4939dcfbb`.
- Non-production readiness update: Posted after adding the default-off Render flags and readiness guardrail, comment id `2f9072ee-e1be-4bc0-b74b-668ee2ed2819`.
- Active Render backend cleanup: Posted after removing stale backend references and tightening the active-backend guardrail, comment id `a2f86d5b-5c97-42f2-8921-fb6a176d3e72`.
- Active Render Deep Agents enablement: Posted after enabling the backend flags on `alleato-backend-rbnj` and verifying `endpointMode=deep_agents`, comment id `51c49c45-5e0e-4397-b372-737f62029d47`.

## Current Status

Created an architecture PRP that evaluates LangChain Deep Agents as a backend project-intelligence orchestrator while keeping the AI SDK as the chat/UI integration layer.

The PRP includes the framework boundary, current repo evidence, pilot request/response contracts, subagent shape, backend integration slices, non-goals, risks, guardrails, and verification commands.

Implemented Slice 1 as a backend-only contract spike:

- Added Pydantic request/response contracts for the pilot packet.
- Added `build_project_status_contract_spike(...)`.
- Added `POST /api/intelligence/deep-agent/project-status`, gated by `DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED=true`.
- Added focused tests for explicit missing source coverage, project lookup failure, feature-gate behavior, successful contract response, and 404 on unresolved project.

Implemented Slice 2 as read-only source coverage probes:

- Added source probes for packet, Teams, meetings, emails, documents, financials, schedule, RFIs, and submittals.
- Added bounded project-filtered table reads through the existing backend Supabase store.
- Added per-source `checked`, `missing`, and `failed` statuses.
- Added per-source `toolTrace` entries.
- Added sample evidence extraction from source rows.
- Kept the endpoint backend-only and environment-gated.

Implemented Slice 3A as a backend-only Deep Agents runtime hook:

- Added `deepagents>=0.6.1` and `langchain-openai>=0.3.0` to backend requirements.
- Added lazy `create_deep_agent` invocation behind `DEEP_AGENTS_PROJECT_INTELLIGENCE_RUNTIME=deep_agents`.
- Fed the runtime only pre-collected source coverage/evidence, not broad DB tools.
- Added `deepagents_runtime` success/failure traces.
- Runtime failure falls back to the contract response instead of returning a generic error.
- Added an installed-graph regression test that clears the backend test harness's old `langchain` stub, imports real `deepagents`, and proves `create_deep_agent` can synthesize through the backend contract using a tool-bindable fake model.

Implemented Slice 3B as a feature-gated AI SDK bridge:

- Added `frontend/src/lib/ai/deep-agent-project-status.ts` as the server-side typed client for `POST /api/intelligence/deep-agent/project-status`.
- Kept the bridge behind `AI_ASSISTANT_DEEP_AGENT_BRIDGE_ENABLED=true` and limited it to selected-project `target_briefing`, `latest_status`, and `risk_review` intents.
- Injected the backend packet as additive AI SDK system context instead of replacing the chat stream.
- Rendered backend evidence through the existing `source_evidence_drawer` assistant widget type.
- Recorded success/failure in `toolTrace`; failures are visible warning statuses and then fall back to current packet/tools.
- Verified the bridge against a local backend: project 43 returned a typed packet with checked packet/Teams/email/financial/schedule sources and 10 evidence rows.
- Hardened backend project lookup so Supabase/schema-cache failures return a structured low-confidence packet with failed `project_lookup` trace instead of a generic 500.
- Verified installed Deep Agents runtime handoff behavior: when direct OpenAI quota fails, `deepagents_runtime` is recorded as failed and the endpoint still returns the contract packet.
- Routed runtime model creation through AI Gateway when `AI_GATEWAY_API_KEY` is present, with direct OpenAI retained only as a fallback.
- Verified local Deep Agents runtime against AI Gateway: project 43 returned `mode=deep_agents`, nine source categories, 11 evidence rows, and a successful `deepagents_runtime` trace.
- Added default-off Deep Agents env entries to both Render manifests so production does not accidentally enable the runtime.
- Added `scripts/verify/verify_deep_agents_nonprod_readiness.mjs` and `npm run rag:verify:deep-agents-nonprod` to make the active backend, endpoint state, AI Gateway health, manifest defaults, and stale Render service mapping visible before rollout.

Known ledger issue: local `session-board.md` already has an older S44 row using `AAI-356` for Source Sync drill-in work. The live Linear issue created for this session is also `AAI-356`. This is recorded as a ledger collision risk rather than hidden.

## Exact Next Step

Redeploy or verify the Vercel preview app with `AI_ASSISTANT_DEEP_AGENT_BRIDGE_ENABLED=true`, then run one real selected-project owner-status prompt end to end through `/api/ai-assistant/chat`.

## Known Pitfalls

- Do not replace AI SDK UI or existing AI Elements.
- Do not introduce LangChain/Deep Agents into frontend code.
- Do not let the pilot bypass existing packet-first tables or source-health ledgers.
- Do not call the pilot successful unless missing/stale/failed source categories are explicit in the response.
- Do not treat read-only probes as final answer synthesis; they are coverage inputs for a future orchestrator.
- Do not enable runtime in production until non-production proves model/provider compatibility.
- Do not enable the frontend bridge without a backend URL and `ADMIN_API_KEY`; the bridge intentionally fails loudly into `toolTrace` when backend configuration is missing.
- Resolve or annotate the local AAI-356 session-board collision before broader orchestration cleanup.

## Resume Commands

```bash
sed -n '1,260p' docs/PRPs/deep-agents-project-intelligence/prp-deep-agents-project-intelligence.md
python -m pytest backend/tests/test_deep_project_intelligence.py -q
npm run linear:codex:check -- docs/ops/handoffs/2026-05-13-S45-deep-agents-orchestrator-prp.md
```

## Evidence

- `docs/PRPs/deep-agents-project-intelligence/prp-deep-agents-project-intelligence.md`
- `backend/src/services/agents/deep_project_intelligence.py`
- `backend/src/services/agents/deep_project_intelligence_contracts.py`
- `backend/tests/test_deep_project_intelligence.py`
- `scripts/verify/verify_deep_agents_nonprod_readiness.mjs`
- `render.yaml`
- `backend/render.yaml`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `docs/ai-plan/councils/2026-05-08-rag-strategy-council-durable-assistant-strategy.md`
- LangChain docs reviewed: Deep Agents overview, memory, subagents, permissions, backends.
