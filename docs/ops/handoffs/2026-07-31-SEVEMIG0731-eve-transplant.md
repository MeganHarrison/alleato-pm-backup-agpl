# Handoff: AAI-1306 Eve transplant

Status: Complete
Session: SEVEMIG0731
Task ID: AAI-1306
Task file: docs/ops/tasks/2026-07-31-aai-1306-eve-transplant.md
Verification manifest: docs/ops/verification/2026-07-31-aai-1306-verification-manifest.json
Verification result: docs/ops/verification/2026-07-31-aai-1306-verification-result.json
Workspace: `C:\Users\KimiClaw\.codex\isolated-workspaces\sevemig0731-aai-1306-a8248a`
Branch: `codex/sevemig0731-aai-1306-a8248a`
Base commit: `2f2510ccdd9a96f4ec6c212473e1094e60aaee92`

## Acceptance Contract

Transplant the proven assistant as one product slice. Preserve the current production monorepo, `/ai` entry point, authentication, project scope, and shared product services. Include all applicable AI Tools Verification product deltas. Do not deploy, delete the legacy assistant, switch domains, or rebuild unrelated systems in this ticket.

## Source Snapshots

- Canonical backup source: `C:\Users\KimiClaw\alleato-pm-backup`
- Initial source HEAD: `557d86733` (`Finish Eve runtime migration and verification`)
- Governed catalog workspace: `C:\Users\KimiClaw\.codex\isolated-workspaces\s20260731-eve-write-catalog-aai-1265-writes-8312a5`, commit `91dbde90b`
- Live verifier workspace: `C:\Users\KimiClaw\.codex\isolated-workspaces\s20260731-eve-write-verifier-aai-1265-2f70d5`
- AI Tools Verification task: `019f94ad-f9c7-7230-9a9a-0a59e229869b`, active at kickoff

## Superseded Work Excluded

- Standalone Eve app workspace `eve-integration-20260731`
- PM navigation/domain cutover commit `9b64a05`
- Legacy deletion commit `2b025338` and migration `20260801001000_drop_legacy_assistant_tables.sql`
- Generated `node_modules`, `.eve`, `.workflow-data`, local logs, browser profiles, credentials, and temporary evidence

## External State to Preserve

The superseded task reported that it created an `eve_chat` production migration and connected Upstash to the separate Eve project. It also confirmed legacy assistant data remained. This ticket makes no destructive change to any of that external state.

## Migration Manifest

Complete at `docs/ops/verification/2026-07-31-aai-1306-migration-manifest.md`. It classifies committed source state, the governed catalog workspace, the live verifier workspace, the source dirty files, already-present production files, and every exclusion.

## Verification

- Pass: 42 Eve agent auth/tool tests.
- Pass: Eve agent TypeScript.
- Pass: 101 focused frontend tests covering the assistant UI, Ask Alleato, canonical registry, authenticated proxy, continuation/cancellation, durable turns, approvals, receipts, and idempotency.
- Pass: `npm run verify:eve-only-runtime` in transplant mode.
- Pass: `git diff --check`.
- Explicit defer: one legacy deletion assertion is a named AAI-1307 todo.
- Unrelated infrastructure failure: whole-frontend TypeScript exhausted the existing 4 GB Node heap before producing any source diagnostic. The active Vercel OOM task owns that repository boundary.
- Pass: authenticated project read in the existing `/ai` product shell.
- Pass: approved RFI write persisted a terminal receipt and produced exactly one row.
- Pass: denied RFI write persisted `output-denied` and produced zero rows.
- Pass: the signed bridge rejects a project ID that differs from the selected project before tool execution.
- Pass: final source task delta contains no completed product change left to migrate.

## Production Runtime Configuration

- The linked production frontend is Vercel project `project-management-agent`, root `frontend`, production alias `https://projects.alleatogroup.com`.
- The linked Eve runtime is Vercel project `eve-chat-template`.
- A single generated server-only `ALLEATO_EVE_PROXY_SECRET` is configured in both Production environments. Its value was never printed.
- `ALLEATO_APP_URL=https://projects.alleatogroup.com` is configured for the Eve Production environment.
- Eve production is Ready at `https://eve-chat-template-the-alleato-group.vercel.app`.
- Eve project SSO protection was disabled because it redirected server-to-server traffic to Vercel login. The Eve session endpoint remains protected by the proxy secret and Supabase user token.
- `/eve/v1/health` returns 200. A direct unauthenticated `POST /eve/v1/session` returns 403.
- `ALLEATO_EVE_URL` is configured on the production frontend and its environment readback also confirms the shared proxy-secret name.

## Review

Pull request 235 merged as `c0876cd04c34116a0933ff3918d5ff0ac586d92b`. Claude and Autofix independently reviewed final HEAD and found no blocking issue. Quality Gate, Guardrail PR Check, Design System Guardrails, the Vercel production build, and an authenticated production `/ai` tool read passed. Deployment `dpl_GgSrNw5VNdaSkNkPDN6yiMeYcDmj` is Ready at `https://projects.alleatogroup.com`.
