# Task: CRM v4 - All Phases Local Review Build

Status: Local implementation complete; external acceptance pending
Owner: Brandon / Codex
Created: 2026-07-28
Branch: `codex/s019fa6a7d-crm-002-b047ea`
Deployment: none

## Outcome

The CRM v4 plan is represented in a working, disconnected local build without
writing to the shared database or changing Acumatica, Render, Supabase provider
configuration, or `main`. All CRM pages share one browser-local store, so edits
persist across routes and browser refreshes.

The review surface includes:

- `/crm`: relationship attention worklist plus pipeline, weighted pipeline,
  win-rate, overdue follow-up, stale relationship, and weekly activity KPIs.
- `/crm/deals`: filterable opportunity list.
- `/crm/pipeline`: keyboard-capable guarded stage movement.
- `/crm/activities`: manual activity feed and local logging modal.
- `/crm/settings`: health, reporting, and communication safety controls.
- `/crm/settings/matching`: candidate accept/reject review.
- `/crm/deals/[dealId]`: deal fields, stage transitions, activity, follow-ups,
  attachments contract, and idempotent conversion review.
- Existing company detail: explicit Add-to-CRM boundary, relationship health,
  deals, and activity without editing ERP-owned company fields.
- `/crm/companies/[companyId]`: fixture-backed local company review that remains
  usable without the connected directory detail API.
- Browser-local reset: restores the deterministic review dataset without
  contacting any service.

## Phase Coverage

| Phase | Local deliverables | Current state |
| --- | --- | --- |
| 0 | Baseline, stale-surface inventory, contracts | Complete |
| 1 | CRM permission module, schema, RLS, audit, health, account routes | Code complete; migration not applied |
| 2 | Account enrollment, activity create/edit/delete, follow-up create/complete, archive/restore, company integration | Local journey complete; live journey pending |
| 3 | Pipeline/stages/deals, concurrency, transition history, archive/restore and project-link guards | Local journey complete; DB contract pending |
| 4 | KPI/attention APIs, settings, daily catch-up route | Code complete; Render schedule not configured |
| 5 | Source identity, candidates, structured alias feedback, denylist, idempotency/supersession rules | Local journey complete; source-provider evaluation pending |
| 6 | Won-deal conversion attempt ledger, replay behavior, recoverable partial state, ERP-pending boundary | Code complete; Acumatica reconciliation pending |

## Safety Boundaries

- All review pages initialize from deterministic fixtures, then create and edit
  records in browser local storage. They explicitly say no live CRM data is
  connected.
- The rendered CRM workflows do not call `/api/crm`, Supabase, Acumatica, or
  Render. The API and migration implementation remains dormant for later
  integration review.
- The migration exists only as a file. It has not been applied to any Supabase
  project.
- Restricted and private-source communication rows fail closed in current read
  policies and APIs. Provider-specific visibility may be added only after its
  access contract is verified.
- Direct task APIs reject CRM link fields. The dedicated follow-up route is the
  only application write path for `tasks.company_id` and `tasks.crm_deal_id`.
- Conversion creates a recoverable ledger entry and stops at `erp_pending`
  until Acumatica identifiers are read back. The local UI simulation is labeled
  as a review session and does not call Acumatica.

## Validation Evidence

- Focused ESLint: no CRM errors. The reused document picker retains one
  pre-existing raw-heading lint error outside the CRM edit.
- Jest: 4 suites and 24 CRM domain, local-store, dashboard, and permission tests
  passing.
- SQL: pgTAP contract authored; not executed because local Supabase CLI/Docker
  is unavailable.
- Full TypeScript check: repository tool hit its existing 300-second timeout
  without diagnostics.
- Next build: exhausted both the default 4 GB heap and the repository's intended
  8 GB allowance while compiling the wider application.
- CRM-scoped TypeScript check: the last completed pass found the existing
  `sheet-editor.tsx:148` mismatch and one company-route nullability issue, which
  was corrected. The post-fix confirmation run exceeded 300 seconds without
  emitting a diagnostic.
- Browser QA: all CRM routes rendered; deal creation, guarded movement,
  attachments, follow-up creation, activity create/edit, account archive/restore,
  matching acceptance and alias feedback, settings persistence, conversion
  simulation, project-link severing, and reset were exercised across refreshes. Desktop
  1440x1000 and mobile 390x844 had no document-level horizontal overflow. The
  captured request log contained no `/api/crm`, Supabase, Acumatica, or Render
  request.

## Required Before Publication

- Apply the migration to an ephemeral Supabase branch, regenerate database
  types, and run the RLS/pgTAP matrix.
- Approve administrators, pilot cohort, seed owners/data, USD-only behavior,
  communication/privacy evaluator, and health defaults.
- Verify provider access, source revocation/purge, live Render scheduling and
  failure alerting, and Acumatica identifier reconciliation.
- Complete the one-week adoption checkpoint and authenticated desktop/mobile
  evidence against the database-backed surface.
- Obtain Brandon's explicit decision before pushing, opening a PR, merging, or
  deploying.
