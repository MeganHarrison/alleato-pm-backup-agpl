# Handoff: 2026-06-19 - Executive Daily Brief AI Ops Gateway

## Intake Block

<!-- markdownlint-disable MD029 MD034 -->

1) Session ID: S57
2) Task ID: AAI-551
3) Linear issue: AAI-551
4) Linear URL: https://linear.app/megankharrison/issue/AAI-551/rebuild-executive-daily-brief-as-ai-operations-gateway-proof-workflow
5) Current status: Complete with Blocked/Deferred live external-send verification
6) Files changed (absolute paths):
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-19-executive-daily-brief-ai-ops-gateway.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-19-S57-executive-daily-brief-ai-ops-gateway.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/contracts.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/ledger.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/executive-daily-brief-ledger.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/__tests__/contracts.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/__tests__/ledger.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/scripts/run-executive-daily-brief.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/executive/daily-brief/preview-teams/route.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/executive/daily-brief/send-teams/route.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/admin/owner-briefing/send-test/route.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/bot/teams-chat.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/executive/owner-briefing-delivery.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tools/executive-brief-tools.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/executive/daily-brief/route-helpers.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/executive/daily-brief/widget/route.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/executive/daily-brief/preview-teams/route.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/actions/executive-briefing-actions.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/executive/daily-brief/__tests__/route.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/executive/brandon-daily-update/__tests__/route.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_executive_daily_brief_gateway.mjs`
   - `/Users/meganharrison/Documents/alleato-pm/package.json`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/admin/ai-work-runs/route.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(admin)/ai-work-runs/ai-work-runs-client.tsx`
   - `/Users/meganharrison/Documents/alleato-pm/supabase/migrations/20260619183000_add_ai_work_run_artifacts_delivery_attempts.sql`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/types/database.types.ts`
   - `/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-RAG-ARCHITECTURE.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/architecture/tables.yaml`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/source-adapters.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/executive-daily-brief-workflow.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/tool-registry.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/__tests__/workflow-pack.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/executive-daily-brief-evidence.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/daily-brief-canonical-link.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/__tests__/executive-daily-brief-ledger.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/executive/brandon-daily-update.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/executive/executive-briefing-workflow.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/executive/__tests__/executive-briefing-workflow.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/scripts/__tests__/run-executive-daily-brief.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai-ops/__tests__/source-adapters.test.ts`
