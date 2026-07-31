# Task: Restore AI Assistant Tool Schema Compatibility

Status: Complete
Owner: Codex S-ai-commitment-verify
Created: 2026-07-30
Task ID: LOCAL-AI-COMMITMENT-PROVIDER-SCHEMA-20260730
Linear Issue: Not requested; local verification discovered the blocker.
Related Handoff: N/A, single-session canonical-main work.

## Objective

Create a commitment through the authenticated Alleato AI chat with the same preview, explicit confirmation, write, and readback contract as create-change-event.

## Scope

- Provider-compatible AI tool input schemas and the shared email primitive.
- Authenticated commitment preview, confirmation, write, and readback evidence.
- Excludes unrelated existing merge conflicts and Velt configuration warnings.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` and `frontend/src/lib/ai/tools/write/commitment-tools.ts`
- Existing shared primitives/services: `frontend/src/lib/ai/tool-schemas/`, `frontend/src/lib/ai/tool-descriptors.ts`, signed tool approval
- Deprecated or parallel paths: N/A

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] A commitment request reaches `createCommitment` and renders a preview before any write.
- [x] Explicit confirmation creates exactly one Draft commitment.
- [x] The created record is visible through an authenticated commitments readback.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate schema paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Provider and approval contracts are handled.

Owned files:

- `frontend/src/lib/ai/tool-schemas/provider-compatible.ts`
- `frontend/src/lib/ai/tool-schemas/action-schemas.ts`
- `frontend/src/lib/ai/tool-schemas/outlook-schemas.ts`
- `frontend/src/lib/ai/tools/write/company-contact-tools.ts`
- `frontend/src/lib/ai/tools/write/commitment-tools.ts`
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts`
- `frontend/src/lib/ai/__tests__/provider-tool-schema-compatibility.test.ts`
- `docs/ops/learning/recurring-failures.yaml`
- This task file

## Integration and Verification

- [x] Targeted schema and action-tool checks pass.
- [x] Authenticated live chat proof passes.
- [x] Created commitment and audit/readback evidence are recorded.
- [x] Independent review passes.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: assistant note plus server log naming the unsupported JSON Schema path.
- Detection path: authenticated `/ai` request and provider schema-compatibility regression test.
- Recovery path: use the shared provider-compatible email schema for every AI tool input.
- Blank optional commitment dates are normalized at the write boundary; invalid nonblank dates still fail schema validation.

## Incident Learning

- Failure fingerprint: `ai.provider-tool-schema-lookaround`
- Related failure fingerprint: `ai.commitment-blank-optional-date`
- Root cause: Zod email validation serialized provider-rejected regex lookarounds; blank chat date fields crossed into nullable database columns as empty strings.
- Detection gap: tests never serialized the full provider-facing registry and did not cover the chat form's empty-string date representation.
- Prevention: shared provider-compatible schemas plus registry serialization, source-usage guards, and exact nullable commitment payload assertions.
- Guardrail evidence: `frontend/src/lib/ai/__tests__/provider-tool-schema-compatibility.test.ts`, `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts`

## Evidence

| Check                      | Command / artifact                                                                                                                                        | Result        | Notes                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| Initial authenticated chat | `artifacts/ai-commitment-verification-2026-07-30/01-config-failure.png`                                                                                   | Failed loudly | Missing/short local approval secret; no write occurred.                                                  |
| Provider retry             | `artifacts/ai-commitment-verification-2026-07-30/dev-3080-restart.stderr.log`                                                                             | Failed loudly | Provider rejected `$.properties.emailAddress.pattern` lookaround before tool execution.                  |
| Provider schema regression | `cd frontend && npm.cmd run test:unit -- --runInBand --runTestsByPath src/lib/ai/__tests__/provider-tool-schema-compatibility.test.ts`                    | Passed        | 5 tests; provider-safe registry plus blank/valid/invalid commitment date behavior.                        |
| Action-tool regression     | `cd frontend && npm.cmd run test:unit -- --runInBand --runTestsByPath src/lib/ai/tools/__tests__/action-tools.test.ts`                                    | Passed        | 25 tests, including create-change-event parity and commitment preview/write behavior.                    |
| Fixed commitment draft     | `artifacts/ai-commitment-verification-2026-07-30/05-fixed-commitment-draft-preview.png`                                                                   | Passed        | Authenticated draft rendered before write.                                                               |
| Signed approval            | `artifacts/ai-commitment-verification-2026-07-30/06-fixed-tool-approval.png`                                                                              | Passed        | Write remained gated by explicit user approval.                                                          |
| Chat success               | `artifacts/ai-commitment-verification-2026-07-30/07-commitment-created-chat.png`                                                                          | Passed        | Chat reported subcontract `SC-1773771075150448` created.                                                 |
| Authenticated API readback | `artifacts/ai-commitment-verification-2026-07-30/11-api-readback-payload.png`                                                                            | Passed        | Exactly one record, id `a10eed2e-91b1-41e5-8b67-06d8d62f3111`, expected vendor/title/status/description. |
| Commitments route readback | `artifacts/ai-commitment-verification-2026-07-30/08-created-commitment-readback.png`                                                                      | Passed        | `/767/commitments` shows the created Draft row in the real app shell.                                    |
| Final-route screenshots    | `artifacts/ai-commitment-verification-2026-07-30/09-final-readback-after-last-change.png`, `10-final-chat-after-last-change.png`                          | Passed        | Captured after the last product-code change from the authenticated list and persisted chat session.      |
| Post-review screenshots    | `artifacts/ai-commitment-verification-2026-07-30/12-final-chat-after-review-fix.png`, `13-final-readback-after-review-fix.png`                            | Passed        | Captured after the independent-review date-schema fix.                                                    |
| Independent review         | Reviewer verdict after malformed-date guardrail and API payload follow-up                                                                                 | Passed        | No remaining blocking correctness or security finding.                                                    |

## Remaining Risk

- No SOV items were requested, so the verified commitment has a $0 value. The tool explicitly disclosed that outcome and advised adding SOV lines before approval routing.
- The canonical checkout has unrelated merge conflicts; publication must fail loudly if exact-file publication cannot proceed.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
