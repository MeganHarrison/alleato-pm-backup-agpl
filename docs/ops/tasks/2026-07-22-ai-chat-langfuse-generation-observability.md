# Task: Restore AI Chat Generation Observability

Status: In Progress
Owner: Codex
Created: 2026-07-22
Task ID: AI-CHAT-LANGFUSE-2026-07-22
Linear Issue: Unavailable: no Linear connector is exposed in this session.
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-ai-chat-langfuse-generation-observability.md`

## Objective

Every full AI chat turn has one Langfuse trace with a child generation
observation containing model, token usage, input, output, and finish reason.

## Scope

- Canonical AI chat streaming handler and shared Langfuse tracing helper.
- Focused unit tests and production Langfuse API readback.
- Excludes changing chat routing, Outlook retrieval, or user-facing copy.

## Source of Truth

- Runtime owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`.
- Langfuse owner: `frontend/src/lib/ai/langfuse-trace.ts` and
  `frontend/src/instrumentation.ts`.
- Existing automatic AI SDK OTel instrumentation is insufficient under AI SDK v7.

Verification contract: Required

## Acceptance Criteria

- [ ] Each chat trace has at least one `GENERATION` child observation.
- [ ] The generation records model, input, output, usage, and finish reason.
- [ ] No duplicate top-level trace is created per chat turn.
- [ ] Focused tests and authenticated production readback prove the behavior.

## Implementation Checklist

- [ ] Add a shared child-generation wrapper to the canonical trace boundary.
- [ ] Preserve failure-loud behavior and asynchronous streaming.
- [ ] Add focused regression coverage for the manual observation contract.

## Integration and Verification

- [ ] Focused unit checks pass.
- [ ] Production user-flow creates a trace with a nested generation observation.
- [ ] Evidence artifacts are recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a trace without a `GENERATION` observation is detectable via
  the Langfuse public API and the production trace verifier.
- Detection path: trace observation count/type readback after a real chat turn.
- Recovery path: investigate the canonical child-generation wrapper, not the
  root trace exporter or chat UI.

## Incident Learning

- Failure fingerprint: `AI_CHAT_LANGFUSE_ROOT_ONLY`
- Root cause: AI SDK v7 telemetry did not emit child OpenTelemetry observations
  to the configured Langfuse processor; only the manually created root span
  arrived in Langfuse.
- Detection gap: monitoring asserted trace existence but not generation presence.
- Prevention: regression test plus production observation-type readback.
- Guardrail evidence: pending implementation.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Production trace inventory | Langfuse public API | Observed | The July 18 strategic response trace exists. |
| Production observation shape | Langfuse public API | Failed | The trace has one root `SPAN`, zero `GENERATION` observations. |

## Remaining Risk

- Manual child instrumentation must preserve one trace per turn and must not
  interfere with the response stream.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
