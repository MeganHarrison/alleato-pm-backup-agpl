# Task: Applicant Tracker Synthetic Prototype

Status: In Progress
Owner: Codex
Created: 2026-07-28
Task ID: PROTO-001
Linear Issue: ALL-39 https://linear.app/alleato-group/issue/ALL-39/proto-001-build-a-synthetic-applicant-tracker-demo
Related Handoff: N/A - single-session Standard lane

## Objective

Deliver an authenticated, leadership-showable Applicant Tracker prototype that
demonstrates synthetic resume intake, candidate review, pipeline movement, and
candidate detail without creating production data or architecture.

## Scope

- Own `frontend/src/app/(main)/recruiting/**`,
  `frontend/src/features/recruiting/**`, company-wide navigation registration,
  focused navigation tests, one recruiting E2E spec, and the shared Velt
  runtime guards required to keep the Applicant Tracker free of unconfigured
  collaboration requests.
- Exclude database migrations, provider integrations, real applicant data,
  email/calendar/SMS, PM synchronization, AI fit scoring, and production
  architecture decisions.

## Source of Truth

- Canonical runtime/data owner: client-only prototype state under
  `frontend/src/features/recruiting`.
- Existing shared primitives/services: `PageShell`, design-system `Button`,
  `ExpandableSearch`, `Select`, `Sheet`, `Dialog`, `StatusText`, and shared
  kanban shells.
- Deprecated or parallel paths: N/A; no existing applicant/recruiting product
  route was found.

Delivery lane: Standard

Verification contract: Optional

## Attention Brief

- Primary user: Alleato recruiter or hiring owner.
- Primary job: Move a real-looking applicant from intake through a controlled
  pipeline while keeping source evidence and role context visible.
- Primary decision: What should happen next for this application?
- Tier 1: Requisition, pipeline stages, candidate, evidence state, Move action.
- Tier 2: Source, received date, role-specific stage, human disposition.
- Tier 3: Contact details, resume facts, other applications, timeline.
- Hide until requested: Full candidate evidence, timeline, secondary role.
- Remove: KPI cards, decorative dashboard, AI score, drag-only interaction,
  provider settings, explanatory helper panels.
- Primary action: Add sample resume.
- Failure-loudly behavior: Unsupported real-file use and invalid stage
  transitions state the prototype boundary and recovery action.

## Acceptance Criteria

- [x] The authenticated `/recruiting` route is registered as company-wide work.
- [x] A recruiter can search, choose a requisition, inspect a candidate, move an
  application by keyboard-accessible control, and add a synthetic resume.
- [x] Candidate and application records remain separate; one candidate can be
  shown against multiple roles.
- [x] The prototype visibly states that it uses synthetic browser-local data.
- [x] No AI score, rank, recommendation, real file, database write, provider
  call, or PM write exists.
- [x] Missing or blank Velt configuration does not mount Velt UI or request the
  Velt-backed comments endpoint.
- [x] Desktop and mobile layouts remain usable.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
  explicitly excluded from this prototype.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when
  applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and contained in `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: inline prototype-boundary or invalid-transition message.
- Detection path: focused unit test plus authenticated browser workflow.
- Recovery path: reset the browser-local demo or select a permitted stage.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Auth preflight | `npm run verify:browser -- --url http://localhost:3011/training --name applicant-tracker-prototype-auth-preflight` | Blocked before browser | Local runtime stopped at the required environment-variable guardrail because no Supabase runtime values or saved auth state exist in the canonical checkout. |
| Unit behavior | `npm run test:unit -- --runInBand --runTestsByPath src/features/recruiting/__tests__/prototype-model.test.ts src/lib/__tests__/navigation-config.unit.test.ts` | Pass | 2 suites, 32 tests. |
| Targeted lint | `npm exec eslint -- "src/features/recruiting/**/*.{ts,tsx}" "src/app/(main)/recruiting/page.tsx" "src/lib/navigation-config.ts" "src/lib/__tests__/navigation-config.unit.test.ts"` | Pass with one warning | No errors. Route page delegates its approved `PageShell` to the feature-owned client component. |
| Changed type debt | `npm run typecheck:changed` | Pass | No new `any` type debt. |
| Route conflicts | Git Bash `scripts/check-route-conflicts.sh` | Pass | No route conflicts. |
| Production compile | `NODE_OPTIONS=--max-old-space-size=16384 pnpm exec next build` | Pass | `/recruiting` generated as a static route; existing unrelated workflow dynamic-require warnings remained. |
| Production deployment | Vercel deployment `dpl_FV2uBrHFfAZR36SqiX4retEXER8U` | Pass | Ready and aliased to `https://projects.alleatogroup.com/recruiting`. |
| Authenticated desktop flow | Live Chrome verification at `1536x844` | Pass | Added Taylor Morgan, opened candidate detail, and moved the application from New to Review; live status confirmed the browser-local change. |
| Authenticated mobile layout | Live Chrome verification at `390x844` | Pass | Intake, requisition, and search controls remained available; document width matched viewport width (`390/390`). |
| Velt disabled-runtime regression | `pnpm exec jest --runInBand src/components/velt/__tests__/VeltAuthProvider.test.tsx src/components/velt/__tests__/VeltGlobalLayer.test.tsx` | Pass | Missing and whitespace-only keys skip the provider; configured collaboration coverage remains intact. |

## Remaining Risk

- Prototype state intentionally resets on refresh. Real resume ingestion,
  persistence, provider integrations, communication workflows, and any
  AI-assisted evidence extraction remain deferred to later Phase 0 decisions.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] The local-auth blocker records cause, detection gap, prevention, owner,
  and next action.
