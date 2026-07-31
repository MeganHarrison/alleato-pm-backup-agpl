# Handoff: 2026-07-01 — Drawings Procore zoom and pan

## Intake Block

1) Session ID: S105
2) Task ID: AAI-856
3) Linear issue: AAI-856
4) Linear URL: https://linear.app/megankharrison/issue/AAI-856/drawings-viewer-promote-openseadragon-wheel-zoom-and-pan-on-canonical
5) Current status: In Progress
6) Files changed (absolute paths):
7) Commands run and outcome (pass/fail counts):
8) Evidence artifacts (screenshot/video/report/log paths):
9) Top 3 findings (frontend-visible issues first):
- Canonical `/drawings/viewer/[drawingId]` still used the legacy `react-pdf` viewer.
- OpenSeadragon wheel zoom and pan already existed on the duplicate `viewer-v2` path.
- The durable fix is to make canonical viewer own OSD and redirect `viewer-v2` into it.
10) Recommended next action (one line): Land canonical OSD swap, run focused checks, deploy with `codex:finish`, and capture production browser proof.
11) Handoff file path: docs/ops/handoffs/2026-07-01-S105-drawings-procore-zoom-pan.md
12) Migration ledger evidence: N/A

## Linear Updates

- Kickoff comment:
- Milestone comments:
- Completion/blocker comment:

## Current Status

Issue scope traced from GitHub issue #542 to the real `/876/drawings` flow. The
root cause is identified and the implementation plan is narrowed to the
canonical viewer route plus duplicate-route consolidation.

## Exact Next Step

Patch the canonical viewer page to use `OsdDrawingViewerWithComments` and make
`viewer-v2` redirect to the canonical route.

## Known Pitfalls

- Do not switch user entry points to a different route and leave two active
  viewers alive.
- Do not claim success without deployed browser proof on the actual production
  route.
- Use exact task-owned files when running `codex:finish` because the checkout is dirty.

## Resume Commands

```bash
git status --short --branch
sed -n '1,220p' 'frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx'
sed -n '1,220p' 'frontend/src/app/(main)/[projectId]/drawings/viewer-v2/[drawingId]/page.tsx'
```

## Evidence

Pending implementation and verification.