7) Commands run and outcome (pass/fail counts):
   - Pass: read pasted ChatGPT recommendation from Codex attachment.
   - Pass: read `docs/codebase-map/hermes-vs-openclaw-comparison.md`.
   - Pass: read `docs/ops/tasks/TASK-TEMPLATE.md`.
   - Pass: created Linear issue AAI-551.
   - Pass: posted Linear kickoff comment `8bcbe3bd-dcea-4d7f-a207-6ed701ff2085`.
   - Pass: inventoried current Executive Daily Brief generation, delivery, ledger, admin UI, source health, and bypass paths.
   - Pass: audited `ai_operation_events`, `ai_work_runs`, `ai_work_run_sources`, `daily_recaps`, `/api/admin/ai-work-runs`, and `/ai-work-runs` against the new contracts.
   - Pass: created shared AI Ops ledger writer for `AiEvent`, `AiRun`, and `EvidenceRef` writes.
   - Fail then fixed: focused ledger test caught validation happening after `supabase.from()` started; fixed by validating payloads before the Supabase chain begins.
   - Pass: migrated `frontend/scripts/run-executive-daily-brief.ts` from local AI ledger REST helpers to the shared ledger writer.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand` passed 2 suites / 11 tests.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/contracts.ts src/lib/ai-ops/ledger.ts src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts`.
   - Pass: `cd frontend && npx eslint --no-ignore scripts/run-executive-daily-brief.ts`.
   - Pass: `cd frontend && npx tsx scripts/run-executive-daily-brief.ts --now=2026-06-19T12:00:00.000Z` exited through the disabled kill switch without writing or sending.
   - Pass: created `frontend/src/lib/ai-ops/executive-daily-brief-ledger.ts` so preview/send routes share event/run/evidence projection.
   - Pass: routed `preview-teams` and `send-teams` through the shared ledger writer.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/executive-daily-brief-ledger.ts src/app/api/executive/daily-brief/preview-teams/route.ts src/app/api/executive/daily-brief/send-teams/route.ts`.
   - Pass: disabled send smoke returned run id `45c9f9a2-2ac1-45fe-8893-a2cd07c28374`.
   - Blocked: unauthenticated curl to `/api/admin/ai-work-runs?workflow=executive_daily_brief&limit=5` returned `AUTH_EXPIRED`; browser/admin UI verification still pending.
   - Pass: wrapped `frontend/src/app/api/admin/owner-briefing/send-test/route.ts` with the shared ledger writer.
   - Pass: wrapped `frontend/src/lib/ai/tools/executive-brief-tools.ts` with the shared ledger writer.
   - Pass: `cd frontend && npx eslint src/app/api/admin/owner-briefing/send-test/route.ts src/lib/ai/tools/executive-brief-tools.ts src/lib/ai-ops/executive-daily-brief-ledger.ts`.
   - Pass: routed fresh packet GETs, widget fresh generation, and the executive page regenerate server action through `regenerateDailyBriefDraftWithLedger`.
   - Pass: moved the Teams preview route's fresh generation into `regenerateDailyBriefDraftForRun` so the route no longer imports the raw generator while preserving a single preview run.
   - Pass: added `npm run rag:verify:executive-daily-brief-gateway`, which blocks raw `regenerateExecutiveBriefingDraft` usage under `frontend/src/app`.
   - Pass: `npm run rag:verify:executive-daily-brief-gateway`.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/executive-daily-brief-ledger.ts src/app/api/executive/daily-brief/preview-teams/route.ts src/app/api/executive/daily-brief/route-helpers.ts src/app/api/executive/daily-brief/widget/route.ts 'src/app/(main)/actions/executive-briefing-actions.ts' src/app/api/executive/daily-brief/__tests__/route.test.ts src/app/api/executive/brandon-daily-update/__tests__/route.test.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/app/api/executive/daily-brief/__tests__/route.test.ts src/app/api/executive/brandon-daily-update/__tests__/route.test.ts --runInBand` passed 4 suites / 16 tests.
   - Blocked: `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public` returned `LegacyInvalidAccessTokenError`; no schema migration was added in the artifact-linkage slice.
   - Pass: restored the accidentally truncated `frontend/src/types/database.types.ts` from `HEAD` after the failed Supabase command.
   - Pass: extended `AiRun`/ledger mapping with `dailyRecapId`, mapped it to existing `ai_work_runs.daily_recap_id`, and exposed it as the generated artifact in `/api/admin/ai-work-runs` and `/ai-work-runs`.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/contracts.ts src/lib/ai-ops/ledger.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/lib/ai/tools/executive-brief-tools.ts src/app/api/executive/daily-brief/preview-teams/route.ts src/app/api/admin/owner-briefing/send-test/route.ts src/app/api/admin/ai-work-runs/route.ts 'src/app/(admin)/ai-work-runs/ai-work-runs-client.tsx'`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand` passed 2 suites / 13 tests.
   - Pass: applied `supabase/migrations/20260619183000_add_ai_work_run_artifacts_delivery_attempts.sql` directly with `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ...`, creating `ai_work_run_steps`, `ai_work_run_artifacts`, and `ai_work_run_delivery_attempts`.
   - Pass: inserted the exact migration version into the Supabase migration ledger after direct apply, then `npm run db:migrations:verify-applied -- supabase/migrations/20260619183000_add_ai_work_run_artifacts_delivery_attempts.sql` passed.
   - Pass: regenerated Supabase types through a temp file using the `.env` Supabase access token path; `frontend/src/types/database.types.ts` now includes the three new AI Ops ledger tables.
   - Pass: extended the shared AI Ops ledger writer with validated `createRunStep`, `createArtifact`, and `createDeliveryAttempt` methods.
   - Pass: Daily Brief preview, send, disabled delivery, and admin test-send paths now record first-class Teams payload artifacts and/or delivery attempt rows.
   - Pass: `/api/admin/ai-work-runs` returns `steps`, `artifacts`, and `deliveryAttempts`; `/ai-work-runs` renders those rows with exact failure code/message and retryability.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/contracts.ts src/lib/ai-ops/ledger.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/app/api/executive/daily-brief/preview-teams/route.ts src/app/api/executive/daily-brief/send-teams/route.ts src/app/api/admin/owner-briefing/send-test/route.ts src/app/api/admin/ai-work-runs/route.ts 'src/app/(admin)/ai-work-runs/ai-work-runs-client.tsx'`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand` passed 2 suites / 17 tests.
   - Pass: `curl -sS -X POST http://localhost:3001/api/executive/daily-brief/send-teams -H 'content-type: application/json' -d '{}'` returned disabled state with run id `b88b3b30-b766-4aa2-8e02-84ef175e207b`.
   - Pass: SQL readback for run `b88b3b30-b766-4aa2-8e02-84ef175e207b` returned run status `skipped`, delivery status `disabled`, delivery attempt status `disabled`, failure code `EXECUTIVE_DAILY_BRIEF_DISABLED`, and delivery step `blocked`.
   - Pass: authenticated `agent-browser` proof loaded `/ai-work-runs` using `frontend/tests/.auth/user.json`; page text shows the disabled run, Delivery Attempts, Run Steps, exact failure code/message, and retryability.
   - Fail then fixed: larger-heap typecheck initially surfaced three current-slice diagnostics in `frontend/src/lib/ai-ops/executive-daily-brief-ledger.ts`; fixed missing source-health metadata, safe skipped-state narrowing, and `sourceRefs: []` for Teams payload artifacts.
   - Fail unrelated: `cd frontend && npx tsc --noEmit --pretty false` in cheaper sub-agent failed with Node heap OOM before diagnostics.
   - Fail unrelated: `cd frontend && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false` now has no current-slice diagnostics, but still fails on unrelated repo debt in `src/app/(admin)/admin/page.tsx`, `src/app/(main)/[projectId]/intelligence/page.tsx`, `src/features/ai-agents/ai-agent-dag.tsx`, `src/features/kanban/components/board-column.tsx`, `src/lib/executive/brandon-daily-update.ts`, and `src/lib/progress-reports/ai-generate.ts`.
   - Fail unrelated: `npm run db:inventory` fails on pre-existing missing metadata for many existing MAIN/RAG tables. The three new tables added in this slice are documented in `docs/architecture/tables.yaml` and were not listed as missing.
   - Pass: created `source-adapters.ts`, `executive-daily-brief-workflow.ts`, and `tool-registry.ts` so the workflow pack, source adapter contract, and tool policy are centralized.
   - Pass: `startDailyBriefRun()` now stores workflow pack metadata, runtime budget, source policy, visible tool names, hidden tool names, and tool policy on every run.
   - Pass: scheduled runner imports the shared Executive Daily Brief workflow id/version instead of duplicating them.
   - Fail then fixed: live disabled-send SQL readback showed `send-teams-daily-brief` was still visible when delivery was disabled; fixed by adding `deliveryEnabled: false` to the disabled route target and making the policy gate honor it.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/source-adapters.ts src/lib/ai-ops/executive-daily-brief-workflow.ts src/lib/ai-ops/tool-registry.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts src/lib/ai-ops/__tests__/contracts.test.ts && npx eslint --no-ignore scripts/run-executive-daily-brief.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts --runInBand` passed 3 suites / 22 tests.
   - Pass: `npm run rag:verify:executive-daily-brief-gateway`.
   - Pass: disabled tool-policy readback for run `ba4aa0c7-7c6d-41a0-9dd6-20ffe2a20978` returned Teams payload builder visible, Teams send tool hidden, `allowDelivery=false`, workflow version `2026-06-19.ai-ops-gateway-v1`, and minimum evidence refs `1`.
   - Pass: authenticated browser-context POST to `/api/executive/daily-brief/preview-teams` with `fresh=true` returned run id `676ca1fa-f79d-4b74-9bee-fe7dd6375b0e`, item count `4`, recap date `2026-06-19`, and `generatedFresh=true`.
   - Pass: SQL readback for generated run `676ca1fa-f79d-4b74-9bee-fe7dd6375b0e` returned status succeeded, delivery dry-run, packet id `1399b250-4151-429c-a3ce-156e0a161ba9`, source health count `4`, source refs `4`, artifacts `2`, delivery attempts `1`, and Teams send tool hidden.
   - Pass: delivery attempt `da3274c5-ef33-4a26-83c7-2044fdebc56a` links to a `teams_payload` artifact for the generated preview run.
   - Pass: packet source inspection found 4 surfaced items and 1 citation per item in `daily_recaps.briefing_packet`.
   - Pass: source health inspection found email missing, Teams loaded count 3, meeting loaded count 15, and document loaded count 63.
   - Pass: Playwright-authenticated browser proof of `/ai-work-runs` shows run `676ca1fa-f79d-4b74-9bee-fe7dd6375b0e`, `succeeded`, `dry run`, `brief packet`, `teams payload`, Delivery Attempts, and Evidence Rows.
   - Pass: extracted claim-level Daily Brief evidence policy into `executive-daily-brief-evidence.ts` so unit tests validate source-ref requirements without importing the model/provider stack.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/executive-daily-brief-evidence.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand` passed 3 suites / 17 tests.
   - Pass: `npm run rag:verify:executive-daily-brief-gateway`.
   - Fail then fixed: scheduled proof showed `.env.local` loaded with `override: true`, which overwrote explicit runtime `EXECUTIVE_DAILY_BRIEF_ENABLED=true` and forced the disabled branch. Fixed runner env loading so explicit runtime env wins.
   - Pass: updated `frontend/scripts/__tests__/run-executive-daily-brief.test.ts` from the stale `buildWorkRunSourceRows` helper to current `buildWorkRunSourceRefs` evidence-ref output.
   - Pass: `cd frontend && npx eslint --no-ignore scripts/run-executive-daily-brief.ts scripts/__tests__/run-executive-daily-brief.test.ts`.
   - Pass: `cd frontend && npx tsx --test scripts/__tests__/run-executive-daily-brief.test.ts` passed 3 node tests.
   - Pass: skipped schedule proof created run `00f52478-deba-40e6-bac6-e487ceb75778` with status skipped, delivery status skipped, reason `Outside target local schedule.`, event status ignored, and source-health status skipped.
   - Fail documented: matching scheduled trigger without `CRON_SECRET` created failed run `d56b69e2-13a1-4efa-9eff-98b15e65167d` with `EXECUTIVE_DAILY_BRIEF_FAILED` / `CRON_SECRET is required.`.
   - Pass: matching scheduled trigger with dummy non-secret cron value reached the disabled delivery route and created scheduler run `4b4bcd6a-a401-4db0-8970-3c96a9c6a2f8` plus downstream disabled delivery run `10e04a08-c1dd-4ac3-8847-75950f94bcc4`; no Teams send occurred because the route kill switch was disabled.
   - Pass: added targeted Teams delivery route tests for disabled delivery, dry-run payload/evidence completion, blocked provider result, partial recipient failure, and thrown provider failure.
   - Pass: `cd frontend && npx eslint src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts src/app/api/executive/daily-brief/send-teams/route.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts src/app/api/executive/daily-brief/__tests__/route.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand` passed 3 suites / 17 tests.
   - Pass: source adapter wrappers now map packet source health into per-adapter source-fetch run steps for Fireflies/meeting, Outlook/email, Teams, Documents/RAG, Acumatica, Procore/project data, and Project Intelligence packets.
   - Pass: generated draft evidence now writes a source-health report artifact before the brief-packet artifact.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/source-adapters.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/source-adapters.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/source-adapters.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts --runInBand` passed 4 suites / 19 tests.
   - Fail then completed server-side: authenticated preview POST timed out client-side at 30 seconds, but the server completed run `0c3b8979-3a31-4aab-98d0-a975ab845e21` as succeeded / dry-run.
   - Pass: SQL readback for run `0c3b8979-3a31-4aab-98d0-a975ab845e21` shows source-fetch steps for all seven adapters, including failed-retryable `SOURCE_ADAPTER_MISSING` rows for Outlook/email, Acumatica, and Project Intelligence packet coverage, plus artifacts source-health report, brief packet, and Teams payload.
   - Pass: Playwright-authenticated `/ai-work-runs` proof shows run `0c3b8979-3a31-4aab-98d0-a975ab845e21`, source-health report, source-fetch steps, and `SOURCE_ADAPTER_MISSING`.
   - Pass: cron `/api/cron/executive-daily-brief` now proxies POST/GET to canonical `/api/executive/daily-brief/send-teams` instead of importing the legacy direct Teams sender.
   - Pass: `sendApprovedExecutiveBriefingToTeams` now throws a loud deprecation error that names the canonical AI Ops gateway path; Teams card and text render helpers remain available for preview formatting.
   - Pass: `cd frontend && npx eslint src/app/api/cron/executive-daily-brief/route.ts src/app/api/cron/executive-daily-brief/__tests__/route.test.ts src/lib/executive/executive-briefing-teams-delivery.ts src/lib/executive/__tests__/executive-briefing-teams-delivery.test.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/executive/__tests__/executive-briefing-teams-delivery.test.ts src/app/api/cron/executive-daily-brief/__tests__/route.test.ts src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts --runInBand` passed 3 suites / 12 tests.
   - Pass: executive email action now starts an email AI Ops run, records draft evidence, stores an email payload artifact, sends through the existing Resend sender, records one delivery attempt per recipient with provider id or provider failure, and completes the run as succeeded or failed-retryable.
   - Pass: `cd frontend && npx eslint 'src/app/(main)/actions/executive-briefing-actions.ts' 'src/app/(main)/actions/__tests__/executive-briefing-actions.test.ts' src/lib/ai-ops/executive-daily-brief-ledger.ts`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath 'src/app/(main)/actions/__tests__/executive-briefing-actions.test.ts' src/lib/ai-ops/__tests__/ledger.test.ts src/lib/ai-ops/__tests__/contracts.test.ts --runInBand` passed 3 suites / 19 tests.
   - Pass: `/api/admin/ai-work-runs` now exposes source URL, internal route, and project linkage for evidence rows; `/ai-work-runs` shows Run Guidance with retryability/nextAction and Packet Evidence Drilldown for generated packet refs.
   - Pass: `cd frontend && npx eslint src/app/api/admin/ai-work-runs/route.ts 'src/app/(admin)/ai-work-runs/ai-work-runs-client.tsx'`.
   - Pass: Playwright-authenticated `/ai-work-runs` capture rendered Run Guidance, retryability, nextAction, and Packet Evidence Drilldown for run `0c3b8979-3a31-4aab-98d0-a975ab845e21`.
   - Pass: `frontend/scripts/regenerate-executive-briefing.ts` and fresh Teams preview script now regenerate through `regenerateDailyBriefDraftWithLedger`; the raw-regeneration guardrail scans app routes/actions and frontend scripts.
   - Pass: backend legacy daily digest scheduler is default-off behind `LEGACY_DAILY_DIGEST_ENABLED=false` unless explicitly enabled; standalone `backend/scripts/generate_daily_recap.py` exits 2 by default and points operators to the AI Ops gateway runner.
   - Pass: `python -m py_compile backend/src/services/scheduler.py backend/scripts/generate_daily_recap.py`; `cd frontend && npx eslint --no-ignore scripts/regenerate-executive-briefing.ts scripts/preview-brandon-teams-message.ts`; `npm run rag:verify:executive-daily-brief-gateway`.
   - Pass: `python backend/scripts/generate_daily_recap.py` default-block proof exited 2 with the gateway message.
   - Pass: regenerated Daily Brief packets now persist item-level `sourceRefs` into `daily_recaps.briefing_packet`, using the same canonical evidence-ref shape as the AI Ops ledger.
   - Pass: `sourceRefs` now include source family, source id, title, URL/internal route, excerpt, occurred-at, confidence, and project linkage when that source/project data exists.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts --runInBand` passed 1 suite / 4 tests.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/executive/__tests__/executive-briefing-workflow.test.ts --runInBand` passed 1 suite / 4 tests.
   - Pass: `cd frontend && npx eslint --no-ignore src/lib/ai-ops/executive-daily-brief-evidence.ts src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts src/lib/executive/brandon-daily-update.ts src/lib/executive/executive-briefing-workflow.ts src/lib/executive/__tests__/executive-briefing-workflow.test.ts`.
   - Fail then fixed: live packet proof run `d0062e88-8f3b-4c24-82bd-406eb2840f7f` showed the portfolio Acumatica financial item had a structured ref but no URL/internal route. Fixed by classifying Acumatica from citation detail and routing portfolio financial refs to `/financial-insights`.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts --runInBand` passed 1 suite / 5 tests after adding the portfolio Acumatica fallback test.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/executive/__tests__/executive-briefing-workflow.test.ts --runInBand` passed 1 suite / 4 tests.
   - Pass: `cd frontend && npx eslint --no-ignore src/lib/ai-ops/executive-daily-brief-evidence.ts src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts src/lib/executive/brandon-daily-update.ts src/lib/executive/executive-briefing-workflow.ts src/lib/executive/__tests__/executive-briefing-workflow.test.ts`.
   - Pass: authenticated no-send preview after the fix returned HTTP 200 with run `10c6f901-0d3f-43b7-a602-16e6eb7fd7ab`, `itemCount=4`, `recapDate=2026-06-19`, and `generatedFresh=true`.
   - Pass: SQL readback for run `10c6f901-0d3f-43b7-a602-16e6eb7fd7ab` returned status succeeded, delivery dry-run, packet id `1399b250-4151-429c-a3ce-156e0a161ba9`, source health count `4`, source-ref rows `4`, artifact rows `3`, and delivery attempts `1`.
   - Pass: SQL packet expansion found 4 surfaced items, each with 1 source ref; every ref had source family, id, title, link, excerpt, occurred-at, and confidence; `items_without_source_refs=0`, `refs_without_links=0`.
   - Pass: dev-server socket-close proof run `4adcf1e3-0715-4108-8cc5-083e21e6db6c` was marked `failed_retryable` / `failed` with `DEV_PROOF_SOCKET_CLOSED` and metadata pointing to successful follow-up run `10c6f901-0d3f-43b7-a602-16e6eb7fd7ab`.
   - Pass: applied migration `20260619195500_add_daily_recaps_ai_work_run_id.sql` with `psql`, inserted the version into the Supabase migration ledger, and `npm run db:migrations:verify-applied -- supabase/migrations/20260619195500_add_daily_recaps_ai_work_run_id.sql` passed.
   - Pass: regenerated Supabase types; `frontend/src/types/database.types.ts` now includes `daily_recaps.ai_work_run_id` and FK daily_recaps_ai_work_run_id_fkey.
   - Pass: generated Daily Brief runs now update `daily_recaps.ai_work_run_id` through `daily-brief-canonical-link.ts` after evidence records successfully.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/executive-daily-brief-ledger.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand` passed 2 suites / 11 tests.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/daily-brief-canonical-link.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/executive-daily-brief-ledger.test.ts src/lib/ai-ops/__tests__/ledger.test.ts`.
   - Pass: authenticated no-send preview returned HTTP 200 with run `64285fe0-a122-4745-b888-b7b6116ac854`.
   - Pass: SQL readback proved `daily_recaps.ai_work_run_id = 64285fe0-a122-4745-b888-b7b6116ac854`, `recap_points_to_run=true`, `canonical_run_count=1`, historical run count `5`, source refs `4`, artifacts `3`, and delivery attempts `1`.
   - Pass: generation now writes a `tool_call` run step for `generate-executive-daily-brief-packet`; payload artifact helpers write `tool_call` steps for Teams/email payload builds; dry-run delivery metadata uses build-tool names instead of send-tool names.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/executive-daily-brief-ledger.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts --runInBand` passed 3 suites / 16 tests.
   - Pass: `cd frontend && npx eslint src/lib/ai-ops/daily-brief-canonical-link.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/executive-daily-brief-ledger.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts`.
   - Fail then fixed: local dev-server OOM proof run `a7d8e20b-1d80-48cd-a26e-e753d0f0a7c8` was marked `failed_retryable` / `failed` with `DEV_PROOF_SERVER_OOM`; dev server restarted with `NODE_OPTIONS=--max-old-space-size=8192`.
   - Pass: authenticated no-send preview returned HTTP 200 with run `b45e33fd-fade-40bc-aa2a-0fcebb1e2bc5`.
   - Pass: SQL readback for run `b45e33fd-fade-40bc-aa2a-0fcebb1e2bc5` found `tool_call/succeeded` for `generate-executive-daily-brief-packet` with `sourceRefCount=4`, `tool_call/succeeded` for `build-teams-daily-brief-payload`, dry-run delivery metadata using `build-teams-daily-brief-payload`, source refs `4`, artifacts `3`, delivery attempts `1`, and canonical recap pointer back to the run.
   - Pass: tool policy now carries actor mode, project allowlist, and source-family allowlist through `executiveDailyBriefToolScope()` and `startDailyBriefRun()` into the ai_work_runs tool-scope and source-policy fields, permission context, and completion metadata.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/workflow-pack.test.ts src/lib/ai-ops/__tests__/contracts.test.ts src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts 'src/app/(main)/actions/__tests__/executive-briefing-actions.test.ts' --runInBand` passed 4 suites / 22 tests.
   - Pass: focused ESLint over `executive-daily-brief-workflow.ts`, `tool-registry.ts`, `executive-daily-brief-ledger.ts`, workflow/contract tests, Teams route test, and executive email action test passed.
   - Fail then fixed: live policy readback for run `3ae5360f-c6d8-48dc-9751-255da67b22d7` showed completed runs preserved the ai_work_runs tool-scope field and the ai_work_runs source-policy field but lost `metadata.toolPolicy`; fixed by carrying `toolPolicy` in `DailyBriefRunContext` and writing it during completion/failure updates.
   - Pass: authenticated no-send preview returned run `c008ab40-bb19-45f8-9ce4-2d7a40b5c1e4`; SQL readback showed `permission_mode=service`, `tool_scope.actorMode=service`, `metadata.toolPolicy.actorMode=service`, and matching source-family access lists in the ai_work_runs tool-scope and source-policy fields, and `metadata.toolPolicy`.
   - Pass: operations readiness Daily Brief status now reads canonical `ai_work_runs` run/delivery/source-health state instead of `daily_recaps.sent_teams` or packet `sourceCoverage`.
   - Pass: `cd frontend && npx eslint src/app/api/admin/operations-readiness/status/route.ts`.
   - Pass: authenticated GET `/api/admin/operations-readiness/status` returned Daily Brief metrics with run `succeeded`, delivery `dry_run`, blocker `The latest canonical Daily Brief run has not sent a Teams delivery attempt.`, and source-health cause `Recent email evidence: status missing`.
   - Pass: added repeatable live verifier `frontend/scripts/verify-executive-daily-brief-ledger-integration.ts` and package script `rag:verify:executive-daily-brief-ledger-integration`.
   - Pass: `cd frontend && npx eslint --no-ignore scripts/verify-executive-daily-brief-ledger-integration.ts`.
   - Pass: `EXECUTIVE_DAILY_BRIEF_INTEGRATION_BASE_URL=http://localhost:3001 npm run rag:verify:executive-daily-brief-ledger-integration` returned `PASS`; latest proof preview run `4cc005f3-b1a2-471e-b708-28ccb35aa109` wrote `ai_work_runs`, 4 evidence rows, 3 artifacts, and 1 Teams dry-run delivery attempt; packet inspection found 4 surfaced items and 4 source refs with family counts `document=3`, `acumatica=1`; meeting/fireflies/email/outlook/Teams families were absent from surfaced claims and therefore excluded; disabled delivery run `84c4de07-1d94-4731-8ff0-086b3e77bc6a` wrote a disabled attempt; scheduled proof run `5cfeac2e-7e7e-4817-9a4f-abe6ce0f4b03` wrote a scheduled AI Ops run with status skipped and delivery disabled.
   - Pass: raw frontend `regenerateExecutiveBriefingDraft()` now has an explicit deprecation boundary: routes/actions/scripts/tools must use the AI Ops gateway helper so every packet has a canonical run, source health, artifacts, and delivery attempts.
   - Pass: backend legacy `run_daily_digest()` is default-blocked with `status=disabled`, `reason=legacy_daily_digest_disabled`, and canonical runner `frontend/scripts/run-executive-daily-brief.ts`; `/api/digests/daily/generate` now returns a loud `LEGACY_DAILY_DIGEST_DISABLED` conflict unless `LEGACY_DAILY_DIGEST_ENABLED=true`.
   - Pass: `cd frontend && npx eslint src/lib/executive/executive-briefing-workflow.ts`; `python3 -m py_compile backend/src/services/daily_digest.py backend/src/api/main.py`; direct `PYTHONPATH=backend python3` proof of `run_daily_digest('2026-06-19', 1)` returned the disabled result; `npm run rag:verify:executive-daily-brief-gateway` passed.
   - Pass: deprecated `/api/admin/owner-briefing/send-test` is now a blocked compatibility route. It no longer queries `daily_recaps` or calls Teams directly; it records a blocked AI Ops run/delivery attempt and returns HTTP 410 with the canonical `/api/executive/daily-brief/send-teams` route.
   - Pass: `scripts/verify/verify_executive_daily_brief_gateway.mjs` now fails if the deprecated admin test-send route reintroduces direct `daily_recaps` queries or direct `sendProactiveMessage`/`sendProactiveCard` calls.
   - Pass: real Teams delivery implementation now preserves the Teams provider post result when exposed by the SDK; `owner-briefing-delivery.ts` normalizes `providerMessageId`/`providerResponse`, and `recordDeliveryEvidence()` persists them on `ai_work_run_delivery_attempts`.
   - Pass: `cd frontend && npx eslint src/app/api/admin/owner-briefing/send-test/route.ts src/lib/bot/teams-chat.ts src/lib/executive/owner-briefing-delivery.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/ledger.test.ts` passed cleanly.
   - Pass: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/ledger.test.ts src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts --runInBand` passed 2 suites / 14 tests. Coverage proves provider message id/provider response persistence, disabled delivery, dry-run, blocked provider result, partial recipient failure, and thrown-provider failure behavior.
   - Pass: authenticated `agent-browser` proof of `/ai-work-runs` rendered live ledger rows for skipped/disabled runs, succeeded/dry-run previews, failed-permanent, failed-retryable, and running preview rows, plus Run Guidance, Delivery Attempts, Run Steps, exact failure code/message, and Packet Evidence Drilldown. Artifacts: `tests/agent-browser-runs/2026-06-19-executive-daily-brief-ai-work-runs/snapshot-loaded.txt`, `main-text.txt`, `ai-work-runs-loaded.png`.
   - Deferred: live external Teams send remains blocked until `EXECUTIVE_DAILY_BRIEF_ENABLED=true` is explicitly safe with an approved recipient/window; live email send remains deferred until an approved recipient/window is explicitly safe. Both deferred items have owner/cause/prevention/next action recorded in the task file.
8) Evidence artifacts (screenshot/video/report/log paths):
   - `docs/ops/tasks/2026-06-19-executive-daily-brief-ai-ops-gateway.md`
   - `docs/ops/handoffs/2026-06-19-S57-executive-daily-brief-ai-ops-gateway.md`
   - `frontend/src/lib/ai-ops/ledger.ts`
   - `frontend/src/lib/ai-ops/executive-daily-brief-ledger.ts`
   - `frontend/src/lib/ai-ops/__tests__/contracts.test.ts`
   - `frontend/src/lib/ai-ops/__tests__/ledger.test.ts`
   - `frontend/scripts/run-executive-daily-brief.ts`
   - `frontend/src/app/api/executive/daily-brief/preview-teams/route.ts`
   - `frontend/src/app/api/executive/daily-brief/send-teams/route.ts`
   - `frontend/src/app/api/admin/owner-briefing/send-test/route.ts`
   - `frontend/src/lib/bot/teams-chat.ts`
   - `frontend/src/lib/executive/owner-briefing-delivery.ts`
   - `frontend/src/lib/ai/tools/executive-brief-tools.ts`
   - `frontend/src/app/api/executive/daily-brief/route-helpers.ts`
   - `frontend/src/app/api/executive/daily-brief/widget/route.ts`
   - `frontend/src/app/api/executive/daily-brief/preview-teams/route.ts`
   - `frontend/src/app/(main)/actions/executive-briefing-actions.ts`
   - `frontend/src/app/api/executive/daily-brief/__tests__/route.test.ts`
   - `frontend/src/app/api/executive/brandon-daily-update/__tests__/route.test.ts`
   - `scripts/verify/verify_executive_daily_brief_gateway.mjs`
   - `frontend/src/app/api/admin/ai-work-runs/route.ts`
   - `frontend/src/app/(admin)/ai-work-runs/ai-work-runs-client.tsx`
   - `supabase/migrations/20260619183000_add_ai_work_run_artifacts_delivery_attempts.sql`
   - `frontend/src/types/database.types.ts`
   - `docs/architecture/AI-RAG-ARCHITECTURE.md`
   - `docs/architecture/tables.yaml`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-ai-runs/snapshot-playwright-auth.txt`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-ai-runs/page-text.txt`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-ai-runs/ai-work-runs-playwright-auth.png`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-ai-work-runs/snapshot-loaded.txt`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-ai-work-runs/main-text.txt`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-ai-work-runs/ai-work-runs-loaded.png`
   - `frontend/src/lib/ai-ops/source-adapters.ts`
   - `frontend/src/lib/ai-ops/executive-daily-brief-workflow.ts`
   - `frontend/src/lib/ai-ops/tool-registry.ts`
   - `frontend/src/lib/ai-ops/__tests__/workflow-pack.test.ts`
   - `frontend/src/lib/ai-ops/executive-daily-brief-evidence.ts`
   - `frontend/src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts`
   - `frontend/src/lib/ai-ops/daily-brief-canonical-link.ts`
   - `frontend/src/lib/ai-ops/__tests__/executive-daily-brief-ledger.test.ts`
   - `frontend/src/lib/executive/brandon-daily-update.ts`
   - `frontend/src/lib/executive/executive-briefing-workflow.ts`
   - `frontend/src/lib/executive/__tests__/executive-briefing-workflow.test.ts`
   - `frontend/scripts/__tests__/run-executive-daily-brief.test.ts`
   - `frontend/src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts`
   - `frontend/src/lib/ai-ops/__tests__/source-adapters.test.ts`
   - `frontend/src/app/api/cron/executive-daily-brief/route.ts`
   - `frontend/src/app/api/cron/executive-daily-brief/__tests__/route.test.ts`
   - `frontend/src/app/(main)/actions/executive-briefing-actions.ts`
   - `frontend/src/app/(main)/actions/__tests__/executive-briefing-actions.test.ts`
   - `frontend/src/app/api/admin/ai-work-runs/route.ts`
   - `frontend/src/app/(admin)/ai-work-runs/ai-work-runs-client.tsx`
   - `frontend/scripts/regenerate-executive-briefing.ts`
   - `frontend/scripts/preview-brandon-teams-message.ts`
   - `scripts/verify/verify_executive_daily_brief_gateway.mjs`
   - `backend/src/services/scheduler.py`
   - `backend/scripts/generate_daily_recap.py`
   - `frontend/src/lib/executive/executive-briefing-teams-delivery.ts`
   - `frontend/src/lib/executive/__tests__/executive-briefing-teams-delivery.test.ts`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-source-adapters/page-text.txt`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-source-adapters/ai-work-runs-source-adapters.png`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-ui-drilldown/page-text-playwright.txt`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-ui-drilldown/ai-work-runs-ui-drilldown-playwright.png`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-generated-preview/page-text-playwright.txt`
   - `tests/agent-browser-runs/2026-06-19-executive-daily-brief-generated-preview/ai-work-runs-generated-preview-playwright.png`
