# Task: Project Intelligence architecture consolidation

Status: Complete
Owner: Codex
Created: 2026-07-22
Task ID: AAI-1032
Linear Issue: [AAI-1032](https://linear.app/megankharrison/issue/AAI-1032/deepen-project-intelligence-pipeline-content-source-module)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-project-intelligence-architecture-consolidation.md`

## Objective

Make Project Intelligence have one explicit production ownership boundary: one scheduled runner, one core run contract, explicit projection adapters, and a maintenance namespace that cannot be mistaken for cron runtime.

## Scope

- Confirm the deployed scheduler/Docker/runtime graph and record the first actual duplicate seam.
- Implement one bounded consolidation slice around the existing daily run contract and packet-to-operating-record projection seam.
- Add failure-loud guardrails so cron cannot accidentally target maintenance/backfill modules or a second compiler.
- Complete the remaining shared compiler decomposition into focused source-selection, model-transport, synthesis-validation, packet-repository, and consumer-invocation owners.
- Complete the remaining projection fan-out decomposition and confirm frontend routes are read-only adapters over the canonical packet ledger.
- Prove one complete source-linked daily run end to end and update the architecture/runbook/file-tree documentation.

## Source of Truth

- Canonical runtime/data owner: `project-intelligence/runner/run-scheduled-daily-executive-brief.mjs`, backed by the existing run contract.
- Existing shared primitives/services: `scripts/intelligence/lib/daily-source-corpus.mjs`, `scripts/intelligence/lib/executive-intelligence-run.mjs`, `backend/src/services/intelligence/compiler.py::apply_source_operating_record_projection`.
- Deprecated or parallel paths: root `scripts/intelligence/daily-executive-brief.mjs`, backend `project_synthesizer` cron, backend `domain_compiler` cron, and manual `daily-deep-read-backfill.mjs` / repair scripts until ownership is made explicit.

Verification contract: Required

## Acceptance Criteria

- [x] Actual production entrypoints and ownership boundaries are documented with exact file and Render/Docker evidence.
- [x] The first consolidation slice is observable end to end and preserves the completed-run/publish contract through the existing runner adapter and focused scheduler tests.
- [x] Failure-loud behavior identifies the duplicate/invalid owner and actionable recovery path.
- [x] Maintenance/backfill paths are explicitly non-cron and covered by a guardrail contract.
- [x] The shared Node compiler is a thin orchestrator over focused, independently testable core owners.
- [x] Projection fan-out is split into governed adapters with explicit receipts and fail-closed publication behavior.
- [x] Frontend summary/detail routes read the canonical packet ledger and preserve source links; no frontend writer creates competing intelligence truth.
- [x] One controlled daily run proves complete source enumeration/materialization, deep synthesis, packet persistence, projections, tasks, progress reports, current state, and canonical rendered output.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] A shared Project Intelligence ownership contract owns the scheduled/maintenance boundary.
- [x] The scheduled adapter is thin and does not contain synthesis/projection policy.
- [x] Errors are specific and actionable.
- [x] Database/provider/auth-adjacent contracts are separately verified through the live AI Gateway schema probe, live packet-repository connection probe, and authenticated canonical browser proof.
- [x] Verification runs at coherent phase gates only: backend ownership, Node decomposition, publication, and final runtime/visual proof. Editing loops use syntax/import checks only.

## Integration and Verification

- [x] Targeted architecture/runner tests pass.
- [x] Actual scheduled-run or equivalent live readback proves the canonical packet contract.
- [x] Evidence artifacts are recorded, including a viewable architecture report.
- [x] Known unrelated failures are recorded; the final controlled run encountered none.
- [x] Task-owned files are published with exact blob parity to `origin/main`; local `HEAD` convergence is intentionally replaced by remote blob verification because this is the registered shared leased checkout.

## Remaining Implementation Plan

1. [x] Extract Node provider transport, executive synthesis, project-record normalization, packet persistence, and consumer receipt validation.
2. [x] Replace the monolithic compiler implementations with imports from those owners while preserving source-coverage and citation gates.
3. [x] Split the projection fan-out into governed adapters and retain one orchestrating receipt.
4. [x] Move backend PM-app final writers and the packet repository behind the canonical Project Intelligence package.
5. [x] Audit the web adapters for canonical read-only packet ownership and exact detail-vs-summary rendering.
6. [x] Update architecture, full file tree, visual documentation, and operations runbook.
7. [x] Run one publication gate and one final controlled runtime/visual gate; do not repeatedly rerun unchanged suites.

## Failure-Loudly Contract

- Cause surfaced as: `Project Intelligence ownership violation: <entrypoint> is not an approved runner or imports maintenance code.`
- Detection path: architecture guard test plus Render/Docker entrypoint inspection and scheduled-run readback.
- Recovery path: route the job through the canonical runner; maintenance tools must be invoked manually with an explicit command.

