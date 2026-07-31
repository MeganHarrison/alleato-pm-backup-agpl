# Task: Training resource reviewer and publish flow

Status: Complete
Owner: Session S224
Created: 2026-07-26
Task ID: ALL-24
Linear Issue: https://linear.app/alleato-group/issue/ALL-24/t10-reviewer-publish-flow
Related Handoff: `docs/ops/handoffs/2026-07-26-S224-training-review-flow.md`

## Objective

Give active app admins one authenticated review queue where they can publish or
archive pending training resources, while ordinary authenticated users remain
unable to read the queue or perform either mutation.

## Scope

- Owned: `/training/review`, its server action and focused tests, canonical
  training data-access review mutation, the shared training resource row,
  app-admin contextual entry point, generated route maps, this task, and its evidence.
- Explicit exclusion: source discovery/seeding (ALL-17), finder automation
  (ALL-22), schema/RLS redesign, editing candidate metadata, and unrelated
  training-doc authoring workflows.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/training/**` over
  `public.training_resource` and its existing `current_is_app_admin()` RLS.
- Existing shared primitives/services: `PageShell`, `ResourceCard`,
  `current_is_app_admin()`, and the existing `/training` contextual action
  pattern.
- Deprecated or parallel paths: `frontend/src/features/training-docs/**` and
  `/training-docs` are a separate workflow-manual authoring system.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Contract

- An app admin can see every `status = review` candidate at `/training/review`.
- Publishing performs a review-only compare-and-set, records reviewer/publisher
  audit fields, and makes the row visible through the learner's canonical
  published-resource query.
- Archiving performs a review-only compare-and-set and records review audit
  fields without publishing the row.
- A normal authenticated user is redirected before review data loads, does not
  see the contextual reviewer action, and remains denied by live RLS.
- Concurrent/stale decisions fail with a named “no longer pending review”
  error instead of silently overwriting state.

## Attention Brief

- Primary user: app admin reviewing machine-imported or manually seeded training.
- Primary job: decide whether one pending resource is safe and useful to publish.
- Primary decision: publish or archive after opening the source.
- Tier 1: resource title, description, source link, and the two decisions.
- Tier 2: provider, type, level, role/topic/track context.
- Hide until requested: audit IDs/timestamps and learner filters.
- Remove: KPI/count cards, wrapper panels, bulk actions, helper banners,
  duplicate navigation, and decorative badges/icons.
- Primary action: Publish.
- Failure-loudly behavior: the row stays visible and announces the exact failed
  decision; stale rows name the compare-and-set conflict.

## Acceptance Criteria

- [x] Reviewer can publish a pending item.
- [x] Reviewer can archive a pending item.
- [x] Normal user cannot see or mutate review items.
- [x] Published item appears through the learner library query.
- [x] Failure-loudly behavior is covered by focused regressions and the review UI.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Existing training/RLS/page/navigation owners are identified.
- [x] Shared data access owns the review-only mutation.
- [x] Errors are specific and actionable.
- [x] Live Supabase types match the checked-in generated contract before DB code.

## Integration and Verification

- [x] Focused data-access, page, action, component, and navigation tests pass.
- [x] Existing transactional RLS test passes against the linked database.
- [x] Authenticated admin production browser flow is captured at desktop/mobile.
- [x] Independent reviewer approves the permission and stale-write boundary.
- [x] Release deployment is Ready and task-owned files are on `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: named authorization, query, mutation, or stale-decision message.
- Detection path: page/action unit tests, transactional RLS test, and production browser state.
- Recovery path: refresh the queue; retry only if the candidate is still pending,
  otherwise inspect its current published/archived state.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | High-risk acceptance, permission, stale-write, and release gates captured before implementation. |
| Supabase types | Live `supabase gen types` comparison | Pass | Checked-in `database.types.ts` matches the live public schema. |
| Linear kickoff | [ALL-24 kickoff comment](https://linear.app/alleato-group/issue/ALL-24/t10-reviewer-publish-flow#comment-4930c0e2) | Pass | Issue moved from Backlog to In Progress with exact non-overlapping scope. |
| Focused regression | `npx jest --runTestsByPath … --runInBand` | Pass, 60/60 | Seven suites cover the reviewer authority, learner entry point, queue, action, data access, shared row, and navigation invariants. |
| Focused lint | `npx eslint … --max-warnings=0` | Pass | No diagnostics in the task-owned reviewer surface. |
| Repository typecheck | verification worker | Owned boundary pass | The repository command exits 2 with 192 pre-existing diagnostics; zero diagnostics resolve to S224-owned files. |
| Route and generated maps | route guard plus project/system map generation | Pass | `/training/review` is registered without a generic dynamic segment or duplicate surface. |
| Live RLS contract | linked Supabase Management API transaction using `supabase/tests/training_resource_library.sql` | Pass | Admin publish/archive audit, ordinary-user denial, and learner visibility all passed; the transaction was rolled back. |
| Independent review | reviewer verdict in the related handoff | Approved | Reviewer caught two authority mismatches; both were removed before final approval. |
| Vercel release | `dpl_ATupdV8JhD4abG7k4bUdr7FnYN76` | Ready | Build log verifies `The-Alleato-Group/project-management@main` at `51e0e61aec6e`; aliased to `projects.alleatogroup.com`. |
| Desktop visual | `docs/ops/tasks/2026-07-26-training-review-flow.desktop.png` | Production pass | Authenticated 1440×1000 queue; zero browser errors, no overflow, and zero inline iframes. |
| Mobile visual | `docs/ops/tasks/2026-07-26-training-review-flow.mobile.png` | Production pass | Authenticated 390×844 queue; zero browser errors, no overflow, and zero inline iframes. |
| Linear closeout | [ALL-24 closeout comment](https://linear.app/alleato-group/issue/ALL-24/t10-reviewer-publish-flow#comment-8cb8d931) | Pass | Exact release evidence posted and issue moved to Done. |
| Linear handoff checker | `npm run linear:codex:check -- docs/ops/handoffs/2026-07-26-S224-training-review-flow.md` | Unrelated control-plane failure | Cause: the checker accepts only legacy `AAI-###` identifiers. Detection: the real `ALL-24` value failed its format regex. Prevention: broaden the shared checker to current Linear team identifiers; actual Linear read/write and closeout succeeded. |

## Noise Gate

- Noise gate: Pass for the release candidate.
- Removed or simplified: the duplicate global reviewer nav item, redundant status
  badges, wrapper panels/count cards, and video embeds in the dense queue.
- Remaining risk: editorial quality of each imported candidate still requires a
  human reviewer before using Publish.
- Regression guardrail: focused component/page permission assertions plus
  desktop/mobile production proof.

## Remaining Risk

- The live queue currently contains imported candidates. No real candidate was
  published or archived during verification because those editorial decisions
  remain user-owned; the linked database mutation boundary was proven with a
  rolled-back transactional fixture.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in through production verification.
- [x] Incident learning is explicitly N/A.
- [x] ALL-17 source/seeding remains assigned to its existing owner.
