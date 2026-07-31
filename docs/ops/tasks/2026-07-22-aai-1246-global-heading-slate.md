# AAI-1246: Global heading slate accent

**Status:** Complete
**Linear:** https://linear.app/megankharrison/issue/AAI-1246/replace-global-heading-accent-with-slate-blue

## Outcome

Replace the shared non-semantic heading accent with `#3b4a63`, preserving orange for primary actions and semantic status UI.

## Attention brief

Primary user: Project team member reviewing source-backed construction data.
Primary job: Scan section boundaries without confusing headings with review states or actions.
Primary decision: Which content to inspect, verify, or act on.
Tier 1: Record title, review decision, source and candidate data.
Tier 2: Section labels that orient the review.
Tier 3: Supporting metadata and controls.
Hide until requested: No additional content or controls are added.
Remove: The orange visual treatment from shared section headings.
Primary action: Continue the review using existing decision controls.
Failure-loudly behavior: The shared `SectionRuleHeading` must inherit the heading-label token, so an accidental `text-primary` override is visible in source review and component validation.

## Checklist

- [x] Identify the canonical heading primitive and first divergence from expected color.
- [x] Set the shared light-theme heading-label token to `#3b4a63`.
- [x] Remove the shared primary-orange override from `SectionRuleHeading`.
- [x] Run targeted source and lint checks.
- [x] Capture canonical desktop and mobile screenshot evidence.
- [x] Attach evidence and closeout details to Linear.

## Evidence

- Root cause: `frontend/src/components/layout/spacing.tsx` forced `SectionRuleHeading` to `text-primary`; `Eyebrow` already owns the shared `text-heading-label` token.
- Light token: `215 25% 31%`, equivalent to `#3b4a63`.
- Targeted lint: `npx eslint src/app/globals.css src/components/layout/spacing.tsx` exited 0. The four reported warnings are pre-existing raw-detail-field warnings in untouched lines of `spacing.tsx`; no errors were reported.
- Guardrail: source assertion confirmed the exact HSL token, inherited `Eyebrow`, and absence of the former primary-orange override.
- Browser: authenticated local canonical checkout at `http://localhost:3000/asrs/tables/95fec116-9f3c-4ee0-8eae-1a7b65003017`; desktop `1280 × 720` and mobile `390 × 844` both computed all five review headings as `rgb(59, 74, 99)`.
- Linear screenshots: desktop attachment `923fe8a7-8572-4790-89ff-5ef6f6399d6d`; mobile attachment `11b63be0-25ce-42ca-a529-6cf4fde85faa`.
- Initial publication: commit `13c71cb636311e542b0c5d45c3726e3991069e7e` through the scoped main publisher. The final main-head confirmation is recorded in the Linear closeout.
