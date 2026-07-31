# Task: Unified Knowledge and Learning Implementation

Status: Complete
Owner: Codex S-knowledge-learning-implementation
Created: 2026-07-30
Task ID: AAI-1293
Linear Issue: [AAI-1293](https://linear.app/megankharrison/issue/AAI-1293/implement-unified-knowledge-and-learning-architecture)
Related Handoff: `docs/ops/handoffs/2026-07-30-S-knowledge-learning-implementation.md`

## Objective

Deliver one governed knowledge catalog and composable learning layer that lets
creators publish reusable content, learning admins assemble and assign courses,
employees start and complete learning, and executives inspect actionable
exceptions without duplicating authoritative source content.

Delivery lane: High-risk

Verification contract: Required

## Scope

- Additive Supabase catalog, learning, taxonomy, assignment, enrollment,
  progress, guard, trigger, view, and RPC contracts.
- Backfill existing resources, software guides, confirmed controlled SOPs, and
  approved static training guides without duplicating source bodies.
- Content Studio catalog, resource creation, course composition, review, and
  executive exception surfaces.
- Employee training home, unified library, course detail, and learner runner.
- Reuse current Training Docs, Documents, library, layout, table, and form
  owners through adapters and route links.
- Excludes replacing public Mintlify documentation, moving SOP bodies out of
  Documents, SCORM, certificates, and an external LMS.

## Acceptance Criteria

- [x] One catalog identity references each source without copying its body.
- [x] Existing resource and guide changes synchronize into the catalog.
- [x] Only the four confirmed controlled SOP documents are backfilled as SOPs.
- [x] Courses contain ordered sections and reusable catalog items.
- [x] Programs compose ordered courses.
- [x] Assignments resolve users, canonical roles, or all employees and create
      durable learner enrollments.
- [x] Employees can start, resume, and complete course items.
- [x] Content creators can enter through `/content` and reach the correct
      specialized editor or course builder.
- [x] Executives and learning admins can inspect publication, ownership,
      review, and learning exceptions.
- [x] Publishing, deletion, source integrity, permission, and completion
      failures are specific and actionable.
- [x] RLS protects drafts, restricted visibility, assignments, enrollments,
      progress, and administrative mutations.
- [x] All eight migrations are applied and present in the remote ledger.
- [x] Refreshed generated database types match the applied schema.
- [x] Authenticated desktop and mobile screenshots prove affected routes.
- [x] The creator-to-learner journey is proven end to end.

## Implementation Checklist

- [x] Files/modules to change were listed before edits.
- [x] Shared catalog and learning abstractions own cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, authentication, permission, and delivery contracts are handled.
- [x] Existing source-of-truth editors were identified before new UI work.
- [x] Static guide import is idempotent.
- [x] Legacy static guides and `/training-data` are documented transitional
      paths; public documentation remains owned by `alleato-docs-site`.

## Integration and Verification

- [x] Migration SQL contracts pass against the linked project.
- [x] Exact remote ledger readback contains all task migration versions.
- [x] Database types regenerate and `db:types:check` passes.
- [x] Focused database mutation and seed checks pass.
- [x] Route naming check passes.
- [x] Authenticated creator-to-learner browser journey passes.
- [x] Current desktop screenshots are recorded.
- [x] Current 390px mobile screenshots are recorded.
- [x] Independent high-risk review passes after all findings were resolved.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are queued for publication through the registered
      isolated-workspace closeout.

## Failure-Loudly Contract

- Cause surfaced as: database exceptions and UI blocker lists that name the
  missing source, owner, review, QA, audience, content, assignment target, or
  completion requirement.
- Detection path: migration verification, focused SQL tests, RPC responses,
  creator review queue, learner access state, route checks, and authenticated
  browser proof.
- Recovery path: direct link or named next action to repair the failing source,
  governance field, course structure, permission, or assignment.

## Incident Learning

- Failure fingerprint: owner-bypass read views, cross-learner admin results,
  missing starter-course role links, storage-oriented guide destinations,
  UI-only published-course guards, stale enrollment authorization,
  non-atomic resource creation, and conflicting dynamic guide segments.
- Root cause: security and lifecycle invariants were initially split between
  views, UI controls, and multi-step actions instead of being enforced at the
  database boundary and canonical route owner.
- Detection gap: initial compile and record-count checks did not impersonate a
  non-admin, forge direct mutations, revoke visibility after enrollment, or
  render every exact employee destination.
- Prevention: `security_invoker` read views, explicit current-learner filters,
  database mutation guards, an atomic resource RPC, idempotent seed checks,
  canonical training guide routing, `check:routes`, and authenticated route
  screenshots.
- Guardrail evidence: published-course structure changes, revoked enrollment
  progress, invalid-role resource creation, and partial resource writes all
  fail at the database boundary; the independent re-review passed.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Architecture | `docs/architecture/KNOWLEDGE-AND-LEARNING-ARCHITECTURE.md` | Pass | Shared catalog, specialized sources, and composable learning boundary documented. |
| Migrations | Eight `20260730*` knowledge and learning migrations | Pass | Applied and read back from `supabase_migrations.schema_migrations`. |
| Types | `npm run db:types`; `npm run db:types:check` | Pass | Generated schema matches the linked project through postgres-meta fallback. |
| Seed | `node scripts/training/backfill-knowledge-learning.mjs --check` | Pass | 4 guides, 4 courses, 3 programs, and 0 courses without role audiences. |
| SQL regression | Focused direct SQL/RPC verification | Pass | Published edits, revoked progress, invalid roles, and partial writes fail loudly. |
| Routes | `npm run check:routes` | Pass | Canonical `[guideSlug]` route retained; duplicate dynamic segment removed. |
| Frontend lint | Targeted ESLint on task-owned source | Pass | No task-owned lint failures. |
| Changed typecheck | `npm --prefix frontend run typecheck:changed` | Pass | No new explicit `any` or task-owned type regression. |
| Browser journey | Content Studio to course to enrollment to completion | Pass | Completion reached 100%; test enrollment, progress, and events were removed afterward. |
| Review | Independent security/data-integrity review and re-review | Pass | Four initial findings resolved; no release blocker remains. |
| Screenshots | `docs/ops/evidence/2026-07-30-knowledge-learning-implementation/` | Pass | Final desktop and mobile route evidence recorded. |

## Known Unrelated Failures

- Focused Jest component invocation is blocked by the existing test runner
  mismatch: `TypeError: this._moduleMocker.clearMocksOnScope is not a function`.
- The custom focused TypeScript project reports only the existing
  `frontend/src/components/ai-chat/sheet-editor.tsx(148,16)` missing
  `setActivePosition` member.
- The normal migration verifier is blocked by two unrelated local migrations
  sharing version `20260729190000`; exact linked-database ledger queries were
  used for this task.
- The development shell logs `/api/comments/all` 500 because Velt credentials
  are absent; this is outside the knowledge and learning boundary.

## Remaining Risk

- The shared guide reader still exposes links to developer-only knowledge tools
  for privileged users. The employee guide itself is accessible through the
  canonical training route, but the auxiliary tool navigation should be
  audience-filtered in a later owned change.
- Static guide and `/training-data` compatibility paths remain until their
  consumers are deliberately retired.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is recorded.
- [x] Deferred items include cause and prevention context.
