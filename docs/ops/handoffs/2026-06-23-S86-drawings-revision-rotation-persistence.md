# Handoff: 2026-06-23 - Drawings Revision Rotation Persistence

## Intake Block

1) Session ID: S86
2) Task ID: drawings-revision-rotation-persistence
3) Linear issue: AAI-614
4) Linear URL: https://linear.app/megankharrison/issue/AAI-614/add-drawings-review-queue-for-unpublished-revisions
5) Current status: Complete - Pushed
6) Files changed (absolute paths):
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-23-drawings-revision-rotation-persistence.md
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-23-S86-drawings-revision-rotation-persistence.md
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md
   - /Users/meganharrison/Documents/alleato-pm/supabase/migrations/20260623172600_add_drawing_revision_rotation_degrees.sql
   - /Users/meganharrison/Documents/alleato-pm/frontend/src/types/database.types.ts
   - /Users/meganharrison/Documents/alleato-pm/frontend/src/services/drawings/types.ts
   - /Users/meganharrison/Documents/alleato-pm/frontend/src/services/drawings/DrawingRevisionService.ts
   - /Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/drawings/route.ts
   - /Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/drawings/__tests__/route.test.ts
   - /Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/use-drawing-upload.ts
   - /Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/__tests__/use-drawing-upload.test.tsx
   - /Users/meganharrison/Documents/alleato-pm/docs/architecture/PROJECT-MAP.md
   - /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/app-surface/app-surface.generated.json
7) Commands run and outcome (pass/fail counts): 7 pass, 3 expected/handled failures
   - FAIL/HANDLED: `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts` exited 1 and wrote a short failure payload to stdout; restored `frontend/src/types/database.types.ts` from `HEAD`.
   - PASS: `npm --prefix frontend run test:unit -- --runTestsByPath 'src/app/api/projects/[projectId]/drawings/__tests__/route.test.ts' src/hooks/__tests__/use-drawing-upload.test.tsx src/components/drawings/__tests__/DrawingUploadDialog.partial-failure.test.tsx`.
   - PASS: `cd frontend && npx eslint 'src/app/api/projects/[projectId]/drawings/route.ts' 'src/app/api/projects/[projectId]/drawings/__tests__/route.test.ts' src/services/drawings/DrawingRevisionService.ts src/services/drawings/types.ts src/hooks/use-drawing-upload.ts src/hooks/__tests__/use-drawing-upload.test.tsx src/components/drawings/DrawingUploadDialog.tsx src/components/drawings/__tests__/DrawingUploadDialog.partial-failure.test.tsx --no-warn-ignored`.
   - PASS: `npm --prefix frontend run typecheck:changed`.
   - PASS: `npm run map:project`.
   - FAIL/HANDLED: first ledger insert attempt used shell-expanded dollar quotes after the SQL migration had already applied; reran the ledger insert with a quoted heredoc.
   - FAIL/HANDLED: first `codex:finish` attempt caught an unsafe `as unknown as FileList` double-cast in the new hook test; replaced it with a typed `createFileList` helper and reran targeted checks.
   - PASS: `npm run db:migrations:verify-applied -- supabase/migrations/20260623172600_add_drawing_revision_rotation_degrees.sql`.
   - PASS: Remote readback confirmed `rotation_degrees:integer:0` and constraint `drawing_revisions_rotation_degrees_check`.
   - PASS: Transaction-rolled-back DB proof inserted a temporary revision with `rotation_degrees=180`, read back `rotation_persistence=180`, and rolled back.
8) Evidence artifacts (screenshot/video/report/log paths):
   - Task ledger evidence: `docs/ops/tasks/2026-06-23-drawings-revision-rotation-persistence.md`
   - Migration file: `supabase/migrations/20260623172600_add_drawing_revision_rotation_degrees.sql`
9) Top 3 findings (frontend-visible issues first):
   - Fixed: reviewed upload rotation is now persisted on `drawing_revisions.rotation_degrees`.
   - Fixed: the drawing upload API normalizes unsupported rotation values to `0` instead of storing invalid values.
   - Fixed: the real batch upload hook now preserves `rotation_degrees` through the API POST body.
10) Recommended next action (one line): Wire persisted revision rotation into the viewer initial rotation, then implement actual PDF/image byte transformation if needed.
11) Handoff file path: docs/ops/handoffs/2026-06-23-S86-drawings-revision-rotation-persistence.md
12) Migration ledger evidence: `npm run db:migrations:verify-applied -- supabase/migrations/20260623172600_add_drawing_revision_rotation_degrees.sql` passed for `20260623172600`.

## Linear Updates

- Kickoff comment: covered under AAI-614 continuation.
- Milestone comments:
- Completion/blocker comment: 1eb270fd-2bd0-41e4-ab31-8bbc52ed139d

## Current Status

Implemented, migration applied, verified locally/remotely, and pushed to `origin/main`.

## Exact Next Step

No action required for this slice. Continue remaining Drawings parity as separate scoped tasks.

## Known Pitfalls

- Supabase type generation via CLI failed before edits because the configured access token is not accepted by the Supabase CLI. The migration was applied through `DATABASE_URL`, verified against the remote ledger, and the local generated type was patched to match the applied schema.
- This slice stores rotation metadata only. It does not rotate the stored PDF/image bytes or initialize the viewer from this column yet.
- Do not include unrelated dirty files from active AI/table/viewer slices when finishing.
- An initial finish commit `6b8ac8be0` accidentally included unrelated AI/gallery changes. Repair commit `68b4a06db` restored those files before the actual S86 commit `f44063f6`.

## Resume Commands

```bash
npm run linear:codex:check -- docs/ops/handoffs/2026-06-23-S86-drawings-revision-rotation-persistence.md
```

## Evidence

- Targeted Jest - PASS.
- Targeted ESLint - PASS.
- Changed-file typecheck - PASS.
- Supabase migration ledger - PASS.
- Remote DB column/constraint readback - PASS.
- Transaction-rolled-back rotation persistence proof - PASS.
