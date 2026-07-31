# Task: Fix codex:finish node --check crashing on deleted script files

Status: Done
Owner: Session S226
Created: 2026-07-26
Task ID: LOCAL-2026-07-26-codex-finish-deleted-file-check
Linear Issue: N/A (tooling bugfix discovered while publishing ALL-17)
Related Handoff: `docs/ops/handoffs/2026-07-26-S226-codex-finish-deleted-file-fix.md`

## Objective

`npm run codex:finish` blocked a legitimate publish (ALL-17, session S223)
that deleted `scripts/training/source/normalize-resources.mjs` and its
fixture/test (superseded, pre-real-data code). `runTargetedChecks` ran
`node --check <file>` over every staged `scripts/**/*.{js,mjs,cjs}` path,
including deletions, which always fails (`ENOENT`) since the file no longer
exists. This would block every future session that deletes a script file.

## Root Cause

`stagedFiles` (from `git diff --cached --name-only`) includes deletions.
The `scriptFiles` filter only checked the path pattern, not whether the file
still exists on disk.

## Fix

Extracted `existingScriptFiles(stagedFiles, repoRoot)` (exported for testing)
which filters to files that both match the script-file pattern AND exist on
disk (`fs.existsSync`). `runTargetedChecks` now uses it instead of the
inline filter. Also guarded the module's CLI-entrypoint execution behind an
`isMain` check (`import.meta.url === pathToFileURL(process.argv[1]).href`)
so the module can be `import`-ed for unit testing without triggering its
side effects (git commands, `process.exit`) — same pattern already used in
`scripts/training/source/parse-source-library.mjs`.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] `node --test scripts/ops/__tests__/codex-finish.test.mjs` passes,
      written test-first (red confirmed: `existingScriptFiles` did not
      exist before the fix).
- [x] `node scripts/ops/codex-finish.mjs --check` still works as a CLI
      entrypoint after the `isMain` guard was added (smoke-tested).
- [x] The original failure (ALL-17's publish blocked on a deleted-file
      `node --check`) no longer reproduces once this fix lands.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| New unit tests | `node --test scripts/ops/__tests__/codex-finish.test.mjs` | 3 passed |
| CLI smoke test | `node scripts/ops/codex-finish.mjs --check` | Prints branch/sync state as before, no crash |
| Syntax | `node --check scripts/ops/codex-finish.mjs` | OK |

## Remaining Risk

None — this is a narrow, additive filter change plus a test-only import
guard; no behavior changes for any staged file set that doesn't include a
deleted script file.
