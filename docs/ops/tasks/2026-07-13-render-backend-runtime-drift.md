# Render Backend Runtime Drift Repair

Date: 2026-07-13
Linear: Not created - Linear app reauthentication required in this session
Status: Complete

## Objective

Repair the live Render `alleato-backend` service definition after it drifted from the repo's Docker blueprint to a Node runtime that cannot boot the backend, then verify the service can deploy and pass health checks again.

## Scope

- Live Render service `srv-d8271ohj2pic739klb7g` (`alleato-backend`)
- Operational evidence under `docs/ops/handoffs/`
- No unrelated backend code changes

## Done Checklist

- [x] Create task markdown before implementation changes.
- [x] Confirm the exact failed Render deploy, trigger, and runtime error from provider logs.
- [x] Confirm repo source of truth for the backend runtime (`render.yaml` and `backend/Dockerfile`).
- [x] Repair the live Render service definition so it uses the backend Docker runtime contract again.
- [x] Trigger and verify a successful backend deploy after the service-definition repair.
- [x] Verify the live backend health endpoint after the repaired deploy.
- [x] Add a durable verifier that checks the backend runtime contract in `render.yaml` and in live Render state.
- [x] Wire the backend runtime verifier into the existing deployment guardrail path.
- [x] Run targeted verification for the new runtime guardrail.
- [x] Fill evidence section.

## Verification Plan

- `render services --output json | jq ...`
- `render deploys list srv-d8271ohj2pic739klb7g -o json`
- `render logs --resources srv-d8271ohj2pic739klb7g --start ... --end ... -o json`
- `render blueprints validate render.yaml`
- `curl -sS https://alleato-backend-rbnj.onrender.com/health | jq ...`
- `node scripts/verify/verify-render-backend-runtime-contract.mjs`

## Evidence

- Failed deploy `dep-d9a7543eo5us739hkf90` started `2026-07-13T05:07:29Z`, status `update_failed`, trigger `service_updated`, commit `338755e4dd01bc21db5d789f390d2ee6b452e7af`.
- Live Render service drift readback showed `runtime=node`, `buildCommand=pnpm install --frozen-lockfile`, `startCommand=node .lintstagedrc.js`, no health check path, and root directory `backend`.
- Failed deploy log proved the exact boot error: `Error: Cannot find module '/opt/render/project/src/backend/.lintstagedrc.js'`.
- Repo source of truth is still valid: `render blueprints validate render.yaml` returned `valid: true`.
- Backend Dockerfile source of truth is `backend/Dockerfile` with `CMD ["python3", "entrypoint.py"]`, `EXPOSE 8000`, and an internal `/health` probe.
- Pre-repair live backend health still answered `status=healthy`, `ai_provider_path=vercel_gateway`, `ai_gateway_configured=true`, proving the outage is deployability drift rather than the currently serving instance.
- Direct Render API repair updated the live service to `runtime=docker`, `dockerfilePath=./Dockerfile`, `dockerContext=.`, `rootDir=backend`, and `healthCheckPath=/health`.
- Manual deploy `dep-d9a796ss728c73eail4g` started `2026-07-13T05:16:11Z`, reached `live` at `2026-07-13T05:17:11Z`, and used the same target commit `338755e4dd01bc21db5d789f390d2ee6b452e7af`.
- Post-repair `/health` still answered `status=healthy`, `ai_provider_path=vercel_gateway`, `ai_gateway_configured=true`.
- Added `scripts/verify/verify-render-backend-runtime-contract.mjs` to compare the effective backend Docker contract from `render.yaml` against live Render service readback, including runtime, effective docker context, effective dockerfile, health check path, and the absence of Node `buildCommand` / `startCommand`.
- Wired the new verifier into `package.json`, `scripts/predeploy-quality-gate.sh`, and `scripts/postdeploy-verify.sh`.
- `RENDER_API_KEY=... npm run verify:render-backend-runtime` passed against the live repaired service.
- `node scripts/verify/verify-render-backend-runtime-contract.mjs` also passed in no-token mode with a warning-only local fallback, so the guardrail remains runnable in lighter local environments.

## Blockers

- Linear issue creation/commenting is blocked in this session because the Linear app connection requires reauthentication.

## Failure-Loud Guardrail

This task fails if a future Render backend deploy can still route through the Node runtime or boot a non-backend start command instead of the backend Docker entrypoint.
