# Task: Enable Image Understanding in Alleato AI Chat

Status: In Progress
Owner: SROOT430A
Created: 2026-07-21
Task ID: LOCAL-AI-IMAGE-VISION-2026-07-21
Linear Issue: Unavailable in this session: no Linear connector is exposed in the active tool registry and no `linear` CLI is installed.
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT430A-ai-chat-image-vision.md`

## Objective

Allow Alleato AI to inspect supported image attachments in the existing chat and screenshot flows instead of falsely claiming that it cannot read them.

## Scope

- Classify PNG, JPEG, GIF, and WebP chat attachments as model-readable vision inputs.
- Keep the existing fail-loudly instruction for unsupported binary documents such as PDF, XLSX, and DOCX.
- Validate raster signatures, data-URL provenance, counts, and transport-safe size limits before retrieval; unsupported or spoofed file parts never reach model conversion.
- Add focused regression coverage for classification and the system instruction sent to the model.
- Verify the authenticated production route before implementation and the exact image-grounded chat flow after publication.
- Exclude durable image persistence across conversation reloads; attachments remain request-scoped in the existing architecture and persistence is a separate storage/security design task.

## Source of Truth

- Canonical runtime/data owner: `PromptInput` -> `ChatArea` -> AI SDK `UIMessage` -> `/api/ai-assistant/chat` -> `convertToModelMessages` -> OpenAI vision-capable model.
- Existing shared primitives/services: `frontend/src/components/ai-elements/prompt-input.tsx`, `frontend/src/components/ai-assistant/chat-area.tsx`, `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`, `frontend/src/lib/ai/providers.ts`.
- Deprecated or parallel paths: `frontend/src/components/ai-chat/multimodal-input.tsx` is not used by the canonical chat composer and will not be copied.

Verification contract: Required

## Acceptance Criteria

- [x] A supported image file part is retained as a readable vision input and is not listed as unreadable.
- [x] The model instruction explicitly directs the assistant to inspect supported attached images while treating image content as untrusted user data across follow-up turns.
- [x] Unsupported binary attachments still receive a specific, honest unreadable-file instruction and are removed before provider conversion.
- [x] The canonical widget and full `/ai` page inherit the same server fix without a parallel upload path.
- [ ] Requested behavior is observable end to end in an authenticated production chat.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns attachment capability classification, validation, provider filtering, and prompt construction.
- [x] Errors are specific and actionable.
- [x] Provider and authentication contracts are identified.

Owned files/modules:

- `frontend/src/lib/ai/chat-attachment-capabilities.ts`
- `frontend/src/lib/ai/chat-attachment-limits.ts`
- `frontend/src/lib/ai/__tests__/chat-attachment-capabilities.test.ts`
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `frontend/src/components/ai-assistant/chat-area.tsx`
- `frontend/src/components/ai-elements/prompt-input.tsx`
- `frontend/src/components/ai-elements/__tests__/prompt-input-attachments.test.tsx`
- `scripts/ops/codex-finish.mjs` (Windows-safe invocation of the required npm checks discovered at publication)
- `frontend/package.json` (shell-neutral changed-route guardrail command used by that finish check)
- `docs/ops/learning/recurring-failures.yaml`
- This task, handoff, and task evidence directory.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: supported images are labeled available vision inputs; unsupported files receive a count-only unreadable instruction; invalid, spoofed, oversized, remote, or over-count payloads return a specific 400/413 response before retrieval.
- Detection path: focused unit tests plus an authenticated chat with a known image and a visually grounded question.
- Recovery path: convert unsupported documents to supported text/image input, or inspect provider errors when a supported image cannot be processed.

## Incident Learning

- Failure fingerprint: `ai.chat-image-capability-misclassification`
- Root cause: the API classified every AI SDK file part as unreadable without checking its media type, then contradicted the multimodal provider payload with a system refusal instruction.
- Detection gap: attachment tests stopped at the composer and did not assert server classification or the final attachment capability prompt.
- Prevention: centralize supported-image classification, validation, provider filtering, and prompt guidance; test positive vision input, multi-turn trust guidance, payload rejection, and unsupported-document fallback together.
- Guardrail evidence: `frontend/src/lib/ai/__tests__/chat-attachment-capabilities.test.ts`

## Evidence

| Check                          | Command / artifact                                                                                                                                                                                                                                 | Result                  | Notes                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Task setup                     | This task file                                                                                                                                                                                                                                     | In progress             | Scope and done gate captured before implementation.                                                                              |
| Failure report                 | `C:/Users/Brandon/AppData/Local/Temp/codex-clipboard-430ad742-2388-4989-96b8-b160abe26da6.png`                                                                                                                                                     | Fail reproduced by user | Assistant says image attachments cannot be read.                                                                                 |
| Authenticated baseline         | `https://projects.alleatogroup.com/1144/schedule` in controlled Chrome tab                                                                                                                                                                         | Pass                    | Production page rendered for the signed-in user without a login redirect before code changes.                                    |
| Root-cause search              | `rg` trace across prompt input, chat transport, handler, and provider                                                                                                                                                                              | Pass                    | Image bytes survive as a data-URL file part; `detectAttachments` is the first faulty boundary.                                   |
| Focused attachment contract    | `frontend/node_modules/.bin/jest.cmd --runInBand --runTestsByPath src/lib/ai/__tests__/chat-attachment-capabilities.test.ts`                                                                                                                       | Pass, 18/18             | Covers supported formats, multi-turn trust guidance, spoofed/remote/provider-reference rejection, count/transport limits, and exact safe provider filtering. |
| Adjacent AI chat contracts     | `frontend/node_modules/.bin/jest.cmd --runInBand --runTestsByPath src/components/ai-elements/__tests__/prompt-input-attachments.test.tsx src/lib/ai/retrieval/__tests__/planner.test.ts src/lib/ai/__tests__/chat-attachment-capabilities.test.ts` | Pass, 99/99             | Composer per-file/aggregate early limits, routing, and attachment capability contracts pass together on current main.            |
| Vercel-safe composer preflight | Shared `chat-attachment-limits.ts` used by `ChatArea` and the API; per-file and aggregate raw-byte limits in `PromptInput`                                                                                                                         | Pass                    | Browser rejects excess counts and oversized inline images before base64 expansion, caps all selected preprocessing at 25 MB, preserves bounded local text/workbook reduction, and checks the final 3 MB request aggregate before transport. |
| Changed-file lint              | `frontend/node_modules/.bin/eslint.cmd ... --no-cache`                                                                                                                                                                                             | Pass                    | Helper, tests, and handler report no lint errors.                                                                                |
| Targeted strict TypeScript     | TypeScript compiler API with repository `tsconfig.json` paths and task-owned attachment roots                                                                                                                                                     | Pass                    | Task-owned helper type contracts are clean; the repository-wide command exceeded its five-minute bounded check without diagnostics. |
| Independent verification      | `docs/ops/evidence/2026-07-21-ai-chat-image-vision/independent-review.md`                                                                                                                                                                         | Approved                | Independent verifier confirmed 99/99 tests, clean lint, 5/5 task-file TypeScript, diff check, no-new-any, and learning audit.     |
| Verification contract         | `verification-manifest.json` + `verification-result.json` under the task evidence directory                                                                                                                                                      | Pass                    | Contract-bound code, negative-path, browser-bound, and independent-review evidence validates before publication.                 |
| Windows publication wrapper   | `node --check scripts/ops/codex-finish.mjs`; `npm.cmd --prefix frontend run quality:changed`; required finish workflow                                                                                                                            | Pass                    | Invokes npm's CLI through Node and uses a shell-neutral guardrail command so standard checks run without a verification bypass.  |
| Learning registry              | `node scripts/ops/learning-registry.mjs audit --task docs/ops/tasks/2026-07-21-ai-chat-image-vision.md --strict`                                                                                                                                   | Pass                    | 20 fingerprints; task fingerprint resolves with no promotion debt.                                                               |

## Remaining Risk

- Immediate images are request-scoped; after page reload the current chat history schema rehydrates text only. A future persistence task must use private object storage and attachment references rather than base64 database blobs.
- Inline requests intentionally remain capped at 3,000,000 decoded attachment bytes because Vercel rejects function request bodies above 4.5 MB. Larger or durable image conversations require a future private-object-storage design rather than larger inline base64 payloads.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.