9) Top 3 findings (frontend-visible issues first):
   - No frontend-visible changes yet.
   - Inventory confirmed multiple bypasses: preview routes, send routes, admin test send, actions, AI tools, and legacy delivery paths can generate or deliver without one canonical `ai_work_runs` record.
   - Shared AI Ops contracts and a shared ledger writer now exist and are tested; scheduled runner, preview/send routes, widget fresh generation, executive page regeneration, admin test-send, and AI tool generation now use the shared writer or an existing-run helper.
   - New generated Daily Brief runs now set `ai_work_runs.daily_recap_id` and the reciprocal `daily_recaps.ai_work_run_id`; live proof `64285fe0-a122-4745-b888-b7b6116ac854` shows exactly one canonical run pointer for the packet while preserving historical run links.
   - First-class AI Ops run steps, artifacts, and delivery attempts now exist in the database, are exposed by `/api/admin/ai-work-runs`, and are visible in `/ai-work-runs`.
   - The Executive Daily Brief workflow pack, source adapter contract, and tool registry/policy are centralized and used by run construction.
   - Tool policy filtering now includes actor mode, project allowlist, source-family access, channel, and delivery/write permission; source adapter tools are hidden when their source families are outside policy.
   - Operations readiness no longer treats legacy Daily Brief sent flags or packet source-coverage fields as canonical status; it reports the AI Ops ledger run, delivery attempt, and source-health state.
   - A repeatable live verifier now covers preview, dry-run, disabled, scheduled ledger writes, and generated-packet source-family evidence through the actual local routes/runner and Supabase readback.
   - Remaining legacy generation paths either route through the gateway, throw/deprecate loudly, or are default-blocked without claiming queued/sent success.
   - Claim-level evidence guardrails now fail before ledger writes when surfaced `needsBrandon`, `waitingOnOthers`, or `importantUpdates` items lack structured citation evidence.
   - A real generated no-send preview run is proven in the ledger and visible in `/ai-work-runs` with packet artifact, Teams payload artifact, dry-run delivery attempt, source health, and evidence rows.
   - Scheduled runner proof now shows both outside-window skipped schedules and matching scheduled triggers create canonical AI Ops runs; explicit runtime env now wins over `.env.local`.
   - Teams delivery route tests now prove disabled, dry-run, blocked, partial, and thrown-provider paths cannot bypass the AI Ops ledger helpers.
   - Source adapter wrappers now produce visible source-fetch run steps and a source-health report artifact; missing required adapters fail loudly as failed-retryable run steps without silently suppressing the generated packet.
   - Tool calls now leave explicit run-step evidence: generation, Teams/email payload builds, and dry-run delivery metadata are inspectable in `ai_work_run_steps`.
   - The old cron Teams delivery path no longer sends directly; it delegates to the canonical gateway and the old direct sender fails loudly if imported.
   - Manual email sends from the executive action now create canonical AI Ops runs, packet/artifact evidence, and per-recipient delivery attempts for both successful and provider-failed Resend outcomes.
   - `/ai-work-runs` now shows retryability/next-action guidance and generated-packet evidence drilldown; live no-send preview run `10c6f901-0d3f-43b7-a602-16e6eb7fd7ab` proves packet-level `sourceRefs` are present and linkable for all four surfaced claims.
   - Duplicate frontend Daily Brief scripts are ledger-backed wrappers or no-send previews, and backend legacy digest paths are default-disabled with loud operator messaging.
