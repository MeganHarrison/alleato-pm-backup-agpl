# App Knowledge Training Docs Workflow Tasks

Status: Partial
Owner: Codex
Date: 2026-06-30
Related route: `/knowledge/app`
Reference route: `/knowledge/company`

## Objective

Make the app knowledge base workflow match the company knowledge base design and behavior, but group content by Alleato tool categories instead of company knowledge categories. Published training documents must automatically appear under the correct tool category, and the workflow must include an AI-assisted process for creating step-by-step training documents with screenshots.

## Product Contract

- `/knowledge/company` remains the company knowledge base.
- `/knowledge/app` uses the same design system, layout, navigation pattern, search treatment, and category browsing behavior as `/knowledge/company`.
- `/knowledge/app` categories are app tools, not company topics.
- Clicking an app tool category opens a category page that lists the published training documents for that tool.
- Training documents are not visible in app knowledge until published.
- Published training documents must be categorized deterministically, not inferred silently from fragile text.
- AI-created training documents must flow through draft, review, publish, and knowledge-base visibility.

## Attention Brief

Primary user: Alleato team members learning how to use app tools.
Primary job: Find the right training document for the tool they are using.
Primary decision: Which tool category and training document answers the current workflow question.
Tier 1: Tool categories and published training docs.
Tier 2: Search, category navigation, doc title, summary, and canonical link.
Tier 3: Source route, last published date, and creation method.
Hide until requested: Draft docs, generation logs, screenshot capture internals, unpublished review notes.
Remove: Separate app-help visual system, decorative helper copy, inline one-off category lists, duplicate CTAs.
Primary action: Open the correct published training document.
Failure-loudly behavior: Missing published path, missing category, or broken docs-site URL must be visible in admin/review checks and covered by tests.

## Phase 1: Confirm Current State

- [x] Verify `/knowledge/company` current design and interaction contract in code.
- [x] Verify `/knowledge/app` current implementation and identify all one-off design pieces to remove.
- [ ] Verify the current training docs publish model, including `published_doc_path`, status fields, source route fields, and any category/tool metadata.
- [ ] Verify whether published training docs already have reliable tool category data.
- [ ] Verify docs-site URL construction for published training docs.
- [ ] Verify whether `/training-docs` is the current admin surface for draft/review/publish.
- [x] Record root cause: `/knowledge/app` is currently a separate help-list implementation instead of a company-knowledge-layout variant.

## Phase 2: Define Tool Category Model

- [ ] Define canonical app knowledge tool categories.
- [ ] Map existing static app help groups to canonical tool categories.
- [ ] Map existing published training docs to canonical tool categories.
- [ ] Decide whether to use an existing field or add a durable category field for training docs.
- [ ] If a schema change is required, create a migration for explicit training-doc tool category assignment.
- [ ] If a schema change is required, generate and verify Supabase types before writing database code.
- [ ] Add validation so published training docs cannot silently publish without a valid app knowledge category.
- [ ] Define fallback behavior for uncategorized published docs, such as admin-visible `Uncategorized`, without showing incorrect user-facing placement.

## Phase 3: Shared Knowledge Layout Refactor

- [x] Refactor `KnowledgeBasePage` into a shared layout that can render multiple knowledge sources.
- [x] Preserve the existing `/knowledge/company` behavior and visuals.
- [x] Add an `app` mode that uses the same layout with tool categories.
- [x] Keep shared pieces at the component level instead of adding page-local overrides.
- [x] Remove or retire the separate `AppHelpPage` visual system after parity is in place.
- [x] Ensure search, top bar, topic navigation, mobile topic navigation, category grid, and right-side page index match the company page pattern.
- [x] Keep UI quiet: no KPI cards, stat rows, decorative wrappers, nested cards, or duplicate primary actions.

## Phase 4: App Knowledge Index Page