## Incident Learning

- Failure fingerprint: `architecture.project-intelligence-runtime-ownership-drift`
- Root cause: production execution, backend synthesis, and frontend projection ownership remained distributed after the canonical artifact contract was documented.
- Detection gap: architecture documentation was treated as if it were an executable boundary; no guard prevented parallel cron owners or maintenance adjacency.
- Prevention: enforce one runner contract, explicit module namespaces, and a cron-target audit.
- Guardrail evidence: `node --test project-intelligence/runner/__tests__/ownership-contract.test.mjs` passed 2/2.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Runtime entrypoint | `backend/Dockerfile.executive-brief`, `render.yaml` | Confirmed split | Render cron now enters `project-intelligence/runner`; separate backend synthesis/domain cron owners remain explicit follow-on seams. |
| Hotspot sizing | `wc -l` on compiler/runtime/projection modules | Confirmed debt | 1,590-line Node compiler; 4,023-line backend compiler; overlapping frontend ledgers. |
| Ownership contract | `node --test project-intelligence/runner/__tests__/ownership-contract.test.mjs` | Pass (2/2) | Legacy runner and maintenance targets fail loudly. |
| Scheduler regression | `node --test project-intelligence/runner/__tests__/run-scheduled-daily-executive-brief.test.mjs` | Pass (9/9) | DST, weekday, duplicate protection, publishability, explicit-regeneration override, and typed failure persistence checks remain green. |
| Syntax | `node --check project-intelligence/runner/run-scheduled-daily-executive-brief.mjs` | Pass | Canonical runner contains the scheduler implementation; the former functional file was deleted. |
| Architecture report | `/tmp/project-intelligence-architecture-review.html` | Created/viewed | Before/after ownership graph and remaining staged debt. |
| Node module extraction | `project-intelligence/core/{model-transport,executive-synthesis,project-records,packet-repository}.mjs`; `project-intelligence/projections/run-consumers.mjs` | In progress | Focused owners and isolated tests created; compiler/fan-out integration remains. |
| Node phase gate | `node --test project-intelligence/{core,ingestion,runner,projections}/**/*.test.mjs` | Pass (65/65) | Compiler integration, full-source receipts, synthesis, fan-out reconciliation, scheduler, and recovery all pass. |
| Backend ownership gate | `cd backend && RAG_DATABASE_URL='' .venv/bin/python -m pytest -q ...` | Pass (51/51) | Packet repository and PM-app final writers resolve through `services/project_intelligence`; shared compiler contains no direct writes to those tables/RPC. |
| Web ownership audit | `canonical-packets.ts`, landing/detail routes, route ownership guard | Pass by inspection; publication test pending | Canonical packet/API adapters are read-only; legacy route generation returns 409; summary/detail ownership is explicit. |
| Documentation | `PROJECT-INTELLIGENCE.md`, workflow SVG, runbook | Updated | File tree and module/failure boundaries reflect the implementation. |
| First controlled regeneration | `node project-intelligence/runner/run-scheduled-daily-executive-brief.mjs --force --date 2026-07-21 --regenerate` | Failed acceptance: exited 0 without running | Runtime readback returned `skipped: true`, reason `scheduler_run_already_succeeded`, attempt 13; no compiler, consumers, packet, or new evidence ran. |
| Regeneration guardrail | `resolveSchedulerExecutionDecision` plus focused scheduler test | Pass (8/8) | Explicit `--regenerate` now overrides a succeeded/exhausted recovery decision and reaches the governed claim/compiler path; ordinary scheduling retains idempotent skips. |
| Second controlled regeneration | Same controlled command | Failed closed during synthesis | Full corpus completed at 222 sources / 1,925,612 reconciled characters / zero source failures. Five structured outputs were non-JSON, so no packet or consumer was published; failure persistence then exposed an untyped PostgreSQL `CASE` timestamp parameter. |
| Structured-output and failure-state guardrails | JSON Schema response contract, bounded response metadata, explicit timestamp casts | Pass (20/20 focused) | Structured brief calls now use the AI Gateway-supported `json_schema` contract; malformed responses report provider, finish reason, and length without storing sensitive source prose; terminal failure timestamps persist as `timestamptz`. |
| Provider schema compatibility probe | Live `openai/gpt-5.6-terra` call through configured AI Gateway with `BRIEF_V3_RESPONSE_FORMAT` | Pass | Provider returned `finishReason=stop` and all seven required top-level brief keys. |
| Strict-schema adversarial probe | Live full-schema call requesting five watchouts, uppercase/spaced IDs, and an empty prevention title | Pass | Strict schema constrained output to three watchouts, valid slug IDs, and nonempty prevention titles. |
| Packet repository connection | Focused repository test plus live `select 1` through `buildPacketDatabaseConfig` | Pass | Extracted repository now uses the canonical app-DB connection resolver, removes URL SSL-mode ambiguity, and applies the Supabase TLS policy. |
| Final controlled run | `node project-intelligence/runner/run-scheduled-daily-executive-brief.mjs --force --date 2026-07-21 --regenerate` | Pass | Packet `c1474a3d-d6cd-4741-b2e5-c24bfc061240` is current/fresh/completed; scheduler attempt 18 succeeded. |
| Full-source receipt | Compiler and packet readback | Pass | 618 rows enumerated; 222 sources; 1,925,612 source characters = 1,925,612 model-input characters; 0 failures/truncations. |
| Projection fan-out | Consumer readback | Pass | 30 candidates; 18/18 current-state updates; 25 tasks plus 5 decisions; 11/11 progress reports; packet promotion complete. |
| Render runtime | `verify_daily_executive_brief_schedule.mjs`; `render deploys list` | Pass | Cron is active on `main`, auto-deploy enabled, canonical packet read back, and live Render revision is a descendant of all task commits. |
| Canonical browser proof | `/daily-brief`; `/daily-briefs/c1474a3d-d6cd-4741-b2e5-c24bfc061240` | Pass | New packet ID is in the summary DOM; full detail renders the extended report and source links; cleared/reloaded route has no browser errors. |
| Screenshot completion gate | `docs/ops/evidence/2026-07-22-project-intelligence-architecture-consolidation/*.png`; Linear comment `4299f619-16f7-48a0-abf6-44a1fa59d2c9` | Pass | Summary/detail desktop and mobile screenshots are attached and viewable on AAI-1032. |

