# Task: Engagement Analytics

Status: In Progress
Owner: Codex
Created: 2026-07-31
Task ID: ENGAGEMENT-ANALYTICS
Linear Issue: Not requested
Related Handoff: `docs/ops/handoffs/2026-07-31-SENGAGE-engagement-analytics.md`

## Objective

Give authorized administrators an accurate, privacy-limited view of recent sign-ins, active app sessions, and individual training-video progress, including training content hosted by the separate documentation site.

## Scope

- Extend the canonical `/analytics` admin route with an engagement view.
- Add a durable session ledger and per-user learning-content progress model using the existing shared knowledge/learning identity owner.
- Track supported app-based video lessons, including docs-hosted media played through an authenticated Alleato lesson route.
- Configure aggregate, anonymous Mintlify docs analytics through the existing PostHog project.
- Explicit exclusion: no retrospective reconstruction of historical app sessions or anonymous docs visitors.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(admin)/analytics`, Supabase Auth, and Supabase public schema.
- Existing shared primitives/services: `PageShell`, `SectionRuleHeading`, `serviceDb`, `TrainingResourcePageContent`, and `resolveTrainingEmbed`.
- Deprecated or parallel paths: `users_auth.last_login_at` is not a sign-in source; the docs site remains owned by `The-Alleato-Group/alleato-docs-site`.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `/analytics` shows the latest real Supabase Auth sign-in for each applicable user.
- [x] App usage distinguishes latest sign-in from a recorded active application session without recording sensitive page content.
- [x] A stable learning-content identity and user progress model remain separate from training catalog and authoring tables.
- [x] App lesson players persist start, 25/50/75%, and 90%-completion progress for MP4/WebM, YouTube, Vimeo, and Loom.
- [x] A docs-hosted lesson can be launched in the authenticated app and reports attributable progress; direct docs analytics are explicitly anonymous.
- [ ] Admin and write-path failures surface specific, actionable states.

## Implementation Checklist

- [x] Files/modules and ownership boundaries are listed before edits.
- [ ] Shared database/API abstraction owns cross-cutting behavior.
- [ ] Errors are specific and actionable.
- [ ] Database, provider, authentication, permission, and external-delivery contracts are handled.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome.
- [ ] Evidence artifacts are recorded.
- [ ] Independent review is recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the engagement API names the unavailable data source or event type; the admin view identifies an unavailable reporting source instead of rendering an empty result.
- Detection path: focused API/player tests, migration ledger readback, and authenticated browser flow.
- Recovery path: an admin can retry reporting; unsupported video providers show a direct explanation and preserve the original source link.

## Incident Learning

- Failure fingerprint: `analytics-shared-owner-drift`
- Root cause: a stale source snapshot obscured the already-deployed `knowledge_content_item` learning core, so the first migration created a parallel learning identity table.
- Detection gap: the live schema check was initially limited to legacy training tables.
- Prevention: forward-correct before runtime writers exist, then require both repository and live-schema ownership lookup before each new cross-cutting table.
- Guardrail evidence: `20260731153100_reconcile_engagement_with_learning_core.sql` removes the parallel owner before any runtime code can write it; `20260731153200_create_learning_content_progress.sql` attaches standalone-video progress to the existing `knowledge_content_item` identity.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and high-risk completion gate recorded before implementation. |
| Isolation | Clean `origin/main` worktree | Pass | Canonical checkout was 49 commits behind with unrelated dirty work; session provisioner also failed dependency setup. |
| Schema preflight | Transactional migration parse and remote ledger readback | Pass | Migration syntax parsed against production and was timestamped after remote version `20260731150500`; broad `db push` is unsafe because this checkout lacks several remote migrations. |
| Ownership correction | Live schema and migration-ledger readback | Pass | Forward migrations `20260731153100` through `20260731153400` removed the parallel tables, retained the app-session ledger, added docs source integrity, and seeded two canonical docs-video identities. |
| Exact migration verification | `npm run db:migrations:verify-applied` | Deferred - unrelated repo debt | The task migrations are present in the remote ledger, but the shared checker stops on pre-existing duplicate local version `20260729190000` before it reaches this task. Direct ledger readback is recorded above. |
| Focused unit tests | `npm run test:unit -- --runInBand src/features/training/__tests__/embed-policy.test.ts src/features/training/__tests__/training-resource-page.test.tsx` | Pass | 2 suites, 5 tests. |
| Frontend typecheck | `npm run typecheck` | Pass | Completed against the manually reconciled live-schema types. |
| Authenticated desktop proof | `/tmp/sengage-analytics-final.png` | Pass | `/analytics` shows real Auth sign-ins and a recorded app session. |
| Authenticated mobile proof | `/tmp/sengage-analytics-mobile-final.png` | Pass | 390px `/analytics` preserves readable table hierarchy. |
| Authenticated lesson proof | `/tmp/sengage-docs-video-final.png` | Pass | Docs-hosted prime-contract walkthrough renders inside the protected tracked lesson route. |
| Learning event write | Browser-authenticated POST + direct state readback | Pass | The docs lesson persisted checkpoint `25` and 30 watched seconds for the authenticated admin. |
| Atomic progress write | `record_video_learning_progress(..., 50::smallint, 60, 30)` + readback | Pass | Atomic function advanced the canonical record to checkpoint `50` and 60 seconds. An initial smoke command used an uncast integer literal, correctly failed function resolution, and was rerun against the exact `smallint` contract. |
| Docs delivery | `alleato-docs-site` commit `159a900`; `docs.alleatogroup.com` readback; Vercel Ready deployment | Pass | Mintlify configuration and two authenticated tracking links reached the rendered docs site. |
| Independent review | `engagement_review` | Remediated | Review found missing provider subscriptions, over-broad content acceptance, and race-prone progress writes. The release now uses YouTube iframe API polling, Vimeo and Loom event subscriptions, content-kind/source enforcement, and atomic `record_video_learning_progress`. |
| Remediation re-review | `engagement_review` | Pass with residual test risk | Provider subscriptions, video/source enforcement, and atomic RPC are confirmed resolved. Provider and trackable-identity unit coverage has been added; database concurrency retains direct transactional smoke evidence. |

## Remaining Risk

- Video-provider postMessage contracts can change. The player adapter will explicitly report unsupported provider tracking rather than silently claim progress.
- Provider events remain an external contract. The shared tracker restricts accepted origins and provider-contract tests cover the Loom and Vimeo subscription/message boundary.
- The local Supabase type generator needs Docker and could not reach its daemon; generated types were manually reconciled from `\\d+` live-schema output and will be typechecked with the app.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