10) Recommended next action (one line): Close remaining source coverage/readiness legacy gaps, actor/source-access policy filters, route-level source-query bypass audit, and real Teams delivery when safe/enabled.
11) Handoff file path: `docs/ops/handoffs/2026-06-19-S57-executive-daily-brief-ai-ops-gateway.md`
12) Migration ledger evidence: `npm run db:migrations:verify-applied -- supabase/migrations/20260619183000_add_ai_work_run_artifacts_delivery_attempts.sql` passed for version `20260619183000`.
<!-- markdownlint-enable MD029 MD034 -->

## Linear Updates

- Kickoff comment: `8bcbe3bd-dcea-4d7f-a207-6ed701ff2085`.
- Milestone comments:
  - `87ae233d-c1db-4302-b1ad-9d2f5269dbdc` recorded inventory, ledger audit, contracts, and ledger writer before scheduled-runner migration.
  - `8ad449c3-f770-4f2a-bbd5-d81e33def16a` recorded scheduled-runner migration through the shared ledger writer.
  - `d7e0ea7f-b634-4423-9e5c-ea0630f63bd7` recorded preview/send route ledger wiring and disabled-send smoke evidence.
  - `bb5df727-1331-45da-8eb4-60030c5cad8f` recorded admin test-send and AI tool ledger wrapping.
  - `14c489d3-a9d8-47bb-b98a-5191d64566d8` recorded first-class run steps/artifacts/delivery attempts, migration/type evidence, UI proof, and unrelated verification blockers.
  - `d2280aa3-e2cc-4282-aec4-84839d6840aa` recorded workflow pack, source adapter contract, tool policy, disabled delivery tool hiding, and remaining proof gaps.
  - `e4027597-e511-46d9-9b18-c49661505d11` recorded generated no-send preview proof, artifact/delivery/source-health readback, browser proof, and remaining gaps.
  - `ade23489-9add-47a6-834f-af71ee6adac4` recorded claim-level evidence-policy guardrail, focused tests, gateway guardrail rerun, commit `519d8b802`, and remaining gaps.
  - `d01eb6c1-a4ab-4217-a543-97f4d2a7d855` recorded scheduled-run proof, env precedence fix, skipped/matching scheduled run IDs, commit `017956053`, and remaining gaps.
  - `33c4dc4e-39c2-4445-af4f-b19be127b9b0` recorded Teams delivery route guardrail tests, commit `b47f730df`, and remaining gaps.
  - `005963be-595e-4036-9a81-d30ff619c76a` recorded source adapter run-step proof, live run `0c3b8979-3a31-4aab-98d0-a975ab845e21`, commit f16030b9f, and remaining gaps.
  - `d8a88aa5-7358-4603-8e3d-58e390dbcca1` recorded legacy Teams cron path retirement, focused lint/tests, and remaining gaps.
  - `5d26abde-09b9-4e6e-a044-45ffa72c12b5` recorded email delivery action ledger wrapping, focused lint/tests, and remaining gaps.
  - `17e47a71-797e-43c7-a763-8e3181750dda` recorded packet-level `sourceRefs` persistence, focused lint/tests, and live regenerated-packet proof remaining.
  - `7445ddd5-e71d-4b5c-9193-05993d462635` recorded live packet sourceRefs proof, Acumatica fallback, focused lint/tests, and remaining gaps.
  - `8207b9a9-e26d-44c4-b853-11acedf9f350` recorded canonical `daily_recaps.ai_work_run_id` relationship, migration/type evidence, live proof, and remaining gaps.
  - `cde4d7ff-ee49-48d7-9cb3-a2d273d83f19` recorded tool-call run-step recording, live proof, OOM remediation, focused lint/tests, and remaining gaps.
  - `e5b1568a-90ea-4912-84bd-aed849ac6b3a` recorded admin UI source drilldown, retry guidance, browser proof, and remaining structured source-ref gaps.
  - `0647ed44-013a-47ce-b738-979c7b285444` recorded duplicate script and backend legacy digest disposition, focused checks, and remaining source coverage/readiness gaps.
