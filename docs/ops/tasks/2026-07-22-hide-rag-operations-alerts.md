# Task: Hide Internal Pipeline Alerts from RAG Page

Status: Ready for publication
Owner: SROOT-HIDE-RAG-OPS-ALERTS-0722
Created: 2026-07-22
Task ID: HIDE-RAG-OPS-ALERTS-0722
Linear Issue: N/A (user-directed client-surface correction)
Related Handoff: N/A (single-session scoped change)

## Objective

Remove internal Acumatica and pipeline diagnostics from the client-facing RAG page.

## Scope

- Remove the active-alert client fetch and rendered banner from `/rag`.
- Preserve persisted alerts and the existing Teams operations notifier.
- Do not alter source-sync, connector, or alerting behavior.

## Source of Truth

- Client page owner: `frontend/src/app/(admin)/rag/page.tsx`.
- Preserved operations owner: `frontend/src/app/api/admin/source-sync/active-alerts/route.ts` and `backend/src/services/health/pipeline_alert_notifier.py`.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] `/rag` does not fetch or render active pipeline alerts.
- [x] The RAG lifecycle table remains unchanged.
- [x] Persisted alert and Teams notification paths remain unchanged.

## Integration and Verification

- [x] Runtime localization proved the page state was rendered as `PipelineAlertsBanner` from `/api/admin/source-sync/active-alerts`.
- [x] Focused ESLint completed with four pre-existing raw-grid warnings and no errors.
- [x] Alleato surface-complexity audit passes.
- [x] Source readback confirms the client-page alert fetch, state, callback, refresh hook, and banner mount are absent.
- [ ] Protected-route browser proof is pending a browser session with `/rag` access.

## Failure-Loudly Contract

- Cause surfaced as: internal connector diagnostics were rendered on the client-facing RAG page.
- Detection path: user-provided live screenshot and localized page state-to-DOM boundary.
- Recovery path: operational recipients continue receiving alerts through the existing Teams notifier; client users no longer receive connector internals.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the RAG page mounted an operations-only `PipelineAlertsBanner` directly from the active-alert endpoint.
- Detection gap: no client-surface visibility boundary existed around connector diagnostic content.
- Prevention: keep operational alerts on the notifier/control-plane path; do not mount raw connector diagnostics in user-facing pages.
- Guardrail evidence: source-level absence check and protected-route browser proof requirement.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | User-provided live `/rag` screenshot | Pass | Banner exposed an Acumatica OData diagnostic. |
| Focused lint | `pnpm --dir frontend exec eslint src/app/(admin)/rag/page.tsx` | Pass with warnings | 4 pre-existing raw-grid warnings, no errors. |
| Alleato audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/app/(admin)/rag/page.tsx` | Pass | No complexity-budget violation. |
| Local browser | `agent-browser open http://localhost:3000/rag?...` | Blocked | Test account receives Access Denied; does not have `/rag` permission. |

## Remaining Risk

- Browser proof on the protected route is pending a session with RAG access. The page-level alert fetch/render path is removed, and production deployment remains required.

## Final Status

- [x] Implementation and static evidence are complete.
- [x] Incident learning is explicitly recorded.
- [ ] Protected-route browser proof is pending access.
