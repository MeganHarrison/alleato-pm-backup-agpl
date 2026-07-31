# Task: Contain Unbounded AI Spend and Establish Ownership

Status: Complete
Owner: Codex SROOT-AI-SPEND-0724
Created: 2026-07-24
Task ID: LOCAL-20260724-AI-SPEND-CONTROL
Linear Issue: N/A; single-session incident containment
Related Handoff: `docs/ops/handoffs/2026-07-24-SROOT-ai-spend-control.md`

## Objective

Stop the active automatic spend fan-out, apply enforceable runtime containment,
and establish a machine-checked map and honest spend report.

## Scope

- PM APP database-triggered pipeline dispatch.
- Render AI routing, scheduled unmetered workloads, and pipeline budgets.
- Pipeline ledger provider/runtime attribution and failure behavior.
- Canonical AI callsite ownership registry and operational spend report.
- Excludes the follow-up cross-runtime atomic reservation migration and leased
  pipeline outbox.

## Source of Truth

- Canonical runtime/data owner: `config/ai-runtime-owners.json`
- Existing shared primitives/services:
  `backend/src/services/ai_transport.py`,
  `backend/src/services/pipeline/model_usage.py`
- Deprecated or parallel paths: product dashboards that read only
  `chat_history.metadata.usage`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Both database pipeline dispatch URLs are disabled and read back live.
- [x] Highest-risk unmetered scheduled jobs are suspended and read back live.
- [x] Tracked backend and Render AI jobs require the gateway and have a daily cap.
- [x] The production backend blank-overrides the inherited direct OpenAI credential, so legacy bypasses fail closed.
- [x] Ledger read failure stops paid background work by default.
- [x] Ledger rows identify the actual provider route and Render owner.
- [x] Every known production AI group has an owner and coverage status.
- [x] Spend reporting states that tracked estimates are not provider totals.
- [x] Failure-loudly behavior is executable.

## Implementation Checklist

- [x] Files/modules were listed before edits.
- [x] Shared transport and model-usage services own cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Provider and deployment contracts were updated and read back.

## Integration and Verification

- [x] Focused model-usage and failover tests pass.
- [x] Ownership verification passes with explicit coverage warnings.
- [x] Live spend report reproduces the incident interval.
- [x] Render deployment is live and env values were read back.
- [x] Task-owned files are prepared for exact-file remote-main publication.

## Failure-Loudly Contract

- Cause surfaced as: unregistered callsite, active unmetered schedule, unavailable
  budget ledger, or explicit coverage gap.
- Detection path: `npm run verify:ai-spend-ownership` and
  `npm run ai:spend:report`.
- Recovery path: suspend the unmetered runtime or route it through the atomic
  metered transport before resuming.

## Incident Learning

- Failure fingerprint: `ai.unbounded-and-unattributed-provider-spend`
- Root cause: database HTTP fan-out plus fragmented best-effort accounting.
- Detection gap: no complete runtime registry, global ledger, or atomic cap.
- Prevention: executable ownership registry, fail-closed containment, then
  atomic reservation/settlement and leased dispatch.
- Guardrail evidence: this task and the live readbacks recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | isolated pytest run without unrelated root conftest | Pass | 27 passed |
| Ownership map | `npm run verify:ai-spend-ownership` | Pass | Known coverage debt is loud |
| Spend report | `npm run ai:spend:report -- --days=2` | Pass | `$23.391198` tracked; gaps listed |
| Database containment | REST update plus readback | Pass | Both dispatch URLs disabled |
| Runtime containment | Render API update/suspend plus readback | Pass | Two crons suspended; caps configured |
| Backend deployment | Render deployment readback | Live | Direct key blank-overridden; required budget active |
| Independent review | Reviewer re-review after three fixes | Pass | All prior findings resolved |

## Remaining Risk

- The env budget is not atomic across processes. Owner: AI spend control plane.
  Next action: database reservation and settlement RPC.
- Active interactive, Eve, Realtime, and daily-brief paths are not yet in the
  consolidated ledger. Owner: listed feature owners. Next action: metered
  transports and provider reconciliation.
- The trigger still contains legacy `pg_net` code even though both URLs are
  disabled. Owner: pipeline dispatch. Next action: leased transactional outbox.

## Final Status

- [x] All containment and ownership-baseline checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred durable work names cause, detection gap, prevention, owner, and
  next action.
