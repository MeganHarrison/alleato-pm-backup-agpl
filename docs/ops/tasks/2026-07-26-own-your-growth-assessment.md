# Task: Own Your Growth Assessment (T14)

Status: Done
Owner: Codex S238
Created: 2026-07-26
Task ID: LOCAL-2026-07-26-OWN-YOUR-GROWTH-T14
Linear Issue: Linear connector unavailable in this session; the existing Training project and T14 references are recorded in `specs/training-module-spec.md` and `docs/ops/tasks/2026-07-26-training-hub-and-static-content.md`.
Related Handoff: N/A (single-session scoped change)

## Objective

Port the existing standalone My Growth experience into Alleato-PM so an
authenticated employee can complete a role-based self-assessment, see a live
Skill Wheel, commit to the widest focus gaps, and revisit private 30/60/90-day
check-ins from `/training/growth`.

## Scope

- Add `/training/growth` to the authenticated Training module and shared tabs.
- Port the assessment inputs and dashboard behavior from
  `Alleato-Training-Platform/app/app.v2.js`.
- Build on T14's published `training_role_skill` library and hardened canonical
  score snapshots.
- Extend `training_skill_checkin` with private evidence, action plans, feedback,
  and 30/60/90-day cadence fields while retaining owner-only RLS.
- Link the existing Skill Wheel hub tile to the completed route.
- Add focused unit, route, database-contract, and browser-flow coverage.
- Explicit exclusion: T15 Ask the Library and the separate manager coaching
  guide.

## Source of Truth

- Canonical behavior/content:
  `C:/Users/Brandon/Downloads/Alleato-Training-Platform/index.html`,
  `data/data.js`, and `app/app.v2.js`.
- Canonical app route: `frontend/src/app/(main)/training/growth/**`.
- Existing shared primitives: `PageShell`, shared Training tabs, `Button`,
  `Input`, `Select`, `DateField`, and open divided-row layouts.
- Canonical persistence owner:
  `frontend/src/features/training/skill-growth-server.ts` plus Supabase RLS.
- Deprecated path: standalone browser `localStorage` key
  `alleato.assessments.v1`; production does not copy private assessment data
  into browser-only storage.

Delivery lane: High-risk

Verification contract: Required

## Product Noise Gate

- Primary user: an Alleato employee in the field or office.
- Primary job: choose the few skills to practice next and define observable
  repetitions.
- Primary decision: which widest gaps deserve focus before the next
  check-in.
- Tier 1 content: latest wheel, focus actions, and next-check-in cadence.
- Hidden until requested: older check-in detail beyond the concise trend row.
- Removal candidates: duplicate hero CTA, aggregate stat cards, decorative
  wrappers, and the prototype's print-only report.
- Primary action: `Save check-in`.
- Failure-loudly behavior: an unsuccessful save retains the draft and names the
  recovery action; the dashboard never reports saved state before database
  readback succeeds.

Noise gate status: Pass for planned implementation.

## Acceptance Criteria

- [x] `/training/growth` opens from the shared `My Growth` tab and Module 2 tile.
- [x] The role selector suggests the authenticated employee's exact role when available and remains manually selectable.
- [x] The selected role loads its canonical, administrator-owned skill library;
      learner saves cannot rename or substitute role skills.
- [x] Every skill accepts an exact 0-100 score, a target, and recent evidence.
- [x] The accessible live Skill Wheel updates from the current scores and target
      ring without requiring canvas-only interpretation.
- [x] Focus areas are ranked by `target - score`, matching the standalone
      implementation and Method content, and limited to the top four
      positive gaps.
- [x] Each focus area records a concrete action, frequency, and measure.
- [x] Saving upserts a private per-user, per-role, per-day check-in and returns
      the persisted row.
- [x] The dashboard shows the latest assessment, prior average trend, score
      changes, and the selected 30/60/90-day cadence.
- [x] Users cannot read or write another user's check-ins, including by changing
      a request payload or direct database access.
- [x] Validation, authorization, and database failures surface specific recovery
      guidance and do not silently fall back to local storage.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database and authentication contracts are enforced by both the server
      boundary and RLS.

Planned owners:

- `supabase/migrations/20260726234500_create_training_growth_checkins.sql`
- `supabase/tests/training_growth_checkins.sql`
- `frontend/src/features/training/skill-growth.ts`
- `frontend/src/features/training/skill-growth-server.ts`
- `frontend/src/features/training/SkillGrowthClient.tsx`
- `frontend/src/app/api/training/growth/**`
- `frontend/src/app/(main)/training/growth/**`
- `frontend/src/features/training/{hub-content,index,nav-tabs}.ts`
- `frontend/src/types/database.types.ts`
- Focused tests beside the changed modules plus
  `frontend/tests/e2e/training-growth.spec.ts`

## Integration and Verification

- [x] Migration compile and SQL RLS probes pass.
- [x] Focused model/data-access/component/route tests pass.
- [x] Focused ESLint and TypeScript checks pass.
- [x] Authenticated browser proof covers first assessment, save/readback,
      refresh persistence, and a second check-in at desktop and mobile widths.
- [x] Database readback confirms rows belong only to the authenticated test user.
- [x] Independent review finds no blocking correctness, security, or
      accessibility issue.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a named validation, authentication, authorization, or
  database operation error.
- Detection path: inline alert plus route/API log and focused negative-path test.
- Recovery path: keep the in-memory draft, correct the named field or retry the
  save, and refresh only after a successful persisted-row response.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Migration compile | Rollback-only linked `supabase db query` | Pass | Exact migration compiled without persisting during preflight. |
| Migration ledger | `supabase migration list --linked` | Pass | Base `232000`, extension `234500`, score hardening `27002000`, legacy/metadata hardening `27010000`, and cadence enforcement `27013000` align locally and remotely. |
| Database contract | `supabase db query --linked --file supabase/tests/training_growth_checkins.sql` | Pass | Owner ID/read/write, cross-user select/update/insert denial, legacy repair, canonical metadata, focus rank, and cadence tamper rejection passed inside rollback. |
| Focused tests | Seven Jest suites | Pass | 25 tests passed. |
| Focused typecheck | Temporary scoped `tsc --project tsconfig.codex-growth.json` | Pass | Growth route, UI, server, model, generated DB types, and Playwright spec passed; the temporary config was removed. |
| Focused lint | Targeted ESLint command | Pass | No warnings or errors. |
| Authenticated browser | Playwright plus in-app browser | Pass | Fill/save/readback/reload/mobile automation passed; two real dated check-ins and trend survived reload. |

## Remaining Risk

- The source interface says "impact x gap" in one label, but its executable
  ranking and Method copy use gap only. This port follows the working code and
  Method: `target - score`.
- Historical standalone localStorage records are browser-local and cannot be
  associated safely with an authenticated employee automatically. No implicit
  migration is attempted.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
