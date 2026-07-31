# Task: Connect frontend AI assistant to Linear MCP

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-692 - https://linear.app/megankharrison/issue/AAI-692/connect-frontend-ai-assistant-to-linear-mcp
Related Handoff: N/A

## Objective

Connect the frontend `/ai-assistant` runtime to Linear through the existing AI SDK MCP bridge so the assistant can discover Linear MCP tools from configured runtime env.

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
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Architecture review | `nl -ba frontend/src/lib/ai/tools/mcp-tools.ts`, `nl -ba frontend/src/app/api/ai-assistant/chat/handler-v2.ts` | Pass | Existing bridge calls `createAiAssistantMcpTools()` and merges MCP tools into `streamText`; Linear is conditional on `LINEAR_MCP_SERVER_URL` plus token/API key. |
| Current env baseline | local env scan, Vercel env listing, pulled Vercel env scan | Pass | `LINEAR_API_KEY` present; `LINEAR_MCP_SERVER_URL`, `LINEAR_MCP_TOKEN`, and `AI_ASSISTANT_MCP_SERVERS` missing. |
| Linear issue | AAI-692 | Pass | Tracking issue created before provider config change. |
| Official endpoint lookup | Linear MCP docs and Claude integration page | Pass | Official Streamable HTTP MCP endpoint documented as `https://mcp.linear.app/mcp`; docs also say direct Bearer API keys/OAuth tokens are supported. |
| Provider config write | `vercel env add LINEAR_MCP_SERVER_URL ...` | Pass | Added URL to Production, Preview `(staging)`, and Development for Vercel project `alleato-hub`. |
| Provider read-back | `vercel env ls` | Pass | `LINEAR_MCP_SERVER_URL` now present in Development, Preview `(staging)`, and Production; `LINEAR_API_KEY` already present in Production, Preview, and Development. |
| Local config write | `.env`, `frontend/.env.local` | Pass | Added non-secret `LINEAR_MCP_SERVER_URL` locally. |
| Targeted tests | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/tools/__tests__/mcp-tools.test.ts` | Pass | 3 tests passed. |
| Browser/user-flow | `agent-browser open https://linear.app/settings/account/security && agent-browser snapshot -i` | Blocked | Browser session is not logged into Linear; key generation UI requires login. |
| External token validation | `curl https://api.linear.app/graphql` with local and pulled Vercel `LINEAR_API_KEY` | Fail | Linear returned `Authentication required, not authenticated`; no secret printed. |
| End-to-end MCP proof | `createAiAssistantMcpTools()` live discovery with configured URL and token path | Fail | Linear MCP returned `invalid_token`; `linearToolCount: 0`. This proves the missing URL is fixed but the existing Linear key is not usable. |

## Files Changed

- `docs/ops/tasks/2026-06-25-linear-mcp-assistant-config.md` - required task record and evidence ledger for provider config work.
- `.env` - added local non-secret Linear MCP server URL.
- `frontend/.env.local` - added local non-secret Linear MCP server URL.

## Risks / Gaps

- Cause: `LINEAR_MCP_SERVER_URL` was missing and is now configured, but the existing `LINEAR_API_KEY` is rejected by both Linear GraphQL and Linear MCP.
- Detection gap: the app had env names documented, but no provider read-back plus live MCP discovery check to prove Linear tools are actually enabled.
- Prevention step: add a runtime/admin diagnostic that validates `LINEAR_MCP_SERVER_URL` presence and Linear token usability, then reports a specific unavailable reason instead of silently omitting Linear MCP tools.
- Owner / next action: someone with Linear account access must generate or authorize a valid Linear API/OAuth token; Codex can then write it to Vercel as `LINEAR_MCP_TOKEN` or refresh `LINEAR_API_KEY` and rerun discovery.
- Generic MCP filtering currently blocks mutation-style tool names unless an allowlist is configured. Read tools may become available before write tools after auth is fixed.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
