# Task: Build the Manager Coaching Module

Status: Complete
Owner: Codex S250
Created: 2026-07-27
Task ID: LOCAL-20260727-MANAGER-COACHING-GUIDE
Linear Issue: N/A; the user requested the bounded correction directly and the Standard lane does not require external tracking.
Related Handoff: N/A; single-session Standard work.

## Objective

Replace Module 3's “Coming soon” placeholder with a complete manager coaching guide that opens through the existing authenticated training-guide route.

## Scope

- Own the versioned manager coaching MDX, guide catalog registration, Module 3 destination, route/hub regression tests, and guide documentation.
- Exclude changes to authentication, database schemas, the skill-wheel data model, and shared visual primitives.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/content/training-guides/catalog.ts`
- Existing shared primitives/services: `frontend/src/app/(main)/training/guides/[guideSlug]/page.tsx`, `GuideViewer`, `MarkdownRenderer`, and `HubModuleTile`
- Deprecated or parallel paths: The static `training-source` prototype is source reference only; it is not a second runtime.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Module 3 exposes a clear manager coaching guide link instead of “Coming soon.”
- [x] The guide gives managers a practical coaching sequence, evidence rubric, 2–4-focus limit, precise reps, and 30/60/90-day follow-up.
- [x] The registered guide opens through the canonical guide route on desktop and mobile.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable. N/A; no contract in these categories changes.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and the publication commit is present on `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: Catalog loading names the exact guide slug when its source cannot load or its frontmatter slug does not match.
- Detection path: The focused source-to-route contract tests require the manager guide in the catalog, static route list, and Module 3 link, with no approved module placeholder.
- Recovery path: Restore the versioned MDX at the registered path or correct its allowlisted catalog entry and frontmatter slug, then rerun the focused contract.

## Incident Learning

- Failure fingerprint: `training.registered-source-placeholder-drift`
- Root cause: The prototype import treated a missing prototype destination as missing product content, leaving approved coaching material outside the registered guide catalog.
- Detection gap: Tests preserved one placeholder and three guides rather than verifying source-to-route parity.
- Prevention: Register approved versioned sources through the canonical catalog and assert their exact hub and static-route destinations.
- Guardrail evidence: Focused training catalog, guide, hub, and guide-route unit tests recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, canonical owner, failure contract, and done gate captured before implementation. |
| Runtime localization | `hub-content.ts`, `catalog.ts`, source workbook | Pass | Module 3 intentionally omitted `primaryLink`; the approved workbook existed but no registered guide route did. |
| Focused regression contract | `cd frontend && pnpm exec jest --runInBand --runTestsByPath src/content/training-guides/__tests__/catalog.test.ts src/content/training-guides/__tests__/guides.test.ts 'src/app/(main)/training/__tests__/page.test.tsx' 'src/app/(main)/training/guides/[guideSlug]/__tests__/page.test.tsx'` | Pass | 4 suites and 18 tests passed, including the hub destination and four-route static list. |
| Targeted lint | `cd frontend && pnpm exec eslint <six changed TS/TSX files>` | Pass | No lint findings. |
| Desktop browser proof | `.codex-artifacts/manager-coaching-guide/local-hub-desktop.png`, `.codex-artifacts/manager-coaching-guide/local-guide-desktop.png` | Pass | Module 3 exposes the guide link; the guide renders through `PageShell`, `GuideViewer`, and `MarkdownRenderer`. |
| Mobile browser proof | `.codex-artifacts/manager-coaching-guide/local-hub-module3-mobile-375.png`, `.codex-artifacts/manager-coaching-guide/local-guide-mobile-375.png` | Pass | The card and guide are readable at 375 px; checks at 375, 414, 768, 1024, and 1440 px found no horizontal document overflow. |
| Linked action proof | Agent-browser click from the guide's `Open My Growth` link | Pass | Navigated to `/training/growth` and back to `/training/guides/manager-coaching-guide`. |
| Noise gate | Manual review; Impeccable CLI unavailable in this checkout | Pass | Reused the canonical guide surface, added no wrapper panels or decorative UI, and kept one clear next action in the prose. |
| Accessibility audit | `agent-browser a11y --tags wcag2a,wcag2aa --json` | Unrelated debt | The new guide content introduced no custom controls. Existing findings belong to `frontend/src/components/header/project-selector.tsx`, the global notification badge, and the development-only Agentation overlay. |
| Local console | `agent-browser errors` and `agent-browser console` | Unrelated config | No page runtime errors; the local dev shell reports the existing missing Velt public-key condition from `frontend/src/components/velt/VeltAuthProvider.tsx`. |
| Publication | `npm run codex:finish -- --message "Build manager coaching training module" --session S250 --files <10 exact paths>` | Pass | Published the task-owned files to `origin/main` at `e60cf970a23457f7f386853a556834f6c7563e09`; route, changed-code, learning-registry, and unsafe-pattern gates passed. |
| Production deployment | `vercel inspect project-management-agent-iqdpk9usq-the-alleato-group.vercel.app --scope the-alleato-group` and build logs | Pass | Vercel reached Ready; logs verified `The-Alleato-Group/project-management@main` commit `e60cf970a234` and generated all 291 static pages. |
| Production browser readback | `https://projects.alleatogroup.com/training` and `https://projects.alleatogroup.com/training/guides/manager-coaching-guide` | Pass | Live hub exposes the manager guide with no “Coming soon”; the guide title, outcome, and My Growth link render. Fresh desktop/mobile sessions had no runtime errors, 375 px had no horizontal overflow, and My Growth navigation succeeded. |

## Remaining Risk

- None for the requested Module 3 correction. Existing global shell accessibility debt remains outside this task's content and route boundary.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action. N/A; no deferred work.