- [x] Update `/knowledge/app` to render the shared knowledge layout in app mode.
- [x] Show tool categories instead of company knowledge categories.
- [x] Ensure category cards use the same sizing, density, typography, and interaction as `/knowledge/company`.
- [x] Ensure sidebar topic navigation mirrors `/knowledge/company`.
- [x] Ensure search behavior matches the company page where applicable.
- [x] Ensure admin-only creation/manage actions do not duplicate body-level CTAs.
- [x] Confirm empty state is useful and quiet when no published training docs exist.

## Phase 5: Category Pages

- [ ] Create route structure for app tool category pages.
- [ ] Preferred route shape: `/knowledge/app/[toolCategory]`.
- [ ] Use specific dynamic param naming if needed, such as `[toolCategory]`, not generic `[id]`.
- [ ] Build category page using the same shared layout vocabulary as the company knowledge page.
- [ ] List only published training documents for the selected tool category.
- [ ] Include doc title, short summary, source route/tool context, and published link.
- [ ] Ensure clicking a training doc opens the published docs-site page.
- [ ] Add not-found or recovery behavior for unknown categories.
- [ ] Run `npm run check:routes` if any dynamic routes are added.

## Phase 6: Training Doc Publishing Integration

- [ ] Update the training doc publish process so publishing writes or verifies the tool category.
- [ ] Ensure published docs with valid category and `published_doc_path` appear automatically on `/knowledge/app/[toolCategory]`.
- [ ] Ensure unpublished, draft, archived, or missing-path docs do not appear on user-facing app knowledge pages.
- [ ] Add a publish-time guard for missing category.
- [ ] Add a publish-time guard for missing published path.
- [ ] Add a publish-time guard for invalid docs-site URL construction.
- [ ] Add admin-visible error messaging for publish failures.

## Phase 7: AI Training Doc Creation Entry Point

- [ ] Decide the entry point location for `Create training doc`.
- [ ] Recommended location: admin-only action on `/knowledge/app`, with management continuing in `/training-docs`.
- [ ] Ensure non-admin users do not see creation controls.
- [ ] Connect the entry point to the existing training docs creation workflow instead of adding a disconnected form.
- [ ] Require the user or workflow to choose the tool category before generation starts.
- [ ] Require source route or workflow target before browser capture starts.
- [ ] Store generated content as draft until reviewed and published.

## Phase 8: AI Capture Workflow

- [ ] Use `agent-browser` for exploratory or guided live-app capture where the AI clicks through the app and records screenshots.
- [ ] Use Playwright for deterministic regeneration or regression capture once a workflow is stable.
- [ ] Capture each step with action, expected result, screenshot artifact, route, and selector/reference where available.
- [ ] Generate step-by-step draft documentation from captured steps.
- [ ] Attach screenshots to the draft in the correct order.
- [ ] Preserve source route, tool category, capture method, and capture timestamp.
- [ ] Fail loudly if browser capture cannot authenticate, cannot reach the route, or cannot capture screenshots.
- [ ] Avoid exposing credentials or session secrets in generated docs, logs, screenshots, or final content.

## Phase 9: Review And Publish Workflow

- [ ] Keep generated docs in draft until reviewed.
- [ ] Add or verify review status handling.
- [ ] Add or verify publish action.
- [ ] On publish, write docs-site output and `published_doc_path`.
- [ ] On publish, validate category and docs-site URL.
- [ ] On publish, make the doc visible on the correct `/knowledge/app/[toolCategory]` page.
- [ ] Record publish metadata such as publisher, published time, source route, and category.

## Phase 10: Tests And Guardrails

- [x] Add tests proving `/knowledge/company` still renders company categories.
- [x] Add tests proving `/knowledge/app` renders tool categories.
- [x] Add tests proving app category cards link to `/knowledge/app/[toolCategory]`.
- [ ] Add tests proving category pages list only published training docs for that tool.
- [ ] Add tests proving docs without `published_doc_path` are hidden from app knowledge.
- [ ] Add tests proving missing or invalid category fails visibly.
- [ ] Add tests proving published training doc URLs are generated correctly.
- [ ] Add route tests for the new dynamic category route.
- [ ] Add publish workflow tests for category/path validation.
- [ ] Add AI capture workflow tests or mocked integration tests for draft creation.

