# Task: Realtime Workflow Builder

Status: Complete
Owner: Codex
Created: 2026-07-27
Task ID: realtime-workflow-builder
Linear Issue: N/A, single-session Standard delivery
Related Handoff: N/A

## Objective

Add a discoverable collaborative workflow editor under the canonical admin Actions surface.

## Scope

- Shared Supabase Realtime and Yjs synchronization hook.
- Editable React Flow builder at `/actions/workflows`.
- Entry point from the existing `/actions` owner.
- No workflow execution, database persistence, or provider schedule mutation.

## Source of Truth

- Canonical runtime/data owner: Supabase Realtime broadcast via the existing browser client.
- Existing shared primitives/services: `PageShell`, `Button`, `Input`, `frontend/src/lib/supabase/client.ts`.
- Existing flow implementation inspected: `frontend/src/features/ai-agents/ai-agent-dag.tsx`.
- Reuse incompatibility: `AiAgentDag` is intentionally read-only and disables node dragging and connections, so it cannot own a collaborative editor.
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Two clients can view and edit the same workflow session.
- [x] Nodes can be moved, connected, edited, added, and removed.
- [x] Synchronization failures are explicit and offer reconnect.
- [x] The builder uses the normal app shell and is discoverable from Actions.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared synchronization behavior is owned by a reusable hook.
- [x] Errors are specific and actionable.
- [x] Database persistence is explicitly excluded, so no migration is required.

## Integration and Verification

- [x] Targeted component tests pass.
- [x] Two-browser live proof confirms the interactive synchronization boundary.
- [x] Desktop and mobile screenshot evidence is stored with this task.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published through `codex:finish`.

## Failure-Loudly Contract

- Cause surfaced as: an inline collaboration error containing the provider or invalid-payload cause.
- Detection path: visible alert on the workflow canvas and targeted component test.
- Recovery path: `Reconnect` recreates the Yjs document and Supabase provider.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: Invalid synchronized node and edge payloads throw specific errors instead of being silently discarded.
- Guardrail evidence: Targeted tests and browser verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Unit test | `npm run test:unit -- --runTestsByPath src/components/workflows/__tests__/realtime-workflow-builder.test.tsx --runInBand` | Pass | 2 tests passed. |
| Targeted lint | `npx eslint` on the hook, builder, test, and route | Pass | No errors or warnings in the new boundary. |
| Route names | CRLF-normalized `scripts/check-route-conflicts.sh` | Pass | Reported `No route conflicts found`; the direct npm wrapper cannot parse the checkout's CRLF shell script on Windows. |
| Focused types | Temporary focused TypeScript project | Related files pass | Only reported existing `src/components/ai-chat/sheet-editor.tsx:146`; no realtime-flow file errors. |
| Full types | `node scripts/run-typecheck-bounded.mjs` | Unrelated repo debt | Fails across existing admin, API, AI, daily brief, drawing, and service owners; no task-owned file appeared in the reported errors. |
| Live collaboration | Two `agent-browser` sessions against the production component | Pass | A title edit and an added step appeared in the second client within 800 ms. |
| Desktop visual | `docs/ops/evidence/realtime-workflow-builder/desktop.png` | Pass | Current 1440 × 900 component capture. |
| Mobile visual | `docs/ops/evidence/realtime-workflow-builder/mobile.png` | Pass | Current 390 × 844 capture; mobile defaults to a readable zoom and horizontal canvas panning. |
| Product route authorization | `/actions/workflows` with normal E2E identity | Pass | Redirected to `access-denied?reason=admin-dashboard-allowlist`; admin permission boundary remains intact. |

## Remaining Risk

- Persistence is intentionally excluded. The shared room resets to the template when no collaborator retains the live Yjs document.
- Exact in-shell page capture requires a configured `ADMIN_E2E_EMAIL` and `ADMIN_E2E_PASSWORD`; the production component itself was verified in the temporary browser harness without weakening authorization.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No deferred database or provider operation is required.
