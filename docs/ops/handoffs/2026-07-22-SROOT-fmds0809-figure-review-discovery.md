# SROOT: FMDS0809 Figure Review Discovery

## Intake

1) Session ID: SROOT-FIGURE-REVIEW
2) Task ID: AAI-1211
3) Linear issue: AAI-1211
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1211/prepare-fmds-8-9-estimator-review-batch-1
5) Current status: Published to `origin/main` at `d9f43c8a4756891e5892eb14596c981318b9eb13`.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/fmds/fmds-figures.server.ts`, `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/fmds/fmds-figures.ts`, `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(main)/asrs/figures/page.tsx`, `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/fmds/__tests__/fmds-figures.test.ts`, `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-22-fmds0809-figure-review-discovery.md`, `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-22-SROOT-fmds0809-figure-review-discovery.md`
7) Commands run and outcome (pass/fail counts): Jest 3/3 pass; focused ESLint pass with no errors; changed-file typecheck pass; live ASRS aggregate pass; authenticated browser artifact pass.
8) Evidence artifacts (screenshot/video/report/log paths): `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-22-fmds0809-figure-review-discovery/asrs-figures-fmds0809-desktop.png`; Linear attachment `aa4f34bf-8509-4e49-9e69-45c8ae0559a7`.
9) Top 3 findings (frontend-visible issues first): The figures page silently displayed FMDS0834; FMDS0809 had 37 pending figures; the revision name and review state were absent from the visible list context.
10) Recommended next action (one line): Publish this review-queue fix, then generate structured candidates for the priority FMDS0809 figures so their detail reviews can be approved meaningfully.
11) Handoff file path: `docs/ops/handoffs/2026-07-22-SROOT-fmds0809-figure-review-discovery.md`
12) Migration ledger evidence: Not applicable; no migration was created.

## Current Status

- The ASRS figures workspace now selects the newest staging corpus that contains figures marked `needs_review`; it falls back only to a non-empty staging corpus, then an active corpus.
- The page names the selected revision and state. The canonical view renders `FMDS0809 · 2026-04 · staging review figure corpus`, 37 rows, and visible `needs_review` status badges.
- Evidence URLs accept the selected staging or active revision and no longer apply the obsolete FMDS0834 restriction. No corpus was activated and no review decision or estimator rule changed.

## Known Pitfalls

- The 37 figures intentionally remain pending review. Their stored descriptions only assert visual validation is required; structured candidate interpretations still need the separate review-packet repair.
- An unrelated `python3 scripts/asrs/verify_fmds0809.py` full retrieval verification currently fails its table retrieval assertion. It is outside this figures-discovery change and should be handled in AAI-1211's retrieval/review-packet work.
- The broad changed-file quality gate reports one existing warning in unowned dirty file `frontend/src/components/fmds/fmds-visual-review-form.tsx:143`; this slice's focused Jest, lint, typecheck, live readback, browser proof, and independent review pass.

## Linear Updates

- Kickoff comment: AAI-1211 already tracks the FMDS0809 review batch.
- Milestone comment: posted to AAI-1211 as `7e2fc554-7d8e-4f2d-affa-d59c07b38760`; screenshot attachment `aa4f34bf-8509-4e49-9e69-45c8ae0559a7` is linked to the same issue.

## Handoff Summary

- Root cause: `getFmdsFiguresPageData` was pinned to `FMDS0834`; the actual FMDS0809 staging revision (37 `needs_review` figures) could not reach `/asrs/figures`.
- Guardrail: a pure selection contract now prefers staged figures needing review, with explicit staging and active fallbacks, and focused test coverage.
- Publication: `d9f43c8a4756891e5892eb14596c981318b9eb13` on `origin/main`; this closeout updates the task's final checklist state.
