# Task: CRM v4 Production Release

Status: Complete
Owner: Brandon / Codex
Created: 2026-07-29
Task ID: S019FA6A7D-CRM-PRODUCTION
Linear Issue: Connector unavailable in this task; local high-risk task record used.
Related Handoff: `docs/ops/handoffs/2026-07-29-S019FA6A7D-crm-production-release.md`

## Objective

Publish the complete CRM workflow to `origin/main`, backed by the production PM database and existing Tasks system, then verify the authenticated live application.

## Scope

- CRM schema, permissions, RLS, API handlers, UI workspace, communication matching, project conversion, existing Tasks integration, operator guide, and release evidence.
- No autonomous email sending, mailbox mutation, fabricated Acumatica synchronization, or seeded sample CRM relationships.

## Source of Truth

- Canonical runtime/data owner: PM APP Supabase project `lgveqfnpkxvzbnnwuled`.
- Existing shared primitives/services: Company Directory, `tasks`, `document_metadata`, Projects API, permission module, unified tables, PageShell/PageScaffold.
- Deprecated or parallel paths: browser-local CRM store remains test/fixture support only and is not imported by production CRM routes.

Delivery lane: High-risk

Verification contract: Required

## Workflow Brief

Primary user: Brandon and the Alleato business-development team.
Primary job: manage company relationships, opportunities, communication review, and next actions.
Primary decision: which relationship or deal needs action next.
Tier 1 content: relationship work queue, pipeline, deals, communication review, and CRM-linked tasks.
Hidden until requested: deal conversion details, document links, archive/recovery controls, and administrative settings.
Remove: browser-local status language, stacked KPI bands above working surfaces, and sample-user fallbacks.
Primary action: create or advance a relationship opportunity and assign its next follow-up.
Failure-loudly behavior: API, permission, validation, concurrency, and integration failures remain visible and do not display success.
Canonical owner: existing Company Directory, Tasks, Documents, Projects, permission, and unified-table components.

## Acceptance Criteria

- [x] Requested behavior is observable end to end in the authenticated local application.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Production CRM routes no longer use the browser-local store.
- [x] Production database migration and pgTAP contract are applied and read back.
- [x] Existing Tasks records own CRM follow-ups.
- [x] Communication matching is read-only against ingested source metadata and human-reviewed.
- [x] Won-deal conversion uses existing Projects and waits for verified Acumatica state.
- [x] Task-owned files are published to `origin/main` and the live deployment is read back.

## Implementation Checklist

- [x] CRM files and integration boundaries are listed and owned.
- [x] Shared abstractions own cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, authentication, permission, provider, and delivery contracts are handled.
- [x] Operator workflow guide is generated as Markdown and DOCX.

## Publication Manifest

`npm run codex:finish` must receive only the following CRM-owned paths:

- CRM routes, handlers, components, hooks, domain rules, and tests under `frontend/src/app/**/crm/**`, `frontend/src/features/crm/**`, `frontend/src/hooks/use-crm/**`, and `frontend/src/lib/crm/**`.
- Shared CRM integration edits in the Company Directory, Tasks, Documents, navigation, access, permission, onboarding, generated database types, app-surface inventory, and `frontend/vercel.json`.
- CRM database migrations `20260728160000`, `20260729010000`, `20260729013000`, and `20260729014500`, plus `supabase/tests/crm_v4_contract.sql`.
- CRM browser verification, Windows verifier fixes, this task/handoff, the owner guide, and its generator.
- Prior CRM phase task/handoff records that already belong to this release.

Explicitly excluded from publication: every `frontend/src/**/scheduling/**` path, project schedule page, scheduling service or test, schedule verification script, and `docs/ops/scheduling/**`; no deletion or regression from the branch's stale scheduling snapshot is authorized. `CONTEXT.md` and generated architecture maps are also excluded unless regenerated from current `origin/main` by the publication workflow.

## Failure-Loudly Contract

- Cause surfaced as: server-returned validation, permission, concurrency, dependency, or integration message.
- Detection path: CRM error state/toast, guardrail log, focused tests, Supabase readback, and authenticated browser test.
- Recovery path: correct the stated record/permission/integration state, refresh, and retry; no write is reported successful before server confirmation.

## Incident Learning

- Failure fingerprint: `build.silent-compiler-stall`
- Root cause: shared Node verification scripts invoked Unix CLI names on Windows and agent-browser timed out during cold Next.js compilation.
- Detection gap: the verifier had no Windows CLI resolution guardrail and a 25-second browser timeout against a cold 12,000-module route.
- Prevention: invoke npx through Node's CLI and agent-browser through its native Windows executable, use the repository auth state, warm protected routes, and retain Playwright fallback evidence.
- Guardrail evidence: `scripts/verification/prepare-authenticated-browser.mjs`, `scripts/agent-browser/agent-browser-verify.mjs`, `frontend/tests/e2e/crm-release.spec.ts`, and the existing `build.silent-compiler-stall` registry entry.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live schema | Supabase Management API SQL and migration ledger readback | Passed | CRM tables exist, task link fields exist, six stages and 30 policies present. |
| Live SQL contract | `supabase/tests/crm_v4_contract.sql` | Passed | 26 pgTAP assertions. |
| Focused lint | CRM/API/task/verifier-owned ESLint and Node syntax checks | Passed | No scoped diagnostics. |
| Focused unit tests | CRM dashboard, rules, and local-store Jest suites | Passed | 15 tests. |
| TypeScript | Full bounded typecheck plus CRM-path diagnostic filter | Scoped pass | Repository-wide unrelated failures remain; no CRM-owned diagnostic after fixes. |
| Auth | `frontend/tests/auth.setup.ts` | Passed | Auth state saved for Brandon. |
| API | Authenticated `/api/crm/workspace` | Passed | HTTP 200 against PM APP Supabase. |
| Desktop | `tests/agent-browser-runs/2026-07-29-crm-release-playwright/crm-relationships-desktop.png` | Passed | Authenticated workspace API completed before capture; no local-only wording or fabricated records. |
| Mobile | `tests/agent-browser-runs/2026-07-29-crm-release-playwright/crm-pipeline-mobile.png` | Passed | 390 x 844. |
| Operator guide | `docs/owner-guide/CRM-Workflow-and-Functions-Guide.docx` | Passed | Browser-rendered DOCX preview inspected with no clipped content. |
| Independent review | `/root/review_local_crm` | Passed | Final implementation and Windows release-harness review returned PASS. |
| Production build | `frontend/scripts/build/run-production-build.mjs` | Environment blocked | Turbopack rejected the isolated-workspace symlink; Webpack then hit the existing 12-minute silent-compiler guardrail. Focused CRM checks remained green; canonical Vercel build/readback is required. |
| Publication | `origin/main` commits `144dcb9` and `c5acd21` | Passed | Exact-path publication preserved newer scheduling changes and excluded stale branch history. |
| Live deployment | Vercel deployment `dpl_DDTovtNi8qPuxY3Leqo9YkQpSxs1` and authenticated `/crm` readback | Passed | Production alias is Ready; workspace API returned HTTP 200, Tasks loaded, and the final empty-state wording rendered correctly. |

## Remaining Risk

- Repository-wide typecheck currently contains unrelated diagnostics outside the CRM-owned paths; they are not silently attributed to this release.
- Production begins with zero CRM relationship records by design; no sample customer or deal data was inserted.
- The generated project-map follow-up was withheld because independent review found an unrelated Schedule-title extraction defect; no scheduling metadata regression was published.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked locally.
- [x] No deferred CRM behavior is represented as complete.