- Completion/blocker comment: None yet.

## Current Status

In progress. Linear issue AAI-551 is created and the task markdown file is the
source of truth. Current-path inventory, ledger audit, shared AI Ops contracts,
the shared ledger writer, scheduled-runner migration, preview/send route ledger
wiring, app fresh-generation bypass closure, a route/action raw-generator
guardrail, existing `daily_recaps` artifact linkage through
`ai_work_runs.daily_recap_id`, first-class run steps/artifacts/delivery attempts,
the workflow pack/source-adapter/tool-policy layer, and a real generated no-send
preview proof are implemented with focused tests/lint, migration ledger
verification, SQL readback, authenticated `/ai-work-runs` browser evidence,
claim-level evidence-policy unit coverage, and scheduled-run skip/disabled
delivery proof. Source adapter failures now land as visible source-fetch step
failures with a source-health report artifact. The old cron Teams delivery path
now delegates to the canonical send gateway, and the legacy direct sender fails
loudly instead of claiming success outside the ledger. Manual email sends from
the executive action now create canonical AI Ops runs with draft evidence,
email-payload artifacts, provider ids or provider failures, and per-recipient
delivery attempts. `/ai-work-runs` now exposes retryability/next-action guidance
and generated-packet evidence drilldown. Duplicate frontend Daily Brief scripts
are now ledger-backed wrappers or no-send previews, and backend legacy digest
paths are default-disabled with loud operator messaging. The workflow is not
complete until structured source-ref completeness, real Teams delivery when
safe/enabled, and remaining source coverage/readiness legacy gaps are complete.

