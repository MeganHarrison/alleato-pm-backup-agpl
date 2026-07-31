# Task: Fix Outlook specialist provider routing

Status: In Progress
Owner: Codex
Created: 2026-07-17
Task ID: Local blocker: Linear connector unavailable in this session
Linear Issue: Unavailable — no callable Linear connector/tool is exposed in the current session; verified by available-tool search.
Related Handoff: `docs/ops/handoffs/2026-07-17-S<session>-fix-outlook-specialist-provider.md`

## Objective

Make the Microsoft Executive Assistant use the configured AI Gateway when the
direct OpenAI provider is unavailable or quota-limited, while preserving a
specific failure when neither provider is configured.

## Scope

- `backend/src/services/agents/microsoft_executive_assistant/agent.py`
- `backend/src/services/agents/runtime_common.py`
- Focused Microsoft Executive Assistant tests
- Explicitly excludes Outlook Graph credentials and mailbox mutations

## Source of Truth

- Canonical runtime: `backend/src/services/agents/microsoft_executive_assistant/agent.py`
- Provider routing: `backend/src/services/ai_transport.py`
- Live mailbox read: `backend/src/services/integrations/microsoft_graph/live_mail.py`
- Deprecated/parallel path: direct-only `ChatOpenAI` construction in `runtime_common.py`

Verification contract: Required

## Acceptance Criteria

- [x] Specialist selects the configured AI Gateway when available.
- [x] Specialist still supports direct OpenAI when explicitly configured.
- [x] Missing provider credentials fail loudly with an actionable error.
- [x] Live Outlook tool remains the source of truth for mailbox reads.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared provider abstraction owns routing.
- [x] Errors are specific and actionable.
- [x] Provider configuration contract is handled.

## Integration and Verification

- [x] Targeted provider-routing and syntax checks pass.
- [ ] Live-system provider credit/read-back proves the configured provider can make model calls.
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: provider path and provider credential failure detail.
- Detection path: Microsoft specialist tool trace and AI provider health endpoint.
- Recovery path: use configured gateway or repair the named provider credential/quota.

## Incident Learning

- Failure fingerprint: `microsoft-executive-assistant-direct-provider-quota`
- Root cause: specialist runtime forced direct OpenAI model construction even though the repository's canonical AI transport prefers the configured gateway.
- Detection gap: provider routing was not shared by Deep Agents runtimes.
- Prevention: Deep Agents runtimes must resolve models through shared provider routing.
- Guardrail evidence: focused provider-routing tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope captured before implementation. |
| Provider routing | Focused Python harness | Pass | Gateway selected with `openai/gpt-5.5` and canonical gateway base URL. |
| Syntax/diff | `python3 -m py_compile ...`; `git diff --check` | Pass | Changed Python files compile and diff is clean. |
| Existing assistant suite | `backend/.venv/bin/pytest -q backend/tests/test_microsoft_executive_assistant.py -x` | Fail, unrelated drift | Existing deterministic formatting assertion fails before provider behavior; full suite also has pre-existing assistant expectation failures. |
| Production health | `curl https://alleato-backend-rbnj.onrender.com/health` | Pass | Render reports `ai_provider_path=vercel_gateway`, gateway configured and required. |
| Gateway credits | `GET https://ai-gateway.vercel.sh/v1/credits` using local configured credential | Blocked | Provider returned HTTP 401; credential is invalid/stale or not authorized. |

## Remaining Risk

- Render reports the gateway key is configured, but the available local credential received HTTP 401 from the gateway credits endpoint. Production model-call proof remains deferred until the gateway credential is repaired.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred live provider proof records the HTTP 401 cause, missing preflight detection, provider-health prevention, and deployment/provider-config owner.
