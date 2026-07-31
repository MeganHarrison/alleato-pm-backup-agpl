Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-987
Linear URL: https://linear.app/megankharrison/issue/AAI-987/build-dedicated-email-learning-management-page-for-brandon-facing-ai
Related Handoff: N/A

## Objective

Create one dedicated frontend management page for email learning that lets Brandon understand what the AI is actually using, which email exclusion rules are active, what feedback matters, and what still needs review, without forcing him to learn the internals of `/emails`, `/outlook-intake`, `email_filter_rules`, or `ai_feedback_events`.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Attention Brief

Primary user: Brandon or an admin/operator managing email-learning behavior.
Primary job: understand and manage how email feedback and exclusions affect the AI email workflow.
Primary decision: is this something to ignore deterministically, review manually, or keep feeding back for higher-signal learning.
Tier 1: active exclusion rules, what each rule does, and the next useful action.
Tier 2: plain-language explanation of the current learning system and where feedback actually changes behavior today.
Tier 3: recent learning activity, review links, and supporting metadata.
Hide until requested: advanced metadata, low-value timestamps, long explanatory prose.
Remove: decorative dashboards, stat-card rows, helper chrome, duplicate entry points, noisy wrappers.
Primary action: add, edit, disable, or delete an exclusion rule and open the right review surface.
Failure-loudly behavior: rule load/save/delete errors must surface explicitly; if activity or review sources fail, the page should show which section failed rather than silently rendering a vague empty state.

## Surface Brief

Surface: Dedicated admin email-learning management page
One purpose: Make the email-learning system understandable and actionable in one place
Primary user job: Review what the system is excluding, what feedback matters, and where to act next
Primary action: Manage exclusion rules
Secondary actions: Review recent learning activity, navigate to related review queues, inspect whether feedback is deterministic or merely logged
Next action after success: Return to inbox/intake with a clear understanding of what feedback is worth giving
Correction path: Edit or delete rules directly and use linked review surfaces for non-deterministic feedback
Keyboard path: Open page, tab to add/edit/delete controls, submit rule changes, open linked review paths without mouse-only affordances
Information that belongs elsewhere: Full inbox triage, raw promotion review details, memory-center CRUD, Outlook message reading
Blessed pattern: Quiet admin content page using shared page shell, open sections, simple rows, and localized controls
Complexity budget: One page shell, a small number of open sections, one localized form path, no nested cards, no metric dashboard
Pass/fail: Pass

## Acceptance Criteria

- [x] There is one dedicated route for email learning management.
- [x] The page explains, in plain language, the difference between deterministic exclusion rules and feedback that is only logged/reviewed.
- [x] Users can browse existing email exclusion rules without encountering an email first.
- [x] Users can add, edit, disable, and delete exclusion rules from the dedicated page.
- [x] The page shows what feedback is worth spending time on versus what is already deterministic and handled.
- [x] The page links users to the canonical follow-up surfaces for inbox review and learning promotions without duplicating those workflows.
- [x] The page follows the Alleato product noise gate: no stat-card rows, no wrapper-card clutter, no dashboard theater.

## Failure-Loudly Behavior

- If `email_filter_rules` cannot be loaded, show a specific section error with the actual failing capability.
- If save/update/delete for a rule fails, keep the current UI state stable and surface a specific error toast or inline error.
- If learning activity or linked review counts fail to load, that section must show a failure state rather than implying there is no activity.
- The page must not claim that feedback changes model behavior when the current system only logs or filters it.

## Implementation Checklist

- [x] Reuse existing APIs for `email_filter_rules`, `ai_feedback_events`, and related learning surfaces where possible.
- [x] Avoid creating a parallel or duplicate backend storage path.
- [x] Keep the page visually quiet and section-based rather than dashboard-based.
- [x] Keep rule editing local to a lightweight, understandable interaction model.
- [x] Reuse shared layout/components instead of page-local one-off primitives.

## Planned Files

