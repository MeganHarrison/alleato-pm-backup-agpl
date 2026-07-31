# Task: AI Image-to-Prime-SOV Reconciliation

Status: Complete
Owner: Codex SROOTAI
Created: 2026-07-23
Task ID: LOCAL-AI-IMAGE-SOV-2026-07-23
Linear Issue: Not requested; single-session local incident repair
Related Handoff: N/A — single-session repair

## Objective

When a project user uploads a supported image containing Prime Contract SOV
rows, the PM assistant must read the image, keep that image available to
same-conversation follow-ups, and produce a confirmation-gated SOV edit preview
without asking for cost types that can be resolved unambiguously from the
project budget.

## Scope

- Wire the shared chat attachment validation, filtering, and capability owner
  into the production assistant handler.
- Preserve attachment-aware routing across the in-memory conversation.
- Reconcile a missing SOV cost type only when exact cost code and amount identify
  one active project budget code.
- Add regression coverage for the observed Nexcom transcript and fail-closed
  ambiguity behavior.
- Exclude attachment persistence across a browser reload; chat history currently
  persists text and metadata, not binary image parts.
- Exclude confirmation or mutation of any live Prime Contract SOV.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
  and `frontend/src/lib/ai/tools/write/prime-contract-tools.ts`
- Existing shared primitives/services:
  `frontend/src/lib/ai/chat-attachment-capabilities.ts`,
  `frontend/src/lib/ai/retrieval/planner.ts`, and project `budget_lines` /
  `project_budget_codes`
- Deprecated or parallel paths: handler-local `detectAttachments` logic

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] A valid supported image is forwarded to the vision-capable model after
      centralized validation.
- [x] A text-only follow-up in the same conversation remains attachment-aware
      and cannot short-circuit to the generic project briefing.
- [x] The exact Nexcom follow-up, “Are you not able to see the cost codes and
      amounts in the screen shot I uploaded?”, routes conversationally.
- [x] An SOV row with omitted cost type resolves only when normalized cost code
      plus exact amount identifies one active project budget-code/budget-line
      pair.
- [x] Zero or multiple exact project-budget matches fail with a specific,
      actionable message and make no write.
- [x] The existing preview/confirmation/atomic-write boundary remains intact.
- [x] No live SOV is mutated during verification.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
      handled when applicable.

Owned files:

- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `frontend/src/app/api/ai-assistant/chat/__tests__/chat-attachment-seam.test.ts`
- `frontend/src/lib/ai/retrieval/planner.ts`
- `frontend/src/lib/ai/retrieval/__tests__/planner.test.ts`
- `frontend/src/lib/ai/tools/write/prime-contract-tools.ts`
- `frontend/src/lib/ai/tools/write/prime-contract-tools.unit.test.ts`
- `frontend/src/lib/ai/tool-schemas/action-schemas.ts`
- `frontend/src/types/database.types.ts`
- This task and its evidence directory

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when
      applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and the exact `origin/main` commit is
      recorded.

## Failure-Loudly Contract

- Cause surfaced as: a 4xx attachment validation response, or an SOV preview
  error naming the row and whether no exact/unique active budget match exists.
- Detection path: attachment seam/planner unit tests and Prime Contract SOV
  resolver unit tests using the observed transcript and budget-code population.
- Recovery path: attach a supported image within size limits, or provide the
  missing cost type/project budget-code only when the project budget does not
  uniquely resolve the row.

## Incident Learning

- Failure fingerprint: `ai.feedback-write-project-briefing-collision`
  (existing packet-first routing-collision pattern); the independent SOV
  cost-type reconciliation subcase is recorded in this task.
- Root cause: Production retained handler-local, latest-message-only attachment
  detection while the shared whole-conversation vision capability owner was
  unused; the SOV resolver ignored exact project budget-line amount evidence
  when cost type was omitted.
- Detection gap: Tests covered the shared attachment module and the latest-turn
  planner flag separately, but no production-handler seam or exact multi-turn
  transcript connected them. SOV tests did not cover multiple cost types for one
  cost code with one exact project budget amount.
- Prevention: Make the shared attachment module the handler boundary and add
  transcript-level routing plus exact/ambiguous budget reconciliation tests.
