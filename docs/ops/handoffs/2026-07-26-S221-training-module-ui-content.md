# Handoff: 2026-07-26 - ALL-19/ALL-20 Training Module UI + Content

## Intake Block

1) Session ID: S221
2) Task ID: ALL-19-21 (T5/T6 content-and-UI slice; T7 nav/route wiring explicitly excluded from this session's ownership)
3) Linear issue: ALL-19 - T5 Training library page UI; ALL-20 - T6 Resource cards + guide viewer; migrate written guides
4) Linear URL: https://linear.app/alleato-group/issue/ALL-19, https://linear.app/alleato-group/issue/ALL-20
5) Current status: Integration-ready in isolated workspace branch `codex/s221-all-19-21-b6e562` (worktree `/home/friday/.codex/isolated-workspaces/s221-all-19-21-b6e562`) and pending publication to `origin/main`. The real source export and handbook assets could not be located anywhere reachable from this environment — reported as deferred rather than fabricated. All buildable deliverables (normalization tooling, pure components, tests) are complete and passing.
6) Files changed: see "Files Changed" below.
7) Commands/outcomes: `node --test scripts/training/source/__tests__/normalize-resources.test.mjs` -> 8 passed, 1 skipped (explicit reason: real resources.json not generated). Four exact Jest test paths under `frontend/src/features/training/__tests__` -> 14 passed, 4 suites. CLI smoke test of `normalize-resources.mjs` against the fixture -> wrote 5 resources, counts `{total:5, published:3, review:2, archived:0}` to a scratch path (not the real output path). Focused full-typecheck diagnostics found zero errors in the new files (unrelated repository debt remains out of scope). `npx eslint src/features/training --max-warnings=0` exits 0. Integration review also removed the feature-local domain enum duplication in favor of canonical `@/lib/training/types`, and added an HTTPS YouTube/Vimeo/Loom iframe allowlist at both normalization and rendering boundaries; malicious/unsupported sources are proven link-only.
8) Evidence artifacts: test output captured above; no screenshots (no route/page exists yet to screenshot — these are unwired presentational components per the task brief, "do not create ... route wiring yet").
9) Top findings:
   - The "Alleato-Training-Platform workspace" referenced in the Linear project description is not a reachable location from this environment — not a GitHub repo in `The-Alleato-Group` org, not on local disk, not in Linear attachments, not in SharePoint/Outlook/Teams search.
   - `C:\Users\Brandon\Downloads\Alleato_Training_Library.html` (the Teams-referenced path) is a local path on Brandon's Windows machine; nothing by that name is reachable via any available tool.
   - A Teams message from Megan Harrison (2026-07-18) mentions "Internal training platform and onboarding" only as a planned-feature bullet in an AI-dashboard mockup brief — not the actual resource content.
   - `frontend/src/features/training-docs/**` is a pre-existing, unrelated "repeatable training docs" system (task-training-service, training_docs table) — different domain, not touched here; do not confuse it with this Training Module project.
   - Possible CLAUDE.md drift worth a reflection pass: `CLAUDE.md`/`DESIGN-SYSTEM-GATE.md` state `<ExpandingSearch>` is "the ONLY permitted search input in pages and detail views," but the enforced ESLint rule `design-system/no-raw-search-input` now bans `<ExpandingSearch>` outright for list/table search and requires `<ExpandableSearch>` from `@/components/tables/unified/table-toolbar` instead. `ResourceFilters.tsx` hit this live during lint verification.
10) Next action: Brandon (or whoever holds the standalone platform) needs to supply `data/resources.js` (or equivalent) and the three handbook documents directly. Once supplied: run `node scripts/training/source/normalize-resources.mjs --input <path>` to produce the real `resources.json`, and add the three `.mdx` guide files under `frontend/src/content/training-guides/`. Separately, someone needs to pick up T7 (nav entry + route registration) and wire these components into `frontend/src/app/(main)/training/**`, consuming `frontend/src/lib/training/**` for real data.
11) Handoff path: `docs/ops/handoffs/2026-07-26-S221-training-module-ui-content.md`
12) Migration ledger evidence: N/A — no migrations in this session's scope.

## Verification Contract

- Delivery lane: Standard. Targeted node/jest checks plus one proof at the changed boundary (component rendering/behavior via jsdom + Testing Library), per the task's own instruction that components take props/fixtures only and do not yet wire to a route or database.
- No end-to-end browser proof was produced: there is no live `/training` route to visit yet (T7 route wiring is out of scope here and owned separately).

## Files Changed

New files, all under this session's owned paths:

- `scripts/training/source/README.md` — recovery-status/blocker report for the resource library source.
- `scripts/training/source/resources.schema.json` — normalized resource shape.
- `scripts/training/source/normalize-resources.mjs` — field-alias-tolerant normalizer + `validateResourceLibrary` (URL uniqueness, count checks).
- `scripts/training/source/__fixtures__/resources.source.fixture.mjs` — synthetic fixture source (not real data).
- `scripts/training/source/__tests__/normalize-resources.test.mjs` — `node --test` coverage.
- `frontend/src/content/training-guides/README.md` — recovery-status/blocker report for the three handbooks.
- `frontend/src/features/training/types.ts`, `embed-policy.ts`, `ResourceFilters.tsx`, `ResourceCard.tsx`, `TrainingLibraryView.tsx`, `GuideViewer.tsx`, `index.ts`.
- `frontend/src/features/training/__fixtures__/training-fixtures.ts` — synthetic fixture data for component tests.
- `frontend/src/features/training/__tests__/resource-filters.test.tsx`, `resource-card.test.tsx`, `training-library-view.test.tsx`, `guide-viewer.test.tsx`.
- `docs/ops/tasks/2026-07-26-training-module-ui-content.md` — this task's task file.
- `docs/ops/handoffs/2026-07-26-S221-training-module-ui-content.md` — this file.

Not created (blocked, see task file): `scripts/training/source/resources.json` (real data), and the three `.mdx` guide files under `frontend/src/content/training-guides/`.
