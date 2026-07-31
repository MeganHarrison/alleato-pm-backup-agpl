# Task: Eve Tool Runtime Repairs

Status: In Progress
Owner: Codex
Created: 2026-07-31
Task ID: AAI-EVE-TOOL-RUNTIME-REPAIRS
Linear Issue: Coordinated under the active AI Tools Verification task; no separate issue requested.
Related Handoff: Active AI Tools Verification coordinator task.

## Objective

Repair runtime defects found by strict end-to-end Eve tool verification and
prove each repaired tool with a real authenticated assistant result, persisted
tool trace, and dedicated screenshot.

## Scope

- Acumatica cash-position Payment and Check field contract.
- Project risk-analysis project label and source citation.
- Project-scoped `findProject` communication retrieval and RAG indexing.
- Specification-query relevance filtering.
- Governed read-tool normalization for Eve's `projectId: 0` sentinel.
- Interrupted Eve-session continuation cursor persistence.
- Atomic local Eve cursor persistence when browser storage writes fail.
- Company-wide marketing/workspace reads in a project-pinned chat.
- Compact, traceable Daily Executive Brief evidence serialization.
- Acumatica company-report catalog scope and missing scalar normalization.
- Focused regressions and recurring-failure guardrails.

## Source of Truth

- Canonical runtime/data owner: `agents/alleato-assistant` plus the signed Eve
  bridge in `frontend/src/app/api/ai-assistant/eve/tools/route.ts`.
- Existing shared primitives/services:
  `frontend/src/lib/acumatica/client.ts`,
  `frontend/src/lib/ai/tools/project-tools.ts`.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `getCashPositionReport` returns live numeric totals without a nested error.
- [x] `getProjectRiskAnalysis` returns a non-empty project name and source label.
- [x] `findProject` returns project-scoped documents and emails without nested
  statement-timeout errors or mislabeled generic Graph attachments.
- [x] `getSpecRequirements` does not present unrelated spec attachments as
  requirements for the requested topic.
- [x] `getSubmittalLog` completes without an earlier hidden tool error in the
  same Eve turn.
- [x] `extractStructuredActionBrief` returns typed actions, risks, decisions,
  and data gaps without a nested error.
- [x] An interrupted snapshot cannot overwrite a resumable Eve cursor with a
  tokenless remote session.
- [x] A failed primary and fallback browser-storage write cannot erase the last
  resumable Eve cursor.
- [x] Unscoped marketing and workspace reads remain company-wide in a
  project-pinned chat.
- [x] Daily Brief output includes only cited source evidence, with stable IDs
  and URLs, rather than the complete uncovered-source inventory.
- [x] Company-wide Acumatica reports are available without an Alleato project
  pin.
- [x] Missing Acumatica dates and descriptions serialize as `null`, not `{}`.
- [x] All repaired tools have dedicated, visually inspected screenshots.
- [x] All repaired tools have exact persisted `output-available` traces.
- [x] The RAG expression index is applied and read back from the live RAG
  Supabase project.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting project label behavior.
- [x] Errors are specific and actionable.
- [x] Provider contracts are handled using controlled live probes.

## Integration and Verification

- [x] Targeted unit checks pass.
- [x] Actual user-flow readback proves all repaired outcomes.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: persisted tool output containing either a nested `error`
  or a blank canonical source label.
- Detection path: authenticated `/ai` run, dedicated screenshot, and
  `/api/ai-assistant/messages/<session>?surface=alleato_ai` trace readback.
- Recovery path: localize the first provider or adapter boundary, repair the
  canonical owner, run the focused regression, then repeat the same real Eve
  request.

## Incident Learning

- Failure fingerprint: `ai.acumatica-application-date-contract-drift`
- Failure fingerprint: `ai.empty-project-label-source-citation`
- Failure fingerprint: `ai.unscoped-project-communication-retrieval`
- Failure fingerprint: `ai.spec-query-false-positive`
- Failure fingerprint: `ai.read-project-zero-sentinel`
- Failure fingerprint: `ai.eve-unscoped-tool-hidden-by-project-gate`
- Failure fingerprint: `ai.daily-brief-uncovered-sources-counted-as-cited`
- Failure fingerprint: `ai.acumatica-empty-wrapper-leaks-to-tool-output`
- Root cause: Acumatica exposes `ApplicationDate`, not `Date`, and empty
  optional project names bypassed nullish fallback.
- Detection gap: registration and type coverage did not prove the live provider
  field set or Eve's empty-string input shape.
- Prevention: exact provider-select tests, shared label normalization, and
  persisted-trace plus screenshot proof.