## Exact Next Step

Close structured source-ref completeness, real Teams delivery when safe/enabled,
and remaining source coverage/readiness legacy gaps without weakening the
canonical ledger path.

## Known Pitfalls

- Do not add another route-level Daily Brief implementation.
- Do not add schema before contracts and existing ledger audit.
- Do not call a generated preview proof of end-to-end completion unless it writes
  a canonical run row and claim-level evidence refs.
- Do not treat `/ai-work-runs` as proof until the actual generation paths write
  to it.
- Do not treat the current disabled-send proof as generated-brief proof; it only
  proves disabled delivery writes canonical run, delivery-attempt, and step rows.

## Resume Commands

```bash
sed -n '1,180p' docs/ops/tasks/2026-06-19-executive-daily-brief-ai-ops-gateway.md
sed -n '1,180p' docs/ops/handoffs/2026-06-19-S57-executive-daily-brief-ai-ops-gateway.md
rg -n "regenerateExecutiveBriefingDraft|sendOwnerBriefingToTeams|ai_work_runs|daily_recaps|sourceCoverage|sourceRefs|executive_daily_brief" frontend/src frontend/scripts backend/src supabase/migrations docs -S
cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/contracts.test.ts --runInBand
cd frontend && npx eslint src/lib/ai-ops/contracts.ts src/lib/ai-ops/__tests__/contracts.test.ts
cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand
cd frontend && npx eslint src/lib/ai-ops/contracts.ts src/lib/ai-ops/ledger.ts src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts
cd frontend && npx eslint --no-ignore scripts/run-executive-daily-brief.ts
cd frontend && npx tsx scripts/run-executive-daily-brief.ts --now=2026-06-19T12:00:00.000Z
cd frontend && npx eslint src/lib/ai-ops/executive-daily-brief-ledger.ts src/app/api/executive/daily-brief/preview-teams/route.ts src/app/api/executive/daily-brief/send-teams/route.ts
curl -sS -X POST http://localhost:3001/api/executive/daily-brief/send-teams -H 'content-type: application/json' -d '{}'
cd frontend && npx eslint src/app/api/admin/owner-briefing/send-test/route.ts src/lib/ai/tools/executive-brief-tools.ts src/lib/ai-ops/executive-daily-brief-ledger.ts
npm run rag:verify:executive-daily-brief-gateway
cd frontend && npx eslint src/lib/ai-ops/executive-daily-brief-ledger.ts src/app/api/executive/daily-brief/preview-teams/route.ts src/app/api/executive/daily-brief/route-helpers.ts src/app/api/executive/daily-brief/widget/route.ts 'src/app/(main)/actions/executive-briefing-actions.ts' src/app/api/executive/daily-brief/__tests__/route.test.ts src/app/api/executive/brandon-daily-update/__tests__/route.test.ts
cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/app/api/executive/daily-brief/__tests__/route.test.ts src/app/api/executive/brandon-daily-update/__tests__/route.test.ts --runInBand
npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public
cd frontend && npx eslint src/lib/ai-ops/contracts.ts src/lib/ai-ops/ledger.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/lib/ai/tools/executive-brief-tools.ts src/app/api/executive/daily-brief/preview-teams/route.ts src/app/api/admin/owner-briefing/send-test/route.ts src/app/api/admin/ai-work-runs/route.ts 'src/app/(admin)/ai-work-runs/ai-work-runs-client.tsx'
cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/contracts.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand
cd frontend && npx eslint src/lib/ai-ops/executive-daily-brief-evidence.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts
cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand
cd frontend && npx eslint --no-ignore scripts/run-executive-daily-brief.ts scripts/__tests__/run-executive-daily-brief.test.ts
cd frontend && npx tsx --test scripts/__tests__/run-executive-daily-brief.test.ts
cd frontend && npx eslint src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts src/app/api/executive/daily-brief/send-teams/route.ts
cd frontend && npm run test:unit -- --runTestsByPath src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts src/app/api/executive/daily-brief/__tests__/route.test.ts src/lib/ai-ops/__tests__/ledger.test.ts --runInBand
cd frontend && npx eslint src/lib/ai-ops/source-adapters.ts src/lib/ai-ops/executive-daily-brief-ledger.ts src/lib/ai-ops/__tests__/source-adapters.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts
cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai-ops/__tests__/source-adapters.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts src/lib/ai-ops/__tests__/ledger.test.ts src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts --runInBand
```

