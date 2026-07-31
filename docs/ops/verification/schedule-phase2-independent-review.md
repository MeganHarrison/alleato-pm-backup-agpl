# Schedule Phase 2 Independent Re-Review

Decision: **APPROVED**

- Reviewed at: 2026-07-21T23:51:35-04:00
- Reviewer: Codex independent reviewer `/root/schedule_phase2_review`
- Working checkout: `C:\Users\Brandon\Documents\Codex\pm-main`
- Comparison baseline: current working tree against `origin/main` at `93d3b1435e00631fa11804c6d495ec3a62966f81`
- Scope: focused re-review of the prior blocking findings and the resulting task-owned diff.
- Review history: this decision supersedes the earlier `CHANGES_REQUESTED` decision in this artifact.

## Final Findings

No blocking correctness, migration-safety, authorization, silent-failure, React accessibility, or focused-test issue remains in the reviewed Phase 2 reconciliation.

The final remote-overlap reconciliation was also reviewed: `origin/main` removed the lag input placeholder, and the working diff preserves that removal while retaining the approved `-365..365` bounds, lead/lag label, accessible helper text, and negative-lead behavior. The focused dependency-editor suite passes 3/3 against this baseline.

### Post-approval publisher buffer change: approved

The additional local change to `scripts/ops/remote-main-publish.mjs` is safe and correctly scoped. It defines a 64 MiB `COMMAND_OUTPUT_BUFFER` and passes it as `maxBuffer` to the existing shell-free `execFileSync` wrapper. No command, argument, file-selection, compare-and-swap, retry, GitHub API, or force-push behavior changed.

The generated `frontend/src/types/database.types.ts` is 1,395,727 bytes, which exceeds Node's default 1 MiB child-process output buffer and explains the observed `ENOBUFS`. A reviewer dry run using that generated file completed successfully with the patch, and `node --check scripts/ops/remote-main-publish.mjs` passed. Commands remain sequential, so the change creates a bounded per-command capture allowance rather than parallel 64 MiB allocations; output above that explicit limit still fails loudly. Because `execFileSync` continues to receive a command and argument array without `shell: true`, the larger buffer does not introduce command-injection risk.

### Post-approval exact-byte preservation change: approved

The follow-up change removes the global `.trim()` from `run()` and trims only the `git remote get-url origin` result in `repository()`. This is the correct ownership boundary:

- `sourceFiles()` now receives exact `git show` blob text, preserving leading whitespace, trailing spaces, final newlines, and intentional no-final-newline files;
- `repository()` still normalizes the one line that must be matched as a URL;
- `api()` remains correct because `JSON.parse` accepts surrounding JSON whitespace;
- error formatting still trims only diagnostic stderr and does not affect published content;
- the 64 MiB output guard, shell-free execution, exact-file selection, compare-and-swap update, retry behavior, and non-force ref update are unchanged.

Reviewer checks passed: `node --check`, a dry run reading the generated database types, and an exact Git blob comparison of the 24 republished files. The comparison reported `published_file_count=24` and `published_file_drift_count=0` between source commit `a1ec5145f672f3c9c538087a1a4cb11e87a5f405` and remote commit `08d0469f0b97d4d50da887bb8dac3b5700f6d727`.

The byte-corrected scheduling publication is confirmed on `origin/main` at `08d0469f0b97d4d50da887bb8dac3b5700f6d727`. Both publisher adjustments are **APPROVED** and do not change the overall decision.

### Post-approval binary-safety change: approved

The binary-safety patch to `scripts/ops/remote-main-publish.mjs` is correct and closes the remaining blob-corruption path:

- `run()` retains UTF-8 as the default for repository metadata and GitHub JSON responses, but accepts an explicit encoding;
- `sourceFiles()` calls `git show` with `encoding: null`, receiving a raw Node `Buffer` without UTF-8 decoding or replacement characters;
- each raw blob is converted with `Buffer.toString("base64")` and sent to the GitHub Git Data blob endpoint with `encoding: "base64"`;
- text and binary files now use the same byte-preserving path, so final newlines, invalid UTF-8 byte sequences, image signatures, and arbitrary binary data survive unchanged;
- repository URL trimming, JSON response parsing, shell-free execution, the 64 MiB raw-output limit, exact-file selection, compare-and-swap retry, and non-force ref update remain unchanged;
- base64 is produced by Node rather than accepted from an external caller, so malformed base64 cannot enter through this code path.

