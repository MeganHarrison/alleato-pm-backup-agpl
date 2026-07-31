# Handoff: 2026-07-30 - Unified Knowledge and Learning

## Intake Block

1) Session ID: S-knowledge-learning-implementation
2) Task ID: AAI-1293
3) Linear issue: AAI-1293
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1293/implement-unified-knowledge-and-learning-architecture
5) Current status: Complete, publication closeout in progress
6) Files changed: task-owned paths listed below
7) Commands run and outcome: database types, schema readback, seed check,
   focused SQL regressions, route check, changed typecheck, targeted ESLint,
   authenticated desktop/mobile browser journeys, and independent review pass
8) Evidence artifacts:
   `docs/ops/evidence/2026-07-30-knowledge-learning-implementation/`
9) Top findings:
   - One source-backed catalog can serve documentation, SOPs, resources, and
     training without copying their authoritative content.
   - Courses are an ordered delivery layer over reusable catalog items, not a
     competing content type or storage system.
   - Security, publishing, and learning-progress invariants must be enforced in
     Supabase, not only hidden in creator UI.
10) Recommended next action: operate the new system, migrate remaining static
    guide consumers deliberately, and add audience filtering to auxiliary
    developer-tool links in the shared guide reader.
11) Handoff file:
    `docs/ops/handoffs/2026-07-30-S-knowledge-learning-implementation.md`
12) Migration ledger evidence: all versions below were applied and read back
    from the linked project.

## Delivered Architecture

- A shared knowledge catalog stores identity, lifecycle, audience, taxonomy,
  ownership, review, and source pointers while source systems retain bodies.
- Specialized sources remain specialized: public product docs in Mintlify,
  controlled SOPs in Documents, software guides in Training Docs, resources in
  their resource editor, and structured courses in the learning layer.
- Programs compose courses; courses compose ordered sections; sections
  reference reusable catalog content.
- Assignments materialize durable enrollments so learner queries remain fast
  and audit history is stable even when targeting rules change later.
- Read views use invoker security and learner queries are explicitly scoped to
  the current user.

## Delivered Frontend

- Creator and executive surfaces:
  - `/content`
  - `/content/courses/new`
  - `/content/courses/[courseId]`
  - `/content/resources/new`
  - `/training/manage`
- Employee surfaces:
  - `/training`
  - `/training/library`
  - `/training/courses/[courseSlug]`
  - `/training/learn/[enrollmentId]`
  - `/training/content/[contentId]`
  - `/training/guides/[guideSlug]`
- Existing page shells, the canonical unified table, form primitives, training
  guide reader, and navigation owners were reused.

## Database and Data Delivery

Applied migrations:

1. `20260730220949_knowledge_learning_foundation.sql`
2. `20260730222513_fix_learning_enrollment_enum_casts.sql`
3. `20260730230400_secure_learning_read_views.sql`
4. `20260730231500_add_internal_course_content_kind.sql`
5. `20260730231600_fix_learning_course_catalog_kind.sql`
6. `20260730234500_harden_learning_mutations.sql`
7. `20260730235200_fix_learning_progress_guard_relation_dispatch.sql`
8. `20260730235800_sync_training_doc_delivery_metadata.sql`

Seed/readback:

- 4 approved software guides imported
- 4 starter courses created
- 3 starter programs created
- 0 starter courses without a role audience
- only 4 confirmed controlled SOPs categorized as SOPs
- 75 assignment/enrollment records materialized without inventing compliance
  requirements

## Security and Integrity Proof

- Published-course section insertion is blocked with `23514`.
- Published-course item deletion is blocked with `23514`.
- Starting a revoked enrollment is blocked with `42501`.
- Completing a revoked item is blocked with `42501`.
- Resource creation with an invalid role is blocked with `23503`.
- Atomic resource rollback leaves 0 partial rows.
- Independent re-review passed with no remaining release blocker.

## Browser Proof

- Authenticated creator catalog, create menu, course builder, resource form, and
  management routes render in the real app shell.
- Authenticated employee home, library, course overview, guide reader, and
  learner runner render in desktop and mobile layouts where responsive behavior
  changed.
- A real enrollment was started and completed to 100%, then the temporary
  events, progress, and enrollment were deleted.
- The exact software guide route
  `/training/guides/create-an-owner-invoice` renders the source-backed guide.

Primary artifacts:

- `content-studio-desktop-final.png`
- `content-studio-mobile-final.png`
- `training-home-desktop-final.png`
- `training-home-mobile-final.png`
- `training-library-desktop-final.png`
- `training-library-mobile-final.png`
- `course-builder-desktop-final.png`
- `course-builder-mobile-final.png`
- `learner-runner-completed-desktop-final.png`
- `software-guide-desktop-final.png`

## Noise Gate

- Pass.
- Removed the hard-coded training hero/module model as the primary employee
  workflow and replaced it with assignment-first learning and one queryable
  library.
- Avoided stat-card rows, nested cards, duplicate primary actions, decorative
  dashboards, and a second generic rich-text editor.
- Remaining risk: auxiliary knowledge-tool navigation in the reused guide
  reader needs audience filtering in a later owned change.
- Regression guardrail: shared data access, database views/RPCs, route naming
  checks, and final-route screenshots own the behavior.

## Known Unrelated Failures

- Jest runner mismatch:
  `TypeError: this._moduleMocker.clearMocksOnScope is not a function`.
- Existing TypeScript error:
  `frontend/src/components/ai-chat/sheet-editor.tsx(148,16)` references missing
  `setActivePosition`.
- Repository migration verification command encounters unrelated duplicate
  version `20260729190000`; exact database ledger readback passed instead.
- Velt comments endpoint returns 500 in local development because Velt
  credentials are missing.

## Task-Owned Paths

- `docs/architecture/KNOWLEDGE-AND-LEARNING-ARCHITECTURE.md`
- `docs/ops/tasks/2026-07-30-knowledge-learning-implementation.md`
- `docs/ops/handoffs/2026-07-30-S-knowledge-learning-implementation.md`
- `docs/ops/evidence/2026-07-30-knowledge-learning-implementation/`
- `supabase/migrations/202607302*.sql`
- `frontend/src/types/database.types.ts`
- `frontend/src/lib/learning/`
- `frontend/src/features/content-studio/`
- `frontend/src/features/training/`
- `frontend/src/app/(main)/content/`
- `frontend/src/app/(main)/training/`
- `frontend/src/lib/navigation-config.ts`
- `scripts/training/backfill-knowledge-learning.mjs`

## Resume Commands

```powershell
Set-Location 'C:\Users\KimiClaw\.codex\isolated-workspaces\s-knowledge-learning-implementation-knowledge-learning-implementation-ec66d0'
git status --short --branch
node scripts/ops/isolated-session-workspace.mjs status --session S-knowledge-learning-implementation
```
