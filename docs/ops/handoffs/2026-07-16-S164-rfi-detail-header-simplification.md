# Handoff: 2026-07-16 — RFI Detail Header Simplification

## Intake Block

1) Session ID: S164
2) Task ID: AAI-1129
3) Linear issue: AAI-1129
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1129/simplify-the-canonical-rfi-detail-header-and-status-placement
5) Current status: In Progress — title/API/detail work passes; shared form field awaits AAI-1128, and post-change browser evidence awaits publication, not authentication.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx`, `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(main)/[projectId]/rfis/[rfiId]/rfi-detail.tsx`, `/Users/meganharrison/Documents/github/project-management/frontend/src/app/api/projects/[projectId]/rfis/**`, `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/schemas/rfi-schema.ts`, `/Users/meganharrison/Documents/github/project-management/frontend/src/components/ds/inspector.tsx`, focused tests, task/evidence files.
7) Commands run and outcome (pass/fail counts): Focused Jest 3 suites/7 tests pass; targeted ESLint pass; changed route guardrails pass; changed type guard pass; surface complexity audit pass; `verify:browser-auth` pass on the canonical production route.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-16-rfi-detail-header-simplification/authenticated-production-route-preflight.png` (authenticated pre-deploy route access), `before-production-desktop.png` (pre-change only), `independent-review.md`, `verification-result.json`.
9) Top 3 findings (frontend-visible issues first): Header used a reference number instead of the RFI subject; custom RFI numbering had no input/API path; Details needed to own status and number as compact record properties.
10) Recommended next action (one line): Land the AAI-1128 shared RFI Number field, then capture authenticated canonical desktop/mobile screenshots.
11) Handoff file path: `docs/ops/handoffs/2026-07-16-S164-rfi-detail-header-simplification.md`
12) Migration ledger evidence: N/A — no database change.

## Linear Updates

- Kickoff comment: Posted to AAI-1129, comment `19164399-8080-49cb-a7ae-e89d312c1a43`.
- Milestone comments: Focused tests, lint, and surface audit recorded in the blocker update.
- Authentication incident/prevention comment: Posted to AAI-1129, comment `65985b99-05e3-4cd3-9a54-cea60878a5d5`.

## Current Status

The detail title now uses the subject. Details supports inline RFI number editing, and create/update APIs support auto or custom positive whole numbers with project-scoped duplicate conflicts. The shared create/edit form field is coordinated with AAI-1128. Focused tests, lint, guardrails, and surface audit pass. `verify:browser-auth` now makes authenticated exact-route browser access deterministic: it refreshes env-backed state, stops the daemon that silently ignores `--state`, opens the requested route, and fails if the route redirects to login. Visual verification cannot finish until the changed revision is published.

## Exact Next Step

Integrate the AAI-1128 `RfiFormFields` number input, publish the changed revision, run `npm run verify:browser-auth -- --base-url https://projects.alleatogroup.com --route /1142/rfis/1df9c180-b5df-4afd-99b6-3da27289086a --session aai-1129-proof`, capture desktop and mobile screenshots, then run the verification contract with a PASS result.

## Known Pitfalls

- Do not create a route-local status pill. Reuse `StatusBadge`.
- Do not remove status behavior, only move its presentation from the header to Details.
- Do not treat the pre-change screenshot as evidence for the revised surface.
- Do not call browser proof blocked by authentication before running `verify:browser-auth`; it owns the saved-state refresh and stale-daemon reset.

## Resume Commands

```bash
npm run verify:browser-auth -- --base-url https://projects.alleatogroup.com --route /1142/rfis/1df9c180-b5df-4afd-99b6-3da27289086a --session aai-1129-proof
agent-browser --session-name aai-1129-proof snapshot -i
```

## Evidence

- `docs/ops/evidence/2026-07-16-rfi-detail-header-simplification/verification-manifest.json`
- `docs/ops/evidence/2026-07-16-rfi-detail-header-simplification/verification-result.json`
- `docs/ops/evidence/2026-07-16-rfi-detail-header-simplification/independent-review.md`
- `docs/ops/evidence/2026-07-16-rfi-detail-header-simplification/authenticated-production-route-preflight.png`
