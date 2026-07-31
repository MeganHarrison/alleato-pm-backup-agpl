# RAG Pipeline Dashboard Handoff

- Session: SROOT-RAG-PIPELINE-DASHBOARD-0722
- Task: AAI-1261, https://linear.app/megankharrison/issue/AAI-1261/add-source-backed-rag-pipeline-chart-to-ai-dashboard
- Status: In Progress
- Owned paths: task file, this handoff, AI dashboard RAG visualization/API/test paths listed in the checkout lease.

## Intake

The request is to add a top-of-dashboard RAG pipeline chart with 24h, 3d, 7d, and 30d filters. It must show source-backed vectorized Meetings, Teams messages, Emails, and Documents. Tooltip/focus shows source detail; click opens the existing RAG lifecycle source-data table.

## Diagnosis

- `/ai-dashboard` renders `AiOsDashboard`, whose existing ingestion chart is illustrative data in `ai-os-data.ts` and cannot support source navigation.
- `/ai-dashboard/rag-pipeline` is Fireflies-only.
- The canonical source lifecycle ownership is `api/admin/source-sync/_lifecycle.ts` plus the `/admin/rag?tab=lifecycle` table.
- Production browser baseline is authentication-blocked at `/auth/login`.

## Evidence

- `agent-browser open https://projects.alleatogroup.com/ai-dashboard`: redirected to login.
- `node scripts/ops/checkout-session-gate.mjs claim ...`: writer lease acquired.
- Implemented a source-backed `GET /api/ai-dashboard/rag-pipeline` using the canonical cohort and embedding read-back. The dashboard section now offers 24h, 3d, 7d, and 30d controls, an accessible Recharts tooltip, and bar navigation to `/admin/rag?tab=lifecycle` with source/range/stage context.
- PASS: targeted ESLint on every owned code file.
- PASS: Alleato surface-complexity audit on the changed UI files.
- PASS: touched-file TypeScript diagnostic filter returned no owned-path errors.
- BLOCKED: `agent-browser` production and local routes redirect to login despite the available test state, so desktop/mobile screenshots and click-through proof are not yet captured.
- Recovery: refreshed the canonical Playwright auth state against localhost; authenticated desktop and mobile screenshots were captured. Desktop screenshot is attached to AAI-1261.
- Root cause found during drill-down proof: initial chart URL used `/admin/rag`, but `(admin)` is a route group and the canonical page is `/rag`. Corrected source and recovery URLs to `/rag?tab=lifecycle...`. The final source-table landing check remains outstanding.
