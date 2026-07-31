# Task: Make the workstation production-capable by default

Status: Complete
Owner: Codex S20260730-MACHINE
Created: 2026-07-30
Task ID: AAI-1281-MACHINE-READINESS
Related Handoff: `docs/ops/handoffs/2026-07-30-S20260730-MACHINE-machine-readiness.md`

Delivery lane: High-risk

## Objective

Stop repeated provider and deployment failures caused by credentials being
present in one checkout or shell but unavailable or stale everywhere else.

## Acceptance Contract

- [x] Every new PowerShell session loads one ACL-restricted machine environment.
- [x] Full readiness validates Supabase, Vercel, GitHub push access, Render
  service access, AI Gateway, OpenAI, Linear, and the browser.
- [x] Backend, agent, and Render workspaces require full readiness before the
  worktree is created.
- [x] Locally recoverable valid credentials replace stale machine values without
  printing or committing secrets.
- [x] Provider updates use individual Vercel/Render operations and authenticated
  readback where the provider permits it.
- [x] Focused regression tests pass.
- [x] Independent review approves the implementation.
- [x] Task-owned files are published to canonical `origin/main`.

## Root Cause and Prevention

- Cause: the old `full` profile checked only Supabase, Vercel, and browser
  presence. Render, GitHub, AI providers, and integrations were invisible.
- Detection gap: credential files were treated as capability proof even when
  AI Gateway and Linear returned HTTP 401.
- Prevention: authenticated remote checks, credential-fingerprinted caching,
  bounded network timeouts, automatic shell loading, and full-profile inference
  for runtime work.
- Failure fingerprint: `operations.provider-runtime-drift`

## Evidence

| Boundary | Evidence | Result |
| --- | --- | --- |
| Machine readiness | `npm run machine:ready` | Pass: AI, browser, database, GitHub, integrations, Render, and Vercel |
| Regression | `node --test scripts/ops/__tests__/machine-capabilities.test.mjs scripts/ops/__tests__/isolated-session-workspace.test.mjs` | 20 passed |
| Shell startup | PowerShell parser plus new-shell environment readback | Pass |
| Secret ACL | Windows ACL readback | Protected; one explicit current-user entry |
| Profile idempotence | Repeated bootstrap plus marker count | Pass; one loader block after repeated runs |
| Render credential | `/v1/owners`, `/v1/services`, and `alleato-backend` visibility | Pass |
| Render OpenAI | Individual env-var update plus OpenAI `/v1/models` readback | HTTP 200 |
| Vercel provider env | Individual sensitive env overrides for production | Accepted for AI Gateway, OpenAI, and Linear |

## Known Non-Blocking Admin Gaps

- No locally recoverable Sentry organization auth token.
- No locally recoverable PostHog personal/admin API key.

The application DSN/client configuration remains available. These admin tokens
are not required for routine development, deployment, RAG, database, or
assistant work, so they are reported separately rather than making the normal
workstation baseline unusable.

## Final Status

- [x] Independent review recorded at `C:\Users\KimiClaw\AppData\Local\Temp\AAI-1281-machine-independent-review.md`.
- [x] Publication performed through the required `codex:finish` flow.