Focused reviewer checks passed: `node --check`, `git diff --check`, a dry run containing both a PNG and the 1.4 MB generated database types file, and a raw-buffer/base64 round trip of a valid repository PNG. The valid PNG retained the standard `89504e470d0a1a0a` signature and compared byte-for-byte equal after base64 decode.

The failure was independently reproduced in the pre-patch closeout artifact on `origin/main`: its first bytes are UTF-8 replacement sequences (`efbfbd...`) rather than an image signature. The local artifact has now been converted in place to a true PNG. Independent readback confirms a 231,843-byte file, the standard `89504e470d0a1a0a` PNG signature, an `IHDR` chunk, dimensions of 1536 by 791, and a byte-equal base64 round trip. Visual inspection confirms the schedule-calendar evidence remains unchanged and readable. The prior extension/content mismatch is resolved.

The binary publisher change is **APPROVED**. The task still needs the repaired screenshot publication plus the already-recorded deployment/browser closeout evidence before completion.

This is code-review approval, not a task-completion claim. The task must remain `In Progress` until the repository's required publication, authenticated production browser proof, visual evidence, and `HEAD == origin/main` checks are complete.

## Resolved Blocking Findings

### Dependency authorization and scheduling invariants: resolved

The new forward migration `supabase/migrations/20260722021500_harden_schedule_dependency_boundary.sql` establishes the database as the authoritative boundary:

