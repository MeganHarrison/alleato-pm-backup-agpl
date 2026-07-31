# Handoff: 2026-07-21 — AAI-1187 Transaction-Safe Schedule Import

## Intake Block

1) Session ID: SROOT1187
2) Task ID: AAI-1187
3) Linear issue: AAI-1187
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1187/make-schedule-replacement-imports-transaction-safe
5) Current status: In Progress — implementation and database migration complete; production browser proof pending deployment.
6) Files changed (absolute paths): task file, handoff, schedule import parser/API/UI/tests, generated Supabase function type, and three applied migrations under `supabase/migrations/`.
7) Commands run and outcome (pass/fail counts): PASS focused Jest suite (4 suites/13 tests); PASS target ESLint (0 errors/4 existing warnings); FAIL full TypeScript only on 277 unrelated baseline errors.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/tasks/2026-07-21-aai-1187-transaction-safe-import.md`; Supabase migration/function/privilege read-backs in this session.
9) Top 3 findings (frontend-visible issues first): replacement previously deleted live rows before validation; predecessor type/lag was dropped; anonymous callers initially retained an inherited RPC execute grant and schedule tables have no live RLS policies, so the RPC now explicitly verifies membership/app-admin authorization.
10) Recommended next action (one line): Publish, wait for Vercel, then use refreshed browser auth to prove a malformed canonical-route import preserves the current schedule.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-SROOT1187-transaction-safe-import.md`
12) Migration ledger evidence: applied through Supabase MCP: `replace_schedule_import_atomic`, `restrict_schedule_import_rpc`, and `authorize_schedule_import_rpc`; standard CLI verifier is blocked by missing isolated-workspace DB credential, but live function and grants were read back.

## Exact Next Step

Publish this committed increment and collect authenticated canonical-route screenshot/video proof of rejected import behavior.
