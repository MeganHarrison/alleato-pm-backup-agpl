---
name: deep-agents-backend-module
description: "Use when wiring Deep Agents example folders or installed skills into an Alleato FastAPI backend module and route."
---

# Deep Agents Backend Module

## Purpose

Turn a Deep Agents example, skill folder, or prototype into a production-shaped Alleato backend module without mixing it into unrelated agents.

## Required Shape

Create a dedicated package under:

```text
backend/src/services/agents/<agent_name>/
```

The package must include:

- `contracts.py` for Pydantic request/response models with camelCase aliases.
- `tools.py` for runtime tools and explicit failure messages.
- `agent.py` for `create_deep_agent()` construction and invocation.
- `__init__.py` exporting only the public entrypoints.
- Backend route in `backend/src/api/main.py`.
- Focused tests in `backend/tests/test_<agent_name>.py`.

## Wiring Checklist

1. Read the source example or skill folder and identify the required tools, subagents, backend, skills, and model assumptions.
2. Keep the new runtime isolated from existing agents unless the user explicitly asks to merge them.
3. Use `create_deep_agent()` from `deepagents`; do not reimplement planning, file context, or delegation middleware.
4. Use `FilesystemBackend(..., virtual_mode=True)` when enabling skills or file-context behavior.
5. Load skill directories only if they exist in the deployed runtime. Missing local skill folders must not crash the endpoint.
6. Use the existing backend model convention when available: AI Gateway first, direct OpenAI fallback.
7. Feature-gate the route with a named env var and add the same env var to Render YAML.
8. If a capability is missing, return a typed error or explicit answer detail. Never return a blank answer or generic failure.
9. Add tests for contract validation, feature gating, successful agent construction, and fail-loud behavior.
10. Update architecture docs with the route, module, env vars, tool surface, and known deployment caveats.

## Failure-Loud Requirements

Every Deep Agents backend module must make these states visible:

- Provider/API key missing.
- External tool key missing.
- Tool HTTP request failed.
- Deep Agents runtime import or invocation failed.
- Agent returned an empty response.
- Feature flag disabled.
- Required source unavailable or stale.

The response should explain the failed capability, what evidence is missing, and what still ran.

## Render Checklist

For each production route, update the single canonical Render blueprint:

- `render.yaml` (root — the only render.yaml; `backend/render.yaml` was removed)

Add:

- Feature flag, defaulting to the intended deployment state.
- Model env var.
- Any external API keys with `sync: false`.

## Verification

Run at minimum:

```bash
cd backend && python -m py_compile src/services/agents/<agent_name>/*.py
cd backend && python -m pytest tests/test_<agent_name>.py -q
```

If the route will be used by the frontend immediately, also run a local backend request or browser/user-flow check against the calling page.
