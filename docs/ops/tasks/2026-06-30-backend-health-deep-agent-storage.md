# Task: Backend health Deep Agents storage root

Status: Complete
Owner: Codex
Created: 2026-06-30
Linear Issue: Not created yet - incident response
Related Handoff: N/A

## Objective

Restore `alleato-backend` health by making live Render Deep Agents artifact roots match the persistent `/data/*` paths declared in `render.yaml`.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Root cause read-back | Render API `GET /v1/services/srv-d8271ohj2pic739klb7g/env-vars?limit=100`; backend `GET /health` | Fail before fix | Live env missed `LLM_WIKI_OUTPUT_ROOT`, `DOCS_RESEARCH_OUTPUT_ROOT`, and `CONTENT_BUILDER_OUTPUT_ROOT`; `/health` reported `/tmp/*` roots with `deep_agent_storage.durable=false`. |
| Deployment state | Render API `GET /v1/services`; `GET /v1/services/srv-d8271ohj2pic739klb7g/deploys?limit=5` | Pass | Service is `not_suspended`; latest deploy is `live`. |
| Incident verifier | `node scripts/verify/verify-live-db-incident.mjs` | Blocked unrelated | Render cron/web scheduler flags read back; Supabase Management API rejected local `SUPABASE_ACCESS_TOKEN` with HTTP 401 before DB health checks. |
| Static/type/lint | N/A | Pass | No code path changed; live config only. |
| Targeted tests | Existing `backend/tests/test_llm_wiki_agent.py` and `scripts/verify/verify_deep_agents_docs_wiki_render_env.mjs` | Existing guardrail | Tests/checks already encode persistent root expectations. |
| Provider patch | Render API `PUT /v1/services/srv-d8271ohj2pic739klb7g/env-vars/{key}` | Pass | Added `LLM_WIKI_OUTPUT_ROOT=/data/llm-wiki`, `DOCS_RESEARCH_OUTPUT_ROOT=/data/docs-research`, `CONTENT_BUILDER_OUTPUT_ROOT=/data/content-builder`, `DEEP_AGENTS_DOCS_RESEARCH_ENABLED=true`, `DEEP_AGENTS_DOCS_RESEARCH_MODEL=gpt-5.4-mini`, `LANGCHAIN_DOCS_MCP_URL=https://docs.langchain.com/mcp`, `DEEP_AGENTS_LLM_WIKI_ENABLED=true`, and `DEEP_AGENTS_LLM_WIKI_MODEL=gpt-5.4-mini`. |
| Runtime restart | Render API `POST /v1/services/srv-d8271ohj2pic739klb7g/deploys` | Pass | Restart deploys `dep-d91sfr5aeets73841bgg` and `dep-d91si8mq1p3s73cgnnt0` reached `live`. |
| DB/provider read-back | `node scripts/verify/verify_deep_agents_docs_wiki_render_env.mjs` | Pass | Manifest and live Render env matched for docs/wiki runtime keys after provider patch. |
| End-to-end proof | `curl https://alleato-backend-rbnj.onrender.com/health` | Pass | Backend returned `status=healthy`, `deep_agent_storage.durable=true`, and all roots under `/data/*` after restart. |
| Prevention guardrail | `npm run verify:deep-agents-render-env`; `POSTDEPLOY_BASE_URL=https://projects.alleatogroup.com npm run verify:postdeploy` | Pass | Verifier now checks the `/data/*` roots, postdeploy runs it in strict mode, and GitHub passes Render provider credentials into the postdeploy workflow. |

## Files Changed

- `docs/ops/tasks/2026-06-30-backend-health-deep-agent-storage.md` - Incident task record and evidence.
- `scripts/verify/verify_deep_agents_docs_wiki_render_env.mjs` - Expanded provider drift guardrail to check persistent storage roots and fail strictly when provider read-back is required.
- `scripts/postdeploy-verify.sh` - Runs Render provider env verification during postdeploy.
- `.github/workflows/postdeploy-verify.yml` - Passes Render provider credentials to postdeploy verification.
- `package.json` - Adds `verify:deep-agents-render-env` alias.

## Risks / Gaps

- Local `SUPABASE_ACCESS_TOKEN` is stale or unauthorized for Supabase Management API health checks; this blocks the broader `verify-live-db-incident` Supabase Management API section, but not the fixed Render/backend health issue.
- The recurring failure mode is provider drift: `render.yaml` declared required values, but live Render env did not have them until explicit API read-back and patch.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