## Phase 11: Browser Verification

- [ ] Verify `/knowledge/company` visual parity is preserved.
- [ ] Verify `/knowledge/app` has the same design as `/knowledge/company`.
- [ ] Verify `/knowledge/app` shows tool categories.
- [ ] Verify clicking a tool category opens the category page.
- [ ] Verify a category page lists the correct published training docs.
- [ ] Verify opening a training doc reaches the published docs-site page.
- [ ] Verify admin-only create action appears for admins.
- [ ] Verify admin-only create action is hidden for non-admin users.
- [ ] Verify the AI creation workflow can create a draft with screenshots.
- [ ] Save browser screenshots or artifacts for `/knowledge/company`, `/knowledge/app`, one category page, and one published training doc.

## Phase 12: Deployment And Production Readback

- [x] Run focused unit tests.
- [x] Run targeted lint for touched files.
- [x] Run `npm run typecheck:changed`.
- [ ] Run `npm run check:routes` if routes changed.
- [ ] Run migration verification if schema changed.
- [ ] Publish through `npm run codex:finish -- --message "..." --files ...`.
- [ ] Verify `HEAD` equals `origin/main`.
- [ ] Verify Vercel production deployment is `READY`.
- [ ] Authenticated production check: `https://projects.alleatogroup.com/knowledge/company`.
- [ ] Authenticated production check: `https://projects.alleatogroup.com/knowledge/app`.
- [ ] Authenticated production check: one `/knowledge/app/[toolCategory]` page.

## Acceptance Criteria

- [ ] `/knowledge/app` visually matches `/knowledge/company`.
- [ ] `/knowledge/app` groups by app tools, not company knowledge categories.
- [ ] Each tool category opens a dedicated category page.
- [ ] Each category page lists all and only published training docs for that tool.
- [ ] Published training docs automatically appear after publish without manual page edits.
- [ ] Training docs cannot publish silently into the wrong category.
- [ ] AI-generated training docs can be created with step-by-step content and screenshots.
- [ ] Generated docs remain drafts until reviewed and published.
- [ ] Tests cover category routing, publish visibility, URL generation, and failure-loud behavior.
- [ ] Browser artifacts prove the company page, app page, category page, and published doc link work.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused unit tests | `npm run test:unit -- --runTestsByPath src/features/knowledge/__tests__/knowledge-base-page.test.tsx src/features/knowledge/__tests__/app-knowledge.test.ts --runInBand` | Pass | 2 suites / 8 tests. App page now asserts shared `Knowledge topics`, right rail, search, app category links, and no old App Training tab strip. |
| Targeted lint | `./node_modules/.bin/eslint src/features/knowledge/knowledge-base-page.tsx src/features/knowledge/app-training-docs-page.tsx src/features/knowledge/__tests__/knowledge-base-page.test.tsx` | Pass | No lint output. |
| Type debt guard | `npm run typecheck:changed` | Pass | No new `any` debt. |
| Browser visual proof | Not run after local source change | Deferred | Production still shows old deployed code until this branch is published. Local authenticated browser proof remains blocked by auth state. |

## Known Risks

- The current `/knowledge/app` implementation may need removal rather than incremental styling.
- Existing training docs may not have explicit category metadata.
- Browser capture may be blocked by authentication state or route permissions.
- Docs-site publishing may succeed while app category visibility fails if category validation is not part of publish.
- A schema migration may be required if no durable category field exists.

## Recommended Implementation Order

1. Confirm data model and current UI contracts.
2. Add or verify durable tool category metadata.
3. Refactor shared knowledge layout.
4. Convert `/knowledge/app` to shared layout in app mode.
5. Add `/knowledge/app/[toolCategory]` pages.
6. Wire published training docs to category pages.
7. Add admin creation entry point.
8. Connect AI capture and draft generation.
9. Add tests and browser proof.
10. Publish to `main` and verify production.
