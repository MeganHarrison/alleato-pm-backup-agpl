# Task: CRM Person-Level Lead Workflow

Status: In Progress
Owner: Codex SCRM731
Created: 2026-07-31
Task ID: CRM-PERSON-LEADS-20260731
Linear Issue: Not created; this user-approved CRM task is tracked by the current Codex task and high-risk handoff.
Related Handoff: `docs/ops/handoffs/2026-07-31-SCRM731-crm-person-lead-workflow.md`

## Objective

Deliver a person-centered CRM lead workflow with fast tabular intake, rich lead profiles, shared CRM tasks, accepted email history, and source-cited AI research that requires explicit human approval.

## Scope

- Extend existing `crm_leads`; one row represents one person and prospect company text may repeat.
- Preserve lead-owned deals, activities, shared Tasks, and explicit conversion to existing ERP-owned companies.
- Add manual social links and guarded photo upload.
- Add accepted Outlook activity history while keeping live Microsoft sync consent-gated.
- Add source-cited AI research drafts with atomic, whitelisted human approval.
- Exclude LinkedIn scraping, autonomous field application, outbound email, provisional Acumatica company creation, and changes to scheduling behavior.

## Source of Truth

- Canonical runtime/data owner: Supabase CRM tables and Next.js CRM APIs on `origin/main` at `c873f841`.
- Existing shared primitives/services: `relationship-dashboard-preview.tsx`, `lead-detail-review.tsx`, `use-crm-workspace.ts`, `crm_activities`, `tasks`, `crm_ai_artifacts`.
- Deprecated or parallel paths: legacy table routes under `frontend/src/app/(tables)` are not extended.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Two people at the same prospect company can be created and managed independently.
- [x] Lead intake is fast, tabular, keyboard-friendly, and fails visibly per row.
- [x] A lead profile supports person/company details, manual social links, photo, activities, deals, and shared Tasks.
- [x] Accepted visible Outlook matches appear in lead history; consent-required state never claims live sync.
- [x] AI research is source-cited, draft-only, and cannot change lead data without explicit approval.
- [x] AI cannot propose or apply social URLs or photos.
- [x] Existing lead-to-deal and deal-to-project flows remain intact.
- [x] Failure-loudly behavior is defined and covered by focused tests.
- [x] Generated database types retain scheduling and recruiting declarations.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, AI, permission, storage, and Microsoft-consent contracts are enforced.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] pgTAP contract and migration-ledger checks pass.
- [ ] Authenticated desktop and mobile screenshots prove the final workflow.
- [ ] Actual lead create, profile update, task, research review, and same-company duplicate flows are verified.
- [x] Independent code, database, React, TypeScript, and security reviews are complete with no release-blocking findings.
- [ ] Task-owned files are published and production readback succeeds.

## Failure-Loudly Contract

- Cause surfaced as: field-level validation, actionable API errors, stale-version conflict, consent-required state, or cited research rejection.
- Detection path: focused route/unit/pgTAP tests, authenticated browser artifacts, production API and migration-ledger readback.
- Recovery path: preserve entered data, refresh stale records, complete Microsoft consent, or correct/retry the rejected research request.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and completion gates recorded before edits. |
| CRM focused unit suite | `npm.cmd run test:unit -- --runInBand --runTestsByPath ...` | Pass | 7 suites, 24 tests. |
| Focused ESLint | `npm.cmd exec eslint -- <CRM files>` | Pass | Zero errors. |
| Route guardrails | `npm.cmd run guardrails:changed` | Pass | 4 changed routes; no raw or unstructured errors. |
| Route budget | `npm.cmd run quality:build-routes` | Pass | 650/650 dynamic files and 2045/2045 generated routes. |
| Database contract | `npx.cmd supabase db query --linked --file supabase/tests/crm_native_leads.test.sql` | Pass | 54 pgTAP assertions. |
| Migration ledger | Linked database readback | Pass | `20260731230000 crm_person_level_leads`. |
| Research RPC ACL | Linked database readback | Pass | `anon=false`, `authenticated=true`. |
| Independent reviews | Code, database, React, TypeScript, security lanes | Pass | No CRITICAL/HIGH findings remain. |
| Full typecheck | Windows bounded TypeScript runner | Inconclusive | Repository-wide runner exceeded its bound; focused TypeScript debt, ESLint, and tests passed. |

## Remaining Risk

- Live Microsoft mailbox ingestion remains intentionally disabled until user consent is granted.
- Public-web AI research depends on configured OpenAI service credentials and must fail explicitly when unavailable.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