## Remaining Risk

- The next normal 6:00 AM ET window is the first unattended post-change observation. The live Render cron is active on `main`, auto-deploy is enabled, the deployed revision contains these changes, and failure states now persist loudly; no implementation blocker remains.
- The checkout contains unrelated concurrent dirty paths and active leases. They remain preserved and were not staged or published by this task.

### Controlled-run defect learning

- Cause: the runner bypassed the existing-packet check for `--regenerate`, then incorrectly applied the normal scheduler recovery decision and returned a successful no-op for an already-succeeded ledger row.
- Detection gap: scheduler tests covered idempotent scheduled execution but did not cover the explicit operator regeneration contract against a succeeded run.
- Prevention: `resolveSchedulerExecutionDecision` makes regeneration intent explicit at the runner boundary, with a regression test proving it overrides the normal skip while leaving default idempotency unchanged.

### Structured-synthesis and failure-state learning

- Cause: the structured brief call requested free-form text, so all five successful model responses could fail JSON parsing before schema validation. The pre-schema guard discarded response metadata and retried with `unknown validation failure`. Separately, the terminal failure SQL left the timestamp parameter untyped inside a `CASE`, so PostgreSQL resolved it as text.
- Detection gap: model transport tests covered provider availability but not structured response mode, empty response metadata, or the live terminal-failure SQL expression.
- Prevention: structured brief calls use a versioned JSON Schema response contract supported by the configured AI Gateway; bounded diagnostics retain provider, finish reason, and content length without raw business content; a live compatibility probe and model transport/scheduler tests cover the provider request, response, and `timestamptz` casts.

### Provider-contract learning

- Cause: the first transport hardening used OpenAI's `json_object` format, which this configured AI Gateway/model route rejects with HTTP 400 even though the gateway supports structured output through `json_schema`.
- Detection gap: a mocked transport test proved payload forwarding but did not prove live provider compatibility, despite existing backend notes that `json_object` support varies by model.
- Prevention: the canonical schema now lives in `brief-v3-response-schema.mjs`; the test asserts its contract, and a bounded live provider probe must pass before a full controlled run is attempted.

### Runtime-validator parity learning

- Cause: the first JSON Schema encoded field presence and types but omitted `strict: true`, slug patterns, and nonempty title constraints. JSON parsing succeeded, but all five candidates failed the stricter runtime validator.
- Detection gap: the initial compatibility probe checked only provider acceptance and top-level keys, not adversarial values at the provider-schema/runtime-validator boundary.
- Prevention: the provider schema now encodes strict mode, `maxItems`, slug patterns, and nonempty prevention titles. A live adversarial probe proves those exact constraints before another full run.

### Packet-persistence extraction learning

- Cause: the packet repository extraction created a raw `pg.Pool` and dropped the compiler's canonical connection-string resolver and Supabase TLS configuration.
- Detection gap: repository tests mocked the query client and never exercised pool construction or a live connection through the extracted adapter.
- Prevention: `buildPacketDatabaseConfig` is the single testable repository connection factory; a focused test asserts resolver/TLS options and a bounded live `select 1` proves the actual certificate path before a full run.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in for this implementation slice.
- [x] Incident learning is linked to `architecture.project-intelligence-runtime-ownership-drift`.
- [x] Deferred compiler/projection decomposition has cause, detection gap, prevention step, owner, and next action.
