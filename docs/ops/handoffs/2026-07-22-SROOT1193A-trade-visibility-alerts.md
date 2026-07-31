# Handoff: AAI-1193 trade schedule visibility and alerts

Status: In Progress
Session: SROOT1193A
Linear: [AAI-1193](https://linear.app/megankharrison/issue/AAI-1193/provide-tradevendor-schedule-visibility-and-change-alerts)

## Intake

- Notification owner: `collaboration_notifications`; do not create a parallel alert store.
- Schedule source: published revision snapshots/events only.
- First red tests: out-of-scope activity read, unpublished event rejection, replay/idempotency rejection.

## Next action

Inspect task assignment and project membership sources, then add the scoped read/alert contract with a durable idempotency key.