- enables RLS on `public.schedule_dependencies`;
- removes all `anon` table privileges;
- creates separate authenticated `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies;
- scopes every policy through a security-definer helper that requires both task endpoints to share a project and requires current project membership or app-admin status;
- constrains `lag_days` to a non-null integer from `-365` through `365`;
- adds a database trigger that rejects self-referential and transitive dependency cycles, including updates while excluding the row being replaced.

Independent live readback confirmed:

- `relrowsecurity = true`;
- exactly four project-scoped policies are present with the expected `USING` and `WITH CHECK` predicates;
- `anon` has no `SELECT`, `INSERT`, `UPDATE`, or `DELETE` privilege;
- authenticated CRUD grants are governed by RLS;
- the lag constraint and enabled acyclic trigger exist;
- migration version `20260722021500` is recorded;
- the dependency table still contains zero rows.

The migration is forward-only and transactional. Because the live dependency table was empty, making `lag_days` non-null and adding the bounded check did not rewrite or reject existing user data.

### Canonical calendar RPC bounds: resolved

The same forward migration hardens the existing canonical calendar rather than creating another owner:

- adds a table constraint limiting exception reasons to 240 characters;
- requires RPC `reason` values to be strings of no more than 240 characters;
- limits a replacement payload to 1000 dated exceptions;
- preserves role, identity, app-admin/project-member, weekday, object-shape, and duplicate-date validation;
- keeps direct canonical table writes revoked.

The API now enforces the same 1000-exception maximum before calling the RPC. Independent live readback confirmed the table constraint and both RPC bounds. The canonical exception table remains empty, so the new constraint did not discard or transform data.

### Calendar load and save recovery: resolved

The schedule page now maintains explicit loading and load-error state:

- calendar editing is disabled during load and after a failed load;
- a persistent `InfoAlert` explains that editing is disabled to protect the saved calendar;
- the transient toast includes a retry instruction;
- a retry action reloads the canonical calendar;
- the save callback independently refuses mutation while loading or after a failed read;
- the dialog cannot open against the fallback calendar.

The dialog now catches PUT failures, renders the actionable message with `role="alert"`, keeps the dialog open, and clears the error on a new attempt/open. Its save button also honors the defensive disabled reason. The fallback object may still be held in memory for schedule calculations, but it is no longer writable after a failed canonical read, removing the destructive-overwrite risk from the earlier review.

## Verification Evidence

### Independent commands

- Focused scheduling Jest run: **PASS**, 5 suites and 32 tests.
- Authoritative schema check: **PASS**, `database.types.ts matches the current schema via supabase-cli.`
- Linked migration/security readback: **PASS**.

The 32 focused tests cover:

- named exception API serialization and dialog reload;
- reason save payloads;
- rejected calendar saves staying open with an accessible error;
- calendar save disabling when canonical data has not loaded;
- excessive exception-count rejection before the RPC;
- dependency create and update with negative lead;
- out-of-range lead/lag rejection;
- all four dependency relationship calculations with negative lead;
- existing cross-project, self-dependency, and cycle error paths.

### Live database readback

- Canonical calendar tables remain present.
- Canonical calendar rows remain `1`; canonical exception rows remain `0`.
- Duplicate calendar tables and duplicate RPC remain absent.
- Dependency rows remain `0`.
- Cleanup and hardening migrations are recorded.
- Live generated types expose `schedule_dependencies.lag_days` as non-null.

## Migration and Security Assessment

- No deployed migration was edited; recovery and hardening use later forward migrations.
- The cleanup migration still aborts if either duplicate table contains data and drops objects transactionally.
- The dependency helper is `SECURITY DEFINER`, has a fixed search path, is not executable by `public` or `anon`, and returns false unless the current authenticated identity has access to the shared project.
- Update policies validate both the old row through `USING` and the replacement row through `WITH CHECK`.
- The cycle trigger executes at the database boundary, so direct authenticated writes cannot bypass the API's graph validation.
- No hardcoded secret, raw SQL interpolation, unsafe HTML rendering, or new broad service-role client was introduced.

## React and Accessibility Assessment

- The reason field uses the shared `Input` and `Label` primitives.
- The reason field has an explicit accessible name and a 240-character client bound.
- Lead/lag help text is attached with `aria-describedby`.
- Calendar mutation errors use `role="alert"`.
- The load failure uses the shared `InfoAlert` and exposes an explicit retry button.
- Responsive calendar exception rows retain a single-column mobile layout and a structured desktop grid.
- The dialog remains open on mutation failure, preserving user input for recovery.

## Non-Blocking Completion Conditions

The implementation is approved for publication, subject to the existing task closeout gates:

1. publish only the exact task-owned files through the main-branch finish flow;
2. confirm the deployment uses the published revision;
3. capture authenticated production proof for named-exception save/reload and negative lead create/edit;
4. capture the required desktop/mobile visual evidence;
5. record any unrelated build/typecheck/tooling failures with their exact command and owner;
6. verify local `HEAD` equals `origin/main` before claiming completion.

The previously noted Windows changed-route evidence gap is resolved: the root guard validated both changed API routes with `raw_error_routes=0`. The routes were also directly reviewed, use `withApiGuardrails`, pass their focused tests, and are backed by database authorization and invariant enforcement.

## Reviewed Files

- `frontend/src/app/(main)/[projectId]/schedule/page.tsx`
- `frontend/src/app/api/projects/[projectId]/scheduling/calendar/route.ts`
- `frontend/src/app/api/projects/[projectId]/scheduling/calendar/__tests__/route.test.ts`
- `frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/dependencies/route.ts`
- `frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/dependencies/__tests__/route.test.ts`
- `frontend/src/components/scheduling/calendar-settings-dialog.tsx`
- `frontend/src/components/scheduling/task-dependencies-editor.tsx`
- `frontend/src/components/scheduling/__tests__/calendar-settings-dialog.test.tsx`
- `frontend/src/components/scheduling/__tests__/task-dependencies-editor.test.tsx`
- `frontend/src/lib/scheduling/schedule-calendar.ts`
- `frontend/src/lib/scheduling/schedule-impact-preview.ts` and its focused test
- `frontend/src/lib/services/scheduling-service.ts`
- `scripts/generate-db-types.mjs`
- `frontend/src/types/database.types.ts`
- `frontend/src/components/dev-tools/page-schema-fk.generated.ts`
- `supabase/migrations/20260721210000_create_schedule_project_calendars.sql`
- `supabase/migrations/20260722020000_reconcile_schedule_project_calendars.sql`
- `supabase/migrations/20260722021500_harden_schedule_dependency_boundary.sql`
- `docs/ops/tasks/2026-07-21-schedule-phase2-reconcile.md`
- `docs/ops/handoffs/2026-07-21-S212-schedule-phase2-reconcile.md`
- `docs/ops/verification/schedule-phase2-manifest.json`

## Decision Rationale

The prior database-authorization, canonical-RPC validation, and destructive fallback findings have been corrected at their owning boundaries and verified against the linked database. Focused tests now exercise the new recovery behavior as well as the requested functional paths. The remaining work is deployment and end-to-end evidence, not a code-review defect; therefore the current implementation receives **APPROVED**.
