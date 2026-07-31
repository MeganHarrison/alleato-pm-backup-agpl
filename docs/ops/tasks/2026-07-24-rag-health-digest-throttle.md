# Task: Throttle RAG Health Digest on Alert Churn

Status: Ready to Publish
Owner: Codex
Created: 2026-07-24
Task ID: RAG-HEALTH-DIGEST-THROTTLE-20260724
Linear Issue: Not created; this is a single-session incident repair.
Related Handoff: `docs/ops/handoffs/2026-07-24-SROOT-rag-health-digest-throttle.md`

## Objective

Send at most one Teams RAG-health digest during the configured re-notify window, even when a discovery or replay adds many discrete alerts.

## Scope

- `backend/src/services/health/source_rag_health.py`
- `backend/tests/test_source_rag_health.py`
- Excludes remediation of the actual SharePoint backlog and embedding daily-budget exhaustion.

## Source of Truth

- Canonical runtime/data owner: `alleato-source-rag-health` and RAG `system_alerts`.
- Existing shared services: `source_sync_health.persist_source_sync_alerts`, `reserve_health_digest_notification`.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] A new discrete source alert cannot bypass an active RAG-health digest cooldown.
- [x] The first degraded report and a re-notify after the configured window still send.
- [x] Per-alert ledger reservations remain durable and visible.
- [x] A degraded monitoring result does not fail the Render cron execution.
- [x] A focused regression test proves the alert-churn case.

## Failure-Loudly Contract

- Cause surfaced as: `notification.status=throttled` with the count of new findings covered by the digest.
- Detection path: source-RAG health report and targeted unit test.
- Recovery path: fix the underlying alert; a recovery resolves the digest and a future incident sends immediately.

## Incident Learning

- Failure fingerprint: reliability.side-effect-before-durable-ledger
- Guardrail premise: notification reservation is durable before delivery.
- Root cause: report delivery treated every newly reserved per-alert key as an immediate Teams-notification trigger.
- Detection gap: tests covered an already-throttled alert and a new-alert immediate send, but not many new alerts during an active digest cooldown.
- Prevention: focused regression test requires digest cooldown to gate report delivery regardless of per-alert novelty.
- Guardrail evidence: `backend/tests/test_source_rag_health.py`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live localization | RAG `system_alerts` readback | Pass | Digest and new SharePoint alert reservations both advanced during one active incident. |
| Regression | `python3 -m pytest backend/tests/test_source_rag_health.py -q` | Pass | 30 passed. |
| Syntax | `python3 -m compileall -q backend/src/services/health/source_rag_health.py backend/tests/test_source_rag_health.py` | Pass | Completed. |
| Independent review | Reviewer | Pass after contract update | Cooldown gate approved; operating contract now records cron result semantics. |

## Remaining Risk

- The SharePoint backlog and exhausted daily embedding budget are separate live incidents and remain visible without repeated message delivery.

## Final Status

- [x] All required checklist items are complete except publication and live readback.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.