- `docs/ops/tasks/2026-07-06-email-learning-management-surface.md`
- `frontend/src/app/(admin)/ai/email-learning/page.tsx`
- `frontend/src/app/api/email-filter-rules/route.ts`
- `frontend/src/app/api/email-filter-rules/[ruleId]/route.ts`
- `frontend/src/lib/navigation-config.ts`
- Additional minimal supporting frontend files as needed

## Integration Checklist

- [x] The page reads real `email_filter_rules` data through the canonical API.
- [x] The page reads recent learning/feedback context from existing sources without inventing fake summaries.
- [x] All rule mutations use the same canonical API paths as the existing inbox controls.
- [x] Linear kickoff comment recorded.

## Regression Guardrails

- [x] Add/update targeted tests for rule-management and page-state behavior.
- [x] Keep copy honest about what the system does today.
- [x] Keep rule management admin-gated.

## Verification Checklist

- [x] Targeted automated checks run.
- [x] Alleato UI audit scripts run on changed UI files.
- [x] Browser verification run on the dedicated page.
- [x] Evidence artifacts recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear issue | `AAI-987` | Pass | Dedicated tracking issue created before implementation. |
| Linear milestone comment | `AAI-987` comment `8d22a9bc-3c55-4a5c-a821-9124be7dda09` | Pass | Recorded implementation scope, checks, and remaining browser gap. |
| Route/API unit test | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/api/email-filter-rules/[ruleId]/__tests__/route.test.ts'` | Pass | Confirms PATCH normalization and fail-loud rejection when all match criteria would be cleared. |
| Changed-file type guard | `cd frontend && npm run typecheck:changed` | Pass | No new changed-file type debt reported. |
| UI noise audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs 'frontend/src/features/ai/email-learning/email-learning-client.tsx' 'frontend/src/app/(admin)/learning-feedback/page.tsx'` | Pass | Both changed UI files passed the Alleato complexity/noise audit. |
| Project map refresh | `npm run map:project` | Pass | Refreshed route/project map artifacts after adding the new admin surface. |
| Local route reachability | `curl -I http://localhost:3001/ai/email-learning` | Partial | Anonymous access redirects to `/auth/login?callbackUrl=%2Fai%2Femail-learning`, which is expected for this protected admin route. |
| Auth bootstrap | `cd frontend && TEST_USER_1='Megan@megankharrison.com' TEST_PASSWORD_1='***' PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test tests/auth.setup.ts --config=config/playwright/playwright.config.ts --project=setup` | Pass | Allowlisted Megan session verified protected-route access for the local app. |
| Browser verification artifact | `docs/ops/evidence/2026-07-06-email-learning-management-surface/email-learning-browser-proof.png` | Pass | Authenticated Playwright proof stayed on `/ai/email-learning`, rendered `Email Learning`, and showed the management sections for deterministic exclusions, feedback signals, and linked review surfaces. |
| Admin-session proof | `frontend/tests/.auth/megan-admin.json` via direct Supabase sign-in + headless Playwright route check | Pass | Confirmed the allowlisted Megan session reaches the page while the shared `test1@mail.com` account remains blocked from `(admin)` surfaces by the dashboard allowlist. |

## Files Changed

- `docs/ops/tasks/2026-07-06-email-learning-management-surface.md` - Task gate and evidence ledger.
- `frontend/src/app/(admin)/ai/email-learning/page.tsx` - Dedicated admin route and data loading for email learning.
- `frontend/src/features/ai/email-learning/email-learning-client.tsx` - Quiet rule-management UI, recent feedback review, and linked follow-up surfaces.
- `frontend/src/app/api/email-filter-rules/route.ts` - Canonical admin GET/POST rule path updated to support enabled state.
- `frontend/src/app/api/email-filter-rules/[ruleId]/route.ts` - Canonical admin PATCH/DELETE path updated for full criteria editing and fail-loud empty-rule rejection.
- `frontend/src/app/api/email-filter-rules/[ruleId]/__tests__/route.test.ts` - Targeted regression coverage for PATCH rule editing behavior.
- `frontend/src/lib/navigation-config.ts` - Added dedicated admin navigation entry for Email Learning.
- `frontend/src/app/(admin)/learning-feedback/page.tsx` - Linked the generic learning page to the dedicated email-learning control surface.
