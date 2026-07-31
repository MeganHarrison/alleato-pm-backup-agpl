# Task: Email Assistant Evidence Cleanup

Status: Complete
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-776 - https://linear.app/megankharrison/issue/AAI-776/clean-email-assistant-sandbox-decision-evidence-text

## Objective

Make the `/outlook-draft-feedback` decision explanation readable by stripping raw email header blobs from Brandon triage evidence and renaming the sidebar label to plain English.

## Checklist

- [x] Clean shared Brandon triage evidence excerpts.
- [x] Add regression coverage for header-heavy email bodies.
- [x] Rename the sidebar label from `Evidence` to a clearer reviewer-facing label.
- [x] Rerun the June 30 sandbox backfill so saved rows are updated.
- [x] Verify read-back for the affected rows.
- [x] Run focused checks.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/email-assistant/__tests__/brandon-triage.test.ts` | Pass | 5 tests passed, including header-heavy synced body regression. |
| Lint/type | `cd frontend && npx eslint src/lib/email-assistant/brandon-triage.ts src/lib/email-assistant/__tests__/brandon-triage.test.ts src/features/emails/project-emails-workspace.tsx --quiet`; `git diff --check -- ...` | Pass | Focused ESLint and whitespace checks passed. |
| Backfill update | `npm run email-assistant:backfill-sandbox -- --date=2026-06-30 --mailbox=bclymer@alleatogroup.com --write --json` | Pass | Updated 2 existing sandbox rows, inserted 0 duplicates. |
| Read-back | Supabase read-back for intake IDs 4046 and 4047 | Pass | Row 4046 evidence is `Re: Please see the attached 2pm works for me`; both rows report `hasHeaderNoise=false`. |

## Risks / Gaps

- This changes the displayed justification text, not the assistant's underlying action/priority decision logic.
- Existing non-backfill human review rows are not overwritten.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