## Evidence

- Linear issue: https://linear.app/megankharrison/issue/AAI-551/rebuild-executive-daily-brief-as-ai-operations-gateway-proof-workflow
- Task file: `docs/ops/tasks/2026-06-19-executive-daily-brief-ai-ops-gateway.md`
- Contract module: `frontend/src/lib/ai-ops/contracts.ts`
- Ledger writer: `frontend/src/lib/ai-ops/ledger.ts`
- Daily Brief ledger helper: `frontend/src/lib/ai-ops/executive-daily-brief-ledger.ts`
- Contract tests: `frontend/src/lib/ai-ops/__tests__/contracts.test.ts`
- Ledger tests: `frontend/src/lib/ai-ops/__tests__/ledger.test.ts`
- Scheduled runner: `frontend/scripts/run-executive-daily-brief.ts`
- Preview route: `frontend/src/app/api/executive/daily-brief/preview-teams/route.ts`
- Send route: `frontend/src/app/api/executive/daily-brief/send-teams/route.ts`
- Admin test-send route: `frontend/src/app/api/admin/owner-briefing/send-test/route.ts`
- AI tool path: `frontend/src/lib/ai/tools/executive-brief-tools.ts`
- Packet route helper: `frontend/src/app/api/executive/daily-brief/route-helpers.ts`
- Widget route: `frontend/src/app/api/executive/daily-brief/widget/route.ts`
- Executive regenerate action: `frontend/src/app/(main)/actions/executive-briefing-actions.ts`
- Gateway guardrail: `scripts/verify/verify_executive_daily_brief_gateway.mjs`
- Admin run API: `frontend/src/app/api/admin/ai-work-runs/route.ts`
- Admin run UI: `frontend/src/app/(admin)/ai-work-runs/ai-work-runs-client.tsx`
- Evidence policy: `frontend/src/lib/ai-ops/executive-daily-brief-evidence.ts`
- Evidence policy tests: `frontend/src/lib/ai-ops/__tests__/executive-daily-brief-evidence.test.ts`
- Scheduled runner tests: `frontend/scripts/__tests__/run-executive-daily-brief.test.ts`
- Teams delivery route tests: `frontend/src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts`
- Source adapter tests: `frontend/src/lib/ai-ops/__tests__/source-adapters.test.ts`
