# Task: Source-backed RAG Pipeline Dashboard

Status: Complete
Owner: Megan Harrison
Created: 2026-07-22
Task ID: AAI-1261
Linear Issue: [AAI-1261](https://linear.app/megankharrison/issue/AAI-1261/add-source-backed-rag-pipeline-chart-to-ai-dashboard)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-rag-pipeline-dashboard.md`

## Objective

Show source-backed vectorization throughput at the top of `/ai-dashboard`, with range selection and a source-data drill-down.

## Scope

- Canonical AI dashboard RAG intake section, source-backed API, and range-aware source-data navigation.
- Excludes changing ingestion, embedding, or source-sync runtime behavior.

## Source of Truth

- Canonical runtime/data owner: `document_metadata` plus RAG `document_chunks` lifecycle read-back.
- Existing shared primitives/services: `frontend/src/app/api/admin/source-sync/_lifecycle.ts`, `frontend/src/app/(admin)/rag/page.tsx`, `frontend/src/components/ui/charts.tsx`.
- Deprecated or parallel paths: illustrative `ai-os-data.ts` ingestion chart values must not drive the new section.

Verification contract: Required

## Acceptance Criteria

- [x] The top dashboard section shows vectorized meetings, Teams messages, emails, and documents for 24h, 3d, 7d, and 30d.
- [x] Hover exposes source-specific count and range context.
- [x] Clicking a source bar opens the canonical RAG source-data table scoped to its source and range.
- [x] Loading and source-read failure states are explicit with recovery.
- [x] Desktop and mobile canonical-route screenshots are attached to Linear.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared lifecycle/read-back abstraction owns counts.
- [x] Errors are specific and actionable.
- [x] Authorization preserves dashboard and source-table access boundaries.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user flow proves range selection, tooltip, and drill-down.
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are staged for publication; `codex:finish` verifies `HEAD` after push.

## Failure-Loudly Contract

- Cause surfaced as: a source-specific pipeline-read error.
- Detection path: dashboard section error state and API response.
- Recovery path: open RAG Health/source-sync lifecycle control plane.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: Illustrative dashboard telemetry cannot prove current ingestion.
- Prevention: dashboard chart reads the lifecycle source of truth and retains a source-table drill-down.
- Guardrail evidence: targeted contract tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Live browser baseline | `agent-browser open https://projects.alleatogroup.com/ai-dashboard` | Blocked | Production route redirects to login; authenticated proof will use refreshed Playwright state or a local authenticated run. |
| Targeted lint | `pnpm --dir frontend exec eslint ...` | Pass | Changed dashboard/API files clean. |
| Surface complexity | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs ...` | Pass | No dropdown, table, or surface complexity violations. |
| Touched-path compilation | `pnpm --dir frontend exec tsc --noEmit ... | rg ...` | Pass | No compiler diagnostics for owned dashboard/API paths. |
| Desktop browser | `/tmp/aai-1261-dashboard-desktop.png` | Pass | Authenticated local desktop chart loaded with live source counts and all four range controls; attached to AAI-1261. |
| Responsive browser | `/tmp/aai-1261-dashboard-mobile-final.png` | Pass | Authenticated local mobile view preserved the four 44px range controls and no horizontal overflow. |
| Drill-down routing | `path.recharts-rectangle` click | Fixed | First proof found `/admin/rag` was a 404. The canonical href is corrected to `/rag?tab=lifecycle...`; final route proof remains required. |

## Remaining Risk

- The source bar now emits the canonical `/rag?tab=lifecycle` URL with its range, source, and vectorized stage scope.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No work is deferred.
