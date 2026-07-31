# Task: Eve Tool Testing Registry

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: AAI-EVE-TEST-REGISTRY
Linear Issue: Not requested for this bounded frontend slice
Related Handoff: N/A

## Objective

Provide an admin frontend table with exactly one row for every canonical Eve
tool so live test coverage, expected prompts, blockers, and evidence are visible
in one place, including explicit per-tool screenshot verification.

## Scope

- `/ai/testing` route and its table configuration.
- Read-only rows derived from the canonical Eve manifest.
- Developer-only access for the internal testing surface.
- Explicit exclusion: changing Eve runtime behavior or persisting test runs.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/ai/eve-runtime/production-tool-registry.ts`
- Existing shared primitives/services: `frontend/src/components/tables/unified`
- Deprecated or parallel paths: `procore_tools` and generic Procore test cases are intentionally separate.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Every canonical Eve tool has exactly one visible table row.
- [x] Search and status, effect, and scope filters work.
- [x] Known live-test results and blockers are visible.
- [x] Every row states whether tool-specific screenshot evidence is verified.
- [x] Mobile card view is usable without page-level horizontal overflow.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared `UnifiedTablePage` owns the table behavior.
- [x] Errors are specific and actionable.
- [x] The new internal page uses the existing developer-only route guard.

## Integration and Verification

- [x] Focused registry unit test passes.
- [x] Browser readback proves the page and filters render.
- [x] Responsive screenshots are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an empty-state message if the canonical Eve manifest returns no tools.
- Detection path: focused unit test compares every rendered row name with `EVE_TOOL_MANIFEST`.
- Recovery path: repair the canonical manifest or its metadata mapping; no parallel inventory is accepted.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: the registry parity unit test fails on missing, duplicate, or stale rows.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Registry parity | `pnpm exec jest --runInBand "src/features/eve-tool-testing/__tests__/eve-tool-test-registry.test.ts"` | Pass | 4 tests prove 131 unique rows, valid recorded results, and that screenshot verification cannot be set without evidence. |
| Focused lint | `pnpm exec eslint "src/features/eve-tool-testing/**/*.ts" "src/features/eve-tool-testing/**/*.tsx" --no-cache` | Pass | No findings. |
| Scoped TypeScript | Compiler API check using the repository `tsconfig.json` and the five task-owned TypeScript roots | Pass | No related diagnostics. |
| Desktop browser | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-testing-desktop-final-2026-07-30.png` | Pass | Authenticated developer route rendered 131 tools; 25 rows on page one; no inactive selection controls. |
| Search | Browser search for `List Progress Report Photos` | Pass | One matching row remained after debounce. |
| Status filter | `/ai/testing?status=blocked` | Pass | Exactly four rows rendered and every row had Blocked status. |
| Responsive browser | 375, 414, 768, 1024, and 1440 pixel viewports | Pass | Title remained visible and `scrollWidth` equaled viewport width at every size. |
| Mobile screenshot | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-testing-mobile-375-2026-07-30.png` | Pass | Shared mobile record view rendered without page overflow. |
| Screenshot verification column | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-testing-screenshot-column-2026-07-30.png` | Pass | Authenticated browser rendered the default-visible column and `?screenshot=not_verified` returned all 131 rows. |
| Route maps | `npm run map:project`; `npm run map:system -- --check-only` | Pass | Project and system map artifacts regenerated and published. |

## Remaining Risk

- Live test results are a current evidence snapshot, not a persistent run ledger. A persistent run ledger is a separate future capability, not part of this read-only registry.
- No tool-specific screenshot paths are recorded yet, so all rows correctly show `Not verified`; the page-level screenshot proves the table UI, not an individual tool run.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
