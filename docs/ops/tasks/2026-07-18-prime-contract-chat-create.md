# Task: Create Prime Contracts through AI Assistant chat

Status: Complete
Owner: Codex S195
Created: 2026-07-18
Task ID: AAI-1160
Linear Issue: AAI-1160 https://linear.app/megankharrison/issue/AAI-1160/create-prime-contracts-through-ai-assistant-chat
Related Handoff: `docs/ops/handoffs/2026-07-18-S195-prime-contract-chat-create.md`

## Objective

A project manager can create a real Prime Contract from the canonical AI Assistant conversation by reviewing a typed draft, explicitly approving the write, and opening the persisted contract on its canonical detail route.

## Scope

- Normalize manual, project-budget, and estimate-workbook SOV sources into one Prime Contract draft contract.
- Reuse the canonical Prime Contract form/API, workbook parser, attachment, assistant tool, approval, audit, idempotency, widget, and persistence owners.
- Preserve visible, editable defaults and show saved markups without applying them automatically.
- Persist draft, approval, receipt, and recovery states in the existing conversation/widget pipeline.
- Deliver task-owned commits to `origin/main` after rebase and verification.
- Exclude owner billing, change orders, invoice creation, automatic approval, a new chat route, and a standalone Prime Contract dashboard.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`, `frontend/src/lib/ai/tools/action-tools.ts`, `frontend/src/app/api/projects/[projectId]/contracts/route.ts`
- Existing shared primitives/services: `frontend/src/components/domain/contracts/ContractForm.tsx`, `frontend/src/hooks/use-create-prime-contract.ts`, `frontend/src/lib/ai/tools/write/commitment-tools.ts`, `frontend/src/lib/ai/assistant-widgets.ts`, `frontend/src/components/ai-assistant/assistant-widget-renderer.tsx`, `frontend/src/lib/prime-contracts/estimate-workbook-sov.ts`
- Deprecated or parallel paths: no new chat route, no copied ContractForm, no client-side workbook parser

Verification contract: Required

## Workflow Map

- User action: describe a Prime Contract in AI Assistant, select or supply SOV rows, review, approve, and open the created record.
- Frontend owner component: canonical AI Assistant chat area and assistant widget renderer.
- Shared primitive/component owner: existing assistant widget registry/rendering and AI Elements prompt input.
- Client state changed: AI SDK 7 UI message parts plus persisted `data-assistant-widget` metadata.
- API routes: canonical AI Assistant chat route; Prime Contract create, line-item, attachment, workbook preview, and template routes.
- Validation schemas: existing Prime Contract create schema plus proposed typed assistant input/output schemas.
- Service/helper: proposed shared Prime Contract creation service; existing workbook SOV helper.
- Supabase tables: `prime_contracts`, `contract_line_items`, existing attachment and AI write-audit/idempotency tables.
- Live DB assumptions: project IDs and contract foreign keys retain their generated types; the write-audit status constraint must permit the pending reservation state used by approved financial writes.
- Side effects on render: none. All writes require explicit approval.
- Bulk/import behavior: workbook preview remains server-side; selected rows enter one normalized creation boundary.
- Expected success evidence: contract/SOV DB readback, conversation reload, canonical detail route, desktop/tablet/mobile screenshots.
- Expected failure behavior: specific ambiguous owner, duplicate number, permission, invalid SOV, unmatched workbook, network retry, and partial-write states with recovery.

## Acceptance Criteria

- [x] A natural-language request produces a Prime Contract draft without writing data.
- [x] The draft resolves the project, owner, next contract number, visible defaults, and SOV source.
- [x] Manual SOV rows can be reviewed and corrected before approval.
- [x] Current project budget rows can be selected while preserving real budget-code links.
- [x] Estimate workbook attachments reuse the server-side preview/parser/template path.
- [x] Unmatched workbook rows and invalid/zero approved SOV values block approval.
- [x] Saved project markups are visible and are never added automatically.
- [x] Explicit approval is required and lists the exact planned writes.
- [x] The approved write uses the same domain service as the canonical form/API.
- [x] Contract-write permissions, duplicate prevention, audit, and idempotency are enforced.
- [x] Complete, partial, and failed results are distinguishable and actionable.
- [x] Draft, receipt, and recovery widgets render after conversation reload.
- [x] Success links to the canonical Prime Contract detail route.
- [x] Desktop, tablet, and mobile surfaces pass accessibility and product noise gates.
- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Regenerate and inspect current Supabase types before database code.
- [x] Shared Prime Contract creation service owns cross-cutting behavior.
- [x] Canonical form/API remain on the shared creation contract.
- [x] Prime Contract tool schemas and preview/approval/write behavior are registered.
- [x] Typed draft/receipt/recovery widget payloads use the current renderer and persistence envelope.
- [x] Manual, budget, and workbook source adapters normalize into one SOV contract.
- [x] Errors are specific and actionable.
- [x] Database, authentication, permission, audit, idempotency, and delivery contracts are handled.
- [x] No migration is added unless live evidence proves one is required.

## Integration and Verification

- [x] Focused service, API, tool, registry, widget, and persistence tests pass.
- [x] Targeted lint and changed-file type checks pass.
- [x] AI SDK 7 source/docs checks support every new API used.
- [x] Impeccable surface-complexity and noise-gate checks pass.
- [x] Agent-browser proves manual, budget, workbook, reload, canonical detail, and negative paths.
- [x] Database readback proves every persisted field and SOV link.
- [x] Desktop, tablet, and mobile evidence artifacts are recorded.
- [x] Independent functional verifier passes.
- [x] Independent visual verifier passes.
- [x] Independent evidence judge accepts the evidence.
- [x] Verification contract and strict review-queue checks pass.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: typed error/receipt states naming the failed stage, affected record or row, and whether a base contract exists.
- Detection path: tool trace, write audit, browser widget state, API log, targeted tests, and database readback.
- Recovery path: correct the draft, refresh the contract number, select an exact owner/budget code, request access, retry only missing writes, or open the canonical record for cleanup.

## Incident Learning

- Failure fingerprint: an approved write initially produced a partial receipt even though the contract and SOV were created; reload initially lost the structured receipt; blank optional model fields invalidated the approval signature after JSON transport; the live audit table rejected the new pending reservation state.
- Root cause: the audit reservation was inserted a second time instead of finalized, compact trace persistence discarded the widget/receipt fields, schema transforms converted blank wire values to `undefined` before signed JSON transport, and the database constraint still allowed only success/error statuses.
- Detection gap: unit-only seams did not exercise approval serialization, post-write audit finalization, conversation reload, or the live database constraint.
- Prevention: finalize the existing audit reservation, preserve typed receipt/widget trace keys, keep the signed wire schema JSON-stable, allow pending audits with a unique active-reservation index, and retain focused regressions plus live approval/reload proof.
- Guardrail evidence: `prime-contract-tools.unit.test.ts`, `action-tool-trace.test.ts`, `persisted-action-tool-parts.test.tsx`, `tool-approval-seam.test.ts`, and the reload screenshot.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Linear setup | AAI-1160 through AAI-1165 | Pass | Parent specification and tracer-bullet blockers created. |
| Approved prototype | `/Users/meganharrison/.codex/visualizations/2026/07/17/019f6fe9-89db-7493-9a15-251da0f90d43/prime-contract-chat-prototype.html` | Pass | Interaction target, not production proof. |
| Live schema/type gate | Supabase MCP TypeScript generation and live information-schema readback | Pass | Confirmed Prime Contract UUIDs, project bigint/TS number, SOV budget-code UUID links, generated totals, and write-audit/idempotency fields. Local CLI auth was unavailable; the tracked generated type file remained unchanged. |
| Shared creation boundary | Focused Jest, ESLint, changed-file type guard, independent review | Pass | 11/11 tests pass. Reviewer accepted after private-creator access, safe error mapping, and HTTP coverage were added. Full typecheck has 169 unrelated existing errors and none reference this slice. |
| Complete targeted regression suite | `pnpm exec jest --runInBand --runTestsByPath ...` plus focused owner/workbook/idempotency reruns | Pass | Delegated suite reported 13 suites / 168 tests pass before closeout; local reruns after reviewer-found regressions added owner/workbook/idempotency cases and passed. |
| Targeted static checks | changed-file ESLint; `pnpm run typecheck:changed` | Pass | No task-owned errors; one raw-search-input warning was independently reported in an existing renderer area. |
| Live approved write | owner-linked draft, approval, receipt, reload, canonical, tablet/mobile artifacts, and API readback | Pass | Current-revision approval created `PC-CHAT-20260718-0905` / `6e898363-025b-46d2-94c1-7af350af1eee`, linked exact owner `3 Quarterdeck LLC`, and finalized the audit as success. |
| Database/API readback | `database-readback.json` | Pass | Authenticated routes returned the owner IDs, title, contract number, $1,690 value, and both persisted SOV rows with HTTP 200 for the same `0905` contract. |
| Canonical detail | `manual-owner-canonical-sov-desktop.png`, `manual-owner-canonical-sov-rows-desktop.png` | Pass | Owner-linked canonical Prime Contract detail and SOV views show `PC-CHAT-20260718-0905`, `3 Quarterdeck LLC`, and the two SOV rows totaling $1,690. |
| Reload persistence | `manual-owner-receipt-reload-desktop.png` | Pass | The owner-linked draft and created receipt rehydrate from the persisted tool trace after refresh. |
| Budget/workbook browser proof | `budget-preview-desktop.png`; `workbook-invalid-blocked-desktop.png` | Pass | Project 1009 loaded two real budget rows totaling $66,000 without writing; canonical server preview blocked an invalid workbook with exact missing-sheet recovery. Positive valid workbook mapping is covered by parser/tool regressions. |
| Responsive visual proof | owner-linked desktop, tablet, and mobile screenshots | Pass | The same `0905` receipt remains readable, reachable, and overflow-free at all three viewports. |
| Audit migration | `20260718080910_allow_pending_ai_tool_write_audits.sql`; remote ledger/constraint/index readback | Pass | Applied through Supabase; pending/success/error status and one active pending/success key are enforced. The successful `0905` audit finalized on the same reservation row. |
| Independent review and verification contract | `independent-review.md`; `verification-result.json` | Pass | No remaining P0-P2 findings; exact evidence is bound to every manifest claim. |
| Publication | commits `69a293be2` and `8b375b0e1` | Pass | Implementation and migration/evidence closeout pushed to `origin/main`; remote equality verified after each publish. |

## Remaining Risk

- A valid production workbook mapping is covered by focused parser/tool tests; live browser proof intentionally covers the canonical invalid-workbook block because the available template lacked required estimate sheets.
- Full repo `tsc --noEmit` remains red on unrelated existing debt (169 errors in the completed delegated run); no error referenced this task's owned files.
- The mobile sticky composer can cover the bottom of a long receipt until the user scrolls; the full mobile screenshot proves all content remains reachable without overflow.
- The valid-workbook positive path remains data-dependent; the canonical invalid-workbook block and deterministic valid parser/tool tests protect the shipped behavior.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
