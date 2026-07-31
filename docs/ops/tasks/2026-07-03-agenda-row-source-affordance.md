# Task: Agenda Row Source Affordance

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: Blocked - connector exposes comments only, not issue creation
Linear URL: N/A
Related Handoff: N/A

## Objective

Expose anchored prep-source links directly on meeting agenda rows so a user can verify the source behind a seeded agenda item without expanding the row and reading raw metadata text.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Doctrine Gate

Surface: Meeting agenda item row
One purpose: edit and verify one agenda item quickly.
Primary user job: scan agenda item, edit fields, and open the source evidence when needed.
Primary action: edit the agenda item.
Secondary actions: open source evidence, expand item, update owner/status/due/priority, create task, delete item.
Next action after success: continue agenda review or open the source in context.
Correction path: edit the agenda title/description or remove the item.
Keyboard path: source link is tab reachable and does not intercept row editing.
Information that belongs elsewhere: source preview content, full transcript, project intelligence history.
Blessed pattern: compact row affordance with tooltip; no popover, preview, or new panel.
Complexity budget: pass if source evidence is one compact icon/link and hidden when no source exists.
Pass/fail: Pass.

## Acceptance Criteria

- [x] Agenda rows parse seeded `Source:` metadata into a stable internal source link.
- [x] Rows with source metadata show a compact source affordance next to the item title.
- [x] Rows without source metadata do not show source chrome.
- [x] The link preserves anchored transcript hashes.
- [x] The source affordance is keyboard reachable and has accessible labeling.
- [x] Browser verification proves the source affordance renders on a seeded agenda row.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Current `origin/main` agenda row implementation is used as the source of truth.
- [x] No schema or migration is introduced.
- [x] No source preview panel, card, or duplicate source section is added.
- [x] Existing inline edit/save behavior is preserved.
- [x] Failure path keeps agenda editing available.

## Planned Files

- `docs/ops/tasks/2026-07-03-agenda-row-source-affordance.md`
- `frontend/src/components/domain/meetings/agenda-item-row.tsx`
- `frontend/src/components/domain/meetings/__tests__/agenda-section.test.tsx`

## Integration Checklist

- [x] Focused unit test passes.
- [x] Focused ESLint passes.
- [x] Focused changed-file type guard passes.
- [x] Surface complexity audit passes or unavailable command is documented.
- [x] Browser verification runs on a meeting agenda page.

## Regression Guardrails

- [x] No duplicate primary CTA.
- [x] No nested cards or page-level bordered wrapper shells.
- [x] Agenda rows without source metadata remain visually unchanged.
- [x] Anchored source URL remains intact.
- [x] Temporary verification data is cleaned up if created.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Design doctrine gate | `.agents/skills/alleato-design-doctrine/SKILL.md` and required references | Pass | Product constitution, workflow gate, surface budgets, blessed patterns, and pattern operating model loaded. |
| Unit test | `./node_modules/.bin/jest --runInBand --runTestsByPath src/components/domain/meetings/__tests__/agenda-section.test.tsx` | Pass | 5 tests passed, including source-link rendering and no-link fallback. |
| ESLint | `./node_modules/.bin/eslint src/components/domain/meetings/agenda-item-row.tsx src/components/domain/meetings/__tests__/agenda-section.test.tsx` | Pass | Focused changed files only. |
| Changed-file type guard | `npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Surface complexity audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/domain/meetings/agenda-item-row.tsx` | Pass | Compact icon-link affordance only; no extra panel/card/source preview added. |
| Whitespace check | `git diff --check` | Pass | No whitespace errors. |
| Browser verification | `/tmp/alleato-agenda-source-affordance/agenda-row-source-link.png` | Pass | Clean worktree server on port 3002 rendered `Open source: Transcript topic 1` with `/760/intelligence/sources/01KT9P1ANSMC358GGXTAPZA2MZ#meeting-segment-d6027e78-a1f8-4105-86bc-4ae41acb8b0d`. |
| Temporary data cleanup | Supabase service-client read-back for meeting `6dbd7771-00e6-4083-a4dd-36faa0dd0227` | Pass | Temporary browser-verification meeting was soft-deleted and read back with `deleted: true`. |