- Guardrail evidence:
  `frontend/src/lib/acumatica/__tests__/cash-position.test.ts` and
  `frontend/src/lib/ai/tools/__tests__/project-risk-source.test.ts`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Acumatica field probes | Live `$top=1` Payment and Check requests selecting each field independently | Pass | `Date` returned HTTP 500; `ApplicationDate` was present in both base payloads. |
| Cash-position regression | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/acumatica/__tests__/cash-position.test.ts` | Pass | Exact select and 90-day rollup guarded. |
| Cash-position browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getCashPositionReport-passed.png` | Pass | Live inflows, outflows, net cash flow, and 90-day window visible. |
| Cash-position trace | Session `311b56d5-6037-4a42-83fb-c0c0ee91c9da` | Pass | `getCashPositionReport`, `output-available`, no nested error. |
| Project-label regression | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/tools/__tests__/project-risk-source.test.ts` | Pass | Empty input falls back to persisted name. |
| Risk-analysis browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getProjectRiskAnalysis-passed.png` | Pass | Exact risk counts and Union Collective source card visible. |
| Risk-analysis trace | Session `311b56d5-6037-4a42-83fb-c0c0ee91c9da` | Pass | Latest trace returns `project.name=Union Collective` and a complete source reference. |
| `findProject` focused regression | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/tools/read/__tests__/find-project-search-scope.test.ts` | Pass | Resolved project ID reaches all three searches; generic Graph content is excluded from Teams. |
| RAG project index migration | `20260731011000_index_rag_chunks_by_project_and_source.sql` | Pass | Live ledger records `20260731045805 index_rag_chunks_by_project_and_source`; index definition read back from `pg_indexes`. |
| `findProject` browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\findProject-passed-full.png` and `findProject-passed.png` | Pass | Project 1009, 4 documents, 6 emails, truthful zero Teams result, no nested errors. |
| Spec relevance regression | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/tools/__tests__/document-intelligence.spec-sources.test.ts` | Pass | Unrelated spec attachments cannot satisfy a topic query. |
| Spec requirements browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getSpecRequirements-passed.png` | Pass | Truthful zero-result response for concrete; no false requirements or nested errors. |
| Supabase type generation gate | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Blocked | Configured CLI token has legacy/invalid format. Existing generated file was restored immediately; live RAG column types were verified through the authenticated Supabase connector before DDL. |
| Read sentinel bridge regression | `cd frontend && npx jest --runInBand --runTestsByPath src/app/api/ai-assistant/eve/tools/__tests__/route.test.ts` | Pass | 20/20; read-only project ID zero normalizes to the signed project while write, zero-sentinel write, and positive-mismatch guardrails remain enforced. |
| Submittal browser proof | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getSubmittalLog-passed.png` | Pass | Session `bda16fe6-7ec9-4f7d-a239-70dbf981124b`; exactly one `getSubmittalLog` attempt, `output-available`, project 1009, truthful zero-result payload, and no nested error. |
| Structured-brief browser proof | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\extractStructuredActionBrief-passed.png` | Pass | Session `00b9568f-f6ba-47d4-aab2-77888241ee44`; one `extractStructuredActionBrief` attempt, `output-available`, typed action/risk/decision/data-gap output, and no nested error. |
| Eve first-turn cursor capture | Browser response and local-storage readback | Pass | Initial POST returned `continuationToken`, `sessionId`, and HTTP 202; completed state persisted `continuationToken`, `sessionId`, and `streamIndex=152`. |
| Interrupted-cursor regression | `cd frontend && pnpm exec jest src/hooks/__tests__/use-alleato-eve-chat-session.test.ts --runInBand` | Pass | 5/5; a tokenless interrupted snapshot retains the prior same-session token, cannot borrow another session's token, and is rejected when it is not resumable. |
| Daily Brief compact serializer | `cd frontend && pnpm exec jest src/lib/ai/tools/__tests__/executive-brief-tools.test.ts --runInBand` | Pass | Uncovered source inventories are excluded while claim-bearing aliases retain stable source IDs, project IDs, and URLs. |
| Daily Brief browser proof | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\readCurrentDailyExecutiveBrief-traceable-passed.png` | Pass | Session `5e7dea4e-6665-4702-bd3e-d4b99bbfcd73`; 224 available sources, 47 cited sources, 59,763-byte output, no tool error. |
| Pinned company-read browser proofs | `getMarketingCalendar-pinned-passed.png`; `listWorkspaceArtifacts-pinned-passed.png` in the evidence directory | Pass | Explicit null project filters remained company-wide in a Union Collective-pinned chat. |
| Acumatica catalog scope regression | `cd frontend && pnpm exec jest src/lib/ai/eve-runtime/__tests__/production-tool-registry.test.ts --runInBand` | Pass | 7/7; all nine ERP reports remain available without an Alleato project pin while true project-scoped tools remain hidden. |
| Acumatica scalar regression | `cd frontend && pnpm exec jest src/lib/ai/tools/__tests__/acumatica-project-budget.test.ts --runInBand` | Pass | Missing wrapped dates and budget-line descriptions normalize to `null`. |
| Acumatica AP aging browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getAPAgingReport-passed.png` | Pass | Session `139ed842-428e-49c5-8d37-a30b406e3e4d`; live $21,120 AP balance, clean trace. |
| Acumatica AR aging browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getARAgingReport-passed.png` | Pass | Session `afbad12e-f187-424d-9e92-7f515f4ccb47`; live $1,034,777.16 AR balance, clean trace. |
| Acumatica company report browsers | `getCashPositionReport-passed.png`; `getVendorSpendReport-passed.png`; `getRecentBills-passed.png`; `getRecentInvoices-passed.png` | Pass | Fresh one-turn Eve sessions returned live ERP data with no hidden tool errors; final invoice proof emits missing due dates as `null`. |
| Acumatica project/PO browsers | `getAcumaticaProjectList-passed.png`; `getAcumaticaProjectBudget-passed.png`; `getPurchaseOrderSummary-passed.png` | Pass | Live 96-project list, project 26119 budget, and ten purchase orders. Missing PO vendor/per-record billed fields were disclosed rather than invented. |
| Margin analysis browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getMarginAnalysis-passed.png` | Pass | Session `fba2da0f-65ec-4e33-a592-f587e30cfb80`; Union Collective margin inputs and source reference returned without errors. |
| Finance spend rollup browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getFinanceSpendRollup-passed.png` | Pass | Session `ab918dd1-7c71-4e85-bc7a-20fd2b03f46a`; live Acumatica AP-bill rollup and classification evidence returned without errors. |
| Financial analysis browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getFinancialAnalysis-passed.png` | Pass | Session `a801dfcd-4afb-416c-bfd6-59fc09be4708`; Union Collective contract and receivables fields returned, missing cost fields were disclosed, and the trace contained no error. |
| Schedule-task browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\queryScheduleTasks-passed.png` | Pass | Session `5129c78a-7b55-42a5-8e9d-b15a1d647402`; project 1009 resolved, the truthful zero-task payload was `output-available`, and no error was hidden. |
| Schedule-analysis browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getScheduleAnalysis-passed.png` | Pass | Session `c2e0d76c-412a-4195-9670-72c6ed86d540`; project 1009 resolved with a truthful empty schedule summary and no tool error. |
| Portfolio-risk browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getProjectsWithRisks-passed.png` | Pass | Session `bf5788fe-fcae-4bfe-95b9-823c8e169582`; 15 current projects evaluated, 13 returned with risk signals and source references, and no tool error. The first two attempts exposed missing local Eve bridge URL/secret wiring; both processes were restarted with one shared secret and explicit app/Eve URLs before this clean retest. |
| Meeting-details browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getMeetingDetails-passed.png` | Pass | Session `2f9cbe4b-4f48-4017-8102-cc87afc44d82`; the real Union Collective OAC meeting returned its ID, date, participants, decisions, summary, project identity, and source reference with no tool error. |
| Submittal-status browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getSubmittalStatus-passed.png` | Pass | Session `8a7de600-9d59-484f-8e90-2d1f85cea7e5`; project 1009 resolved and returned a truthful zero-submittal status payload with no tool error. |
| Document-row browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\queryDocumentRows-passed.png` | Pass | Session `86a79fe9-12ca-44ed-8aee-7bc3c4ae72ff`; a real Westfield Collective dataset returned all three structured rows with IDs and source context, with no tool error. |
| Live testing registry | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\eve-tool-testing-registry-live-20260731.png` | Pass | `http://localhost:3012/ai/testing`; 131 canonical tools, 68 passed, 2 need retest, 4 blocked, 57 not tested, and 34 mapped screenshots after strict natural-language browser proof. |
| Testing-registry regression | `cd frontend && pnpm exec jest --runInBand "src/features/eve-tool-testing/__tests__/eve-tool-test-registry.test.ts"` | Pass | 1 suite, 4 tests; canonical names and evidence mappings remain valid. |
| Testing-registry lint | `cd frontend && pnpm exec eslint "src/features/eve-tool-testing/eve-tool-test-registry.ts" "src/features/eve-tool-testing/eve-tool-testing-table-config.tsx" "src/features/eve-tool-testing/eve-tool-testing-page.tsx" "src/app/(main)/ai/testing/page.tsx" --no-cache` | Pass | No findings. |
| Change-order-details browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getChangeOrderDetails-passed.png` | Pass | Session `41e5f432-c01b-4687-b3d6-84fd8c516c45`; project 1009 returned a truthful zero-change-order payload and source reference with no tool error. |
| Commitments-overview browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getCommitmentsOverview-passed.png` | Pass | Session `6e669000-7a39-4dcd-90b4-00683be80892`; 10 real Union Collective purchase orders returned with IDs, vendors, statuses, and source evidence, with no tool error. |
| Direct-costs browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getDirectCostsSummary-passed.png` | Pass | Session `7de35ac0-01e8-4cdc-bd3f-2954e512220b`; six approved invoices totaling $84,171.17 returned with vendors, IDs, dates, and source evidence, with no tool error. |
| Forecast-comparison browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getForecastComparison-passed.png` | Pass | Session `91d5f22a-8bd6-454f-9ea9-4ac08d6bd7e3`; 12 real budget lines and a $256,000 revised budget returned; unavailable committed, actual, and projected-final-cost fields were disclosed without fabrication. |
| RFI-status browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getRFIStatus-passed.png` | Pass | Session `94f30a4f-294f-46a3-89a2-4d52cbc97627`; Union Collective project 1009 returned one real open and overdue RFI, its due date, responsible party, impacts, and source reference. The persisted trace reached `output-available` with no tool error. |
| Vendor-performance browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getVendorPerformance-passed.png` | Pass | Session `cc51dae7-eb57-4b1b-8204-95188cd2fd62`; the repaired unscoped catalog exposed `getVendorPerformance`, and Eve returned 105 real vendors across 200 contracts. The trace reached the exact named `output-available` state with no hidden tool error; the zero-valued contract totals were disclosed as a data limitation. |
| Domain-intelligence browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getDomainIntelligence-passed.png` | Pass | Session `2fa74d56-341c-493d-bec5-67f934153c3b`; the human prompt asked what was happening with accounting. Eve autonomously selected `getDomainIntelligence`, returned the accounting synthesis and recurring issues, disclosed that the packet was stale, and reached exact `output-available` with no hidden tool error. |
| Missing-submittals browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\detectMissingSubmittals-passed.png` | Pass | Session `b77831a2-6195-4435-8999-68189cfa9d8d`; a natural-language question named Vermillion Rise Warehouse and Eve selected the exact tool with a completed result. |
| Submittal-drawing review browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\reviewSubmittalAgainstDrawings-passed.png` | Pass | Session `82ce2deb-d3eb-4988-8a88-46b91ad750a2`; Eve reviewed the named Vermillion Rise Warehouse submittal and truthfully disclosed the available drawing-data limitation. |
| Project-budget browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getProjectBudgetSummary-passed.png` | Pass | Session `a07bc689-07cf-4084-bb1b-b78b1f598df3`; a natural Union Collective question returned the real $256,000 budget-line total. |
| People-and-roles browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getPeopleAndRoles-passed.png` | Pass | Session `c7283393-6d9b-43e7-99b7-9ed7b47f0f7c`; a natural Vermillion Rise Warehouse question returned the project team in a visible table. |
| Consolidated focused regression | Seven targeted Jest suites | Pass | 43/43 covering the bridge, registry scope, cursor persistence, marketing/workspace unscoping, compact brief evidence, and Acumatica scalar contracts. |
| Task-owned lint | `cd frontend && pnpm exec eslint <15 task-owned TypeScript files>` | Pass | No lint findings. |

## Remaining Risk

- Publication is blocked by the same independently diverged canonical
  `main`/`origin/main` state documented in
  `docs/ops/tasks/2026-07-31-eve-acumatica-project-budget.md`; publishing only
  these files would create another partial Eve-runtime reconciliation.
- The CLI type-generation credential remains invalid; this did not block the
  authenticated connector migration or live schema/index readback.
- A cold Next.js development compile briefly returned 404 for a newly created
  session route and forced a full reload. The warmed, established-session retest
  passed, but the interrupted-turn cleanup also exposed a separate
  `durable_ai_turns_status_check` cancellation defect that remains to be
  localized before the verification harness can be considered interruption-safe.
- The Workflow 4.0.9 eager development watcher ignores `.next/` but not the
  port-scoped `.next-dev-*` output used by concurrent local servers. Generated
  Next output therefore caused recursive workflow rebuilds and full `/ai`
  reloads. Workflow's official `lazyDiscovery` mode was tested and immediately
  removed because it requires Next `16.2.0-canary.48`, while this repo is on
  Next `15.5.12`. The production runtime is unaffected; stable local E2E still
  requires a warmed route until the vendor/version boundary is reconciled.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred work names its cause, owner, and next action.
