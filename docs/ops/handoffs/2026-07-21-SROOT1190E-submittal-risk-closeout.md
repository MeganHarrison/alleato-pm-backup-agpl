# Handoff: 2026-07-21 — AAI-1190 Documentation and Closeout

## Intake Block

1) Session ID: SROOT1190E
2) Task ID: AAI-1190
3) Linear issue: [AAI-1190](https://linear.app/megankharrison/issue/AAI-1190/link-submittals-to-activities-and-surface-schedule-risk)
4) Current status: In Progress — documentation is published; production browser proof and independent review remain.
5) Files changed: `docs/architecture/SCHEDULE-SUBMITTAL-RISK.md`, task record, this handoff.
6) Evidence: documentation links the canonical schedule/submittals routes, migration/RPC, APIs, evaluator, editor, tests, task, and Linear issue.
7) Risk: no browser screenshot is recorded yet because the current production deployment is still building. Production now has `NEXT_PRODUCTION_BUILD_ENGINE=webpack`, `NEXT_PRODUCTION_BUILD_NODE_OPTIONS=--max-old-space-size=12288`, and `NEXT_BUILD_MAX_OUTPUT_BYTES=8589934592`; this bypasses the known Turbopack endpoint-write failure, the observed 7 GB Webpack heap OOM, and the transient 4 GB output-monitor ceiling without disabling the bounded-output guardrail.
8) Next action: when the deployment is Ready, perform the authenticated desktop/mobile canonical flow, attach screenshots to AAI-1190, then request independent review.

## Linear Update

- Documentation and source links are ready to include in the next AAI-1190 milestone comment.