- Guardrail evidence: 169 targeted tests plus focused ESLint passed; exact
  commands are recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Production `chat_history` and action-tool trace for session `39036b4e-ccad-453f-b6f1-26f40b1c4032` | Pass | Model extracted all 11 image rows; `editPrimeContractSov` blocked on row 1 missing exact active cost-type match; follow-up was routed to direct project briefing. |
| Budget boundary | Live read-only Nexcom project 1144 budget rows | Pass | Each screenshot code/amount maps to one project budget line and active project budget code, including `01-6500` / Expense / `$12,479`. |
| Supabase type gate | `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts` | Blocked | CLI reported: `Access token not provided`; existing generated types will be inspected before database-query edits. |
| Task setup | This task file | Pass | High-risk scope, acceptance, and no-live-write constraint captured before implementation. |
| Targeted regression | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/ai/__tests__/chat-attachment-capabilities.test.ts src/app/api/ai-assistant/chat/__tests__/chat-attachment-seam.test.ts src/lib/ai/retrieval/__tests__/planner.test.ts src/lib/ai/tools/write/prime-contract-tools.unit.test.ts` | Pass | 4 suites, 169 tests; includes exact Nexcom transcript and unique/zero/multiple project-budget matches. |
| Focused lint | `cd frontend && npx eslint src/app/api/ai-assistant/chat/handler-v2.ts src/app/api/ai-assistant/chat/__tests__/chat-attachment-seam.test.ts src/lib/ai/retrieval/planner.ts src/lib/ai/retrieval/__tests__/planner.test.ts src/lib/ai/tools/write/prime-contract-tools.ts src/lib/ai/tools/write/prime-contract-tools.unit.test.ts src/lib/ai/tool-schemas/action-schemas.ts` | Pass | No output. |
| Full typecheck | `cd frontend && npm run typecheck` | Blocked by unrelated repository debt | Existing errors include `fanout-client.tsx` missing `filteredDescription`, `feedback-inbox/page.tsx` invalid `selectedCount`, and pre-existing handler `error.message` / guardrail-code errors. The task diff does not touch those reported expressions; no SOV resolver error was reported. |
| Browser no-write proof | Local Next dev on port 3017 plus `agent-browser` | Blocked by environment | Next exhausted the machine file-watcher limit (`ENOSPC`) and showed a module-resolution build overlay. The server was stopped; no assistant request or SOV confirmation was sent. |
| Independent review | `docs/ops/evidence/2026-07-23-ai-image-prime-sov-reconciliation/independent-review.md` | Pass | Independent Codex reviewer found no blocking issues and approved the attachment, routing, cost reconciliation, and preserved financial write gates. |
| Verification contract | `verification-manifest.json` + `verification-result.json` | Pass | `Verification contract passed: PASS is supported by the declared evidence.` |
| Production deployment | `deployment-receipt.md` | Pass | Vercel deployment `dpl_96QFMtGAujJH2GMefd6RXweSbjJL` is `READY`; `projects.alleatogroup.com` resolves to it; deployed source is exact `origin/main` commit `c6756d1ebd8cf8a87a0192c3d4bc657350ad2931`. |
| Production image read | `production-live-followup.png` plus persisted response metadata | Pass | A synthetic PNG returned both rows and `IMAGE_CHAIN_723`; the planner recorded `reason: user_attachments_present`, `finish_reason: stop`, and `no successful tool calls`. |
| Production attachment follow-up | Same live conversation, without re-uploading the PNG | Pass | The exact failure-shaped follow-up returned both rows and `IMAGE_CHAIN_723` again; it routed as attachment-present financial analysis instead of a generic project briefing. No project context, financial confirmation, or write tool was used. |

## Remaining Risk

- Supported image bytes are present while the browser retains the current chat
  message parts; reloading reconstructs text-only history because binary
  attachments are not durably persisted. A separate storage-backed attachment
  persistence design is required for cross-reload vision follow-ups.
- The containerized automation browser intermittently reported a transport
  disconnect after receiving the first streamed status event even though
  production completed and persisted the answer with `stream_error: null`.
  Reloading displayed the canonical response. A raw diagnostic request showed a
  `200` response followed by a container-network read error; this also occurred
  for a plain text-only prompt, so it is recorded as a separate automation /
  streaming-transport risk rather than an image-path failure.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and
      next action.
