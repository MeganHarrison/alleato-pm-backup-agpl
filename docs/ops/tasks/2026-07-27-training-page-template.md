# Task: Standardize Individual Training Pages

Status: Complete
Owner: Codex STRAININGTEMPLATE
Created: 2026-07-27
Task ID: LOCAL-20260727-TRAINING-PAGE-TEMPLATE
Linear Issue: N/A, direct single-session request.
Related Handoff: N/A, single-session delivery.

## Objective

Give every individual training lesson one shared page structure and keep the
learning experience inside Alleato instead of sending employees directly to
third-party sites.

## Scope

- Canonical individual training-page template.
- Internal detail route for every published Construction Resource Library item.
- Native on-page video or reading view, with source attribution.
- Existing written guide, method, and prompt pages migrated to the template.
- Removal of the SharePoint redirect from the training hub.
- Focused tests, authenticated browser proof, independent review, publication,
  and production readback.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/training/**`,
  `frontend/src/features/training/**`, and `frontend/src/lib/training/**`.
- Existing shared primitives/services: `PageShell`, `SectionRuleHeading`,
  `TRAINING_NAV_TABS`, `getResources`, and `resolveTrainingEmbed`.
- Deprecated behavior: published resource cards and the software module sending
  employees directly to external URLs.

Delivery lane: High-risk

## Acceptance Contract

- [x] One shared template owns title, description, breadcrumbs, training tabs,
      optional lesson metadata, and open-canvas content spacing.
- [x] Published resource cards link to an internal, specifically named
      `[resourceId]` route.
- [x] Supported YouTube, Vimeo, and Loom media renders on the individual page.
- [x] Documents and courses with no native body fail loudly instead of showing
      a blank or blocked iframe.
- [x] Source attribution remains available but is not the primary action.
- [x] Guide, method, and prompt pages use the same template.
- [x] The training hub has no SharePoint redirect.
- [x] Unknown or unpublished resource IDs use the canonical 404 boundary.
- [x] Focused regressions pass.
- [x] Desktop and mobile browser evidence is reviewed.
- [x] Independent review passes.
- [x] Production deployment is Ready and the authenticated canonical routes
      render without external redirect.

## Failure-Loudly Contract

- Cause surfaced as: missing or unpublished resource IDs render the canonical
  not-found boundary; unsupported on-page sources show an explicit
  native-content-required state and never trigger an automatic external
  redirect.
- Detection path: route tests, card-link tests, embed-policy tests, browser URL
  readback, and source-link inventory.
- Recovery path: return to the Resource Library, correct the resource record or
  approved embed URL, and reload the same internal lesson route.

## Evidence

Evidence directory:
`tests/agent-browser-runs/2026-07-27-training-page-template/`

- Focused Jest: 9 suites, 26 tests passed.
- Focused ESLint: zero errors and zero warnings.
- Route check: passed.
- Surface-complexity gate: four changed surfaces passed.
- Independent reviewer: approved with no blocking findings.
- Production deployment `dpl_FaxUdgQinJKLP3gUCPBdLxbjPsP1` is Ready for
  commit `7417830e0520afd7766129eaed350afb80226a7a`.
- Authenticated production verification passed on the canonical
  `https://projects.alleatogroup.com` alias for the hub, library, role guide,
  method, prompts, embedded video lesson, and unsupported-document state.
- Production runtime error scan for the deployment returned no errors.

## Remaining Risk

- The 67-resource production inventory has no exact URL match in the existing
  support corpus. Videos with approved embeds are complete on-page lessons;
  documents/courses still need Alleato-authored native content. Their internal
  pages now expose that gap explicitly and never auto-redirect.
