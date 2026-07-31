# Task: Applicant Tracker Production Roadmap

Status: Production Active - UAT Pending
Owner: Codex
Created: 2026-07-29
Task ID: ALL-42
Linear Issue: https://linear.app/alleato-group/issue/ALL-42/build-the-applicant-tracker-production-roadmap
Related Handoff: `docs/ops/handoffs/2026-07-29-S20260729-applicant-tracker-production.md`

## Objective

Implement the approved Applicant Tracker roadmap from secure shared persistence
through human-controlled AI assistance while preserving human employment
decision authority and the current person-plus-application model.

## Scope

- Own recruiting route, feature, hook, library, API, migration, database-test,
  and E2E paths listed in the session lease.
- Keep applicant data in a recruiting-owned domain even though the UI remains
  in the company-wide Alleato application shell.
- Implement provider capabilities behind explicit configuration, permission,
  idempotency, reconciliation, audit, and kill-switch boundaries.
- Do not fabricate live Microsoft, SMS, e-signature, job-board, or AI proof when
  provider configuration is absent.
- Do not import the synthetic browser-local records into production tables.

Delivery lane: High-risk

## Acceptance Contract

- [x] Recruiting records persist in shared Supabase tables with RLS enabled.
- [x] Resume files are private and are accessed only after record authorization.
- [x] Recruiter, hiring-manager, interviewer, executive, and restricted-data
      boundaries have positive and negative tests.
- [x] Candidate and job-specific application records remain separate.
- [x] Requisition, intake, inbox, communication, scheduling, interview,
      scorecard, offer, talent-pool, analytics, compliance, and AI-assist
      workflows have explicit state contracts.
- [x] Employment decisions require an attributed human action.
- [x] Provider writes are idempotent and fail with actionable recovery.
- [x] AI cannot rank, reject, advance, offer to, or hire a candidate.
- [x] No real applicant PII appears in fixtures, logs, screenshots, or exports.
- [x] Desktop and mobile final-route screenshots prove changed UI states.
- [x] API, component, E2E, security, and independent-review evidence
      is recorded before release.

## Milestone Checklist

- [x] M0 Product contract and guardrails
- [x] M1 Secure shared foundation
- [x] M2 Requisitions and applicant intake
- [x] M3 Recruiter inbox, communication, and scheduling
- [x] M4 Structured interviews and scorecards
- [x] M5 Offers and onboarding handoff
- [x] M6 Talent CRM and construction hiring
- [x] M7 Analytics, compliance, and candidate experience
- [x] M8 Human-controlled AI assistance

## M0 Decisions

- UI boundary: company-wide `/recruiting` module in the existing Alleato shell.
- Data boundary: recruiting-owned tables, storage, permissions, and APIs; no PM
  project foreign-key dependency.
- Synthetic data: test/demo repository only; never promoted to production.
- Provider default: disabled until credentials, permissions, mailbox/sender
  ownership, consent, and callback verification pass.
- Retention default: no destructive automatic deletion until an approved policy
  is configured; retention candidates may be reported without deletion.
- AI default: disabled; only evidence-linked extraction, drafting, and summaries
  are eligible after evaluation and human-review controls pass.
- SMS/e-sign/job boards: guarded ports and configuration surfaces may ship, but
  cannot report operational status until a provider is selected and verified.

## Failure-Loudly Contract

- Cause surfaced as: typed guardrail/provider/repository error without applicant
  PII or secret material.
- Detection path: unit/API/pgTAP negative test plus operational event.
- Recovery path: retry only when idempotent, correct configuration/permission,
  or route to an authorized human.
- Prevention: schema constraints, RLS, idempotency ledger, provider kill switch,
  immutable audit event, and regression test.

## Evidence

| Boundary | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Planning | Approved roadmap | Pass | Brandon authorized all phases on 2026-07-29. |
| Linear | Project and ALL-42 through ALL-50 | Pass | Milestones and dependencies created. |
| Schema/RLS | Four recruiting migrations plus pgTAP contract | Pass | All exact versions are applied to PM APP; 50 recruiting tables, 102 RLS policies, and 15 recruiting routines read back before the offer hotfix helper. |
| SQL static validation | SQLFluff parse of all three migrations | Pass | Large-file parsing explicitly enabled; all migrations parsed successfully. |
| API/unit | Focused Jest | Pass | 2 suites and 6 tests passed after final hardening. |
| Component | Focused ESLint, Jest, and changed-type guard | Pass | No lint errors; no new `any` debt; coordinator workspace and accessible candidate path pass. |
| E2E/visual | Authenticated Playwright, desktop and mobile | Pass | 3 tests passed; screenshots in `tests/agent-browser-runs/2026-07-29-applicant-tracker-release/`. |
| Production E2E | Canonical authenticated desktop and mobile | Pass | 2 tests passed on `https://projects.alleatogroup.com/recruiting` with shared data and no applicant writes. |
| Database regression | Remote pgTAP | Pass | 61/61 tests pass after correcting the fixture and adding the offer-access helper contract. |
| RLS hotfix | `20260729182500_fix_recruiting_offer_rls_recursion.sql` | Pass | Forward-only migration removes the offer/approval policy recursion; code and security reviews returned PASS. |
| Production roles | Live PM APP readback | Pass | Brandon is active `recruiting_admin`; Jazmin is active `recruiter`; an unassigned active user sees zero recruiting settings. |
| Generated types | Live PM APP schema | Pass | `frontend/src/types/database.types.ts` regenerated after all recruiting migrations. |
| Provider readback | Persisted verification gates | Guarded | All providers report unavailable until explicit verified readback state exists. |
| Independent review | Code and security re-review | Pass | Both independent reviewers returned PASS with no remaining critical or high blockers. |
| Full repository typecheck | TypeScript compiler with 8 GB heap | Blocked | Recruiting error was corrected; the remaining failures are pre-existing unrelated repository debt. |

## Final Status

- [x] All production activation checklist items complete.
- [x] Evidence filled in.
- [x] Provider limitations stated precisely.
- [ ] Jazmin UAT feedback and acceptance recorded.
