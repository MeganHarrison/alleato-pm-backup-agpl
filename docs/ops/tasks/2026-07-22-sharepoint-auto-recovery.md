# Task: SharePoint ingestion automatic recovery

Status: Ready for release
Owner: Codex
Created: 2026-07-22
Task ID: SHAREPOINT-AUTO-RECOVERY-0722
Linear Issue: Not requested; local High-risk delivery record
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-sharepoint-auto-recovery.md`

## Objective

Ensure SharePoint ingestion failures are recorded accurately and automatically retried without dropping their Microsoft Graph delta entries.

## Scope

- `backend/src/services/integrations/microsoft_graph/onedrive.py`
- `backend/src/services/integrations/microsoft_graph/sync.py`
- Focused regression tests for delta-cursor preservation and recovery accounting.
- Excludes customer-facing error disclosure; operational health remains internal.

## Source of Truth

- Canonical runtime/data owner: native FastAPI Graph ingestion and `source_sync_runs`.
- Existing shared primitives/services: Graph client retries, `graph_sync_state`, `source_sync_runs`.
- Deprecated or parallel paths: page snapshot values are not evidence of current database state.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Failed SharePoint file processing is counted rather than silently logged and skipped.
- [x] A failed delta batch retains its prior cursor so the scheduled job retries it.
- [x] Folder-level errors preserve their prior cursor.
- [x] The run ledger exposes failure count and retry state to operations only.

## Failure-Loudly Contract

- Cause surfaced as: `source_sync_runs` warning/failed run and Graph job error summary.
- Detection path: run ledger plus backend job logs/Teams operational notification.
- Recovery path: next scheduled Graph sync automatically replays the preserved delta batch.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: File-level SharePoint exceptions were logged and the delta cursor advanced, permanently skipping failed delta entries; folder exceptions cleared the prior cursor.
- Detection gap: `/rag` displayed aggregate snapshots that did not match the attached production database.
- Prevention: Preserve the cursor on recoverable file/folder failure and record exact failed-item totals.
- Guardrail evidence: Focused unit tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Production readback | `supabase db query --linked ... source_sync_runs` | Pass | Attached production database has zero SharePoint failures and last run 2026-05-14; screenshot is stale or another environment. |
| Focused tests | `cd backend && pytest -q tests/test_sharepoint_sync_recovery.py tests/test_source_sync_health.py` | Pass | 26 passed: cursor preservation, retry accounting, and degraded health while recovery is pending. |
| Syntax | `cd backend && python -m py_compile src/services/integrations/microsoft_graph/onedrive.py src/services/integrations/microsoft_graph/sync.py src/services/health/source_sync_health.py` | Pass | Imports and syntax compile. |
| Formatting | `git diff --check` | Pass | No whitespace errors. |
| Existing neighboring tests | `cd backend && pytest -q tests/test_graph_sync_options.py` | Blocked by unrelated debt | Two tests patch the absent `embed_pending_attachment_documents` symbol; 12 selected tests passed. |
| Independent review | `docs/ops/evidence/2026-07-22-sharepoint-auto-recovery/independent-review.md` | Pass | The initial monitoring visibility gap was fixed and approved on re-review. |

## Remaining Risk

- Permanent upstream authorization/configuration failures cannot self-heal; they remain internal operational alerts rather than client-visible details.
- Render Git source was repaired through the API; the release-trigger commit and deploy readback remain required.
