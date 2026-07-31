# Handoff: Exclude Intentional Pipeline Failures

Status: Pending Review
Owner: Codex
Task: `docs/ops/tasks/2026-07-17-exclude-intentional-pipeline-failures.md`
Linear: Unavailable, no Linear connector/tool exposed in this session.

## Scope

Updated the canonical document lifecycle API so recovery consumers exclude records carrying the backend `INTENTIONALLY_EXCLUDED:` marker. Genuine timeout failures remain in the feed.

## Changed files

- `frontend/src/app/api/documents/status/route.ts`
- `frontend/src/app/api/admin/source-sync/_lifecycle.ts`
- `frontend/src/app/api/admin/source-sync/__tests__/intentional-skips.test.ts`
- `frontend/src/app/(main)/ai-dashboard/rag-pipeline/rag-pipeline-preview.tsx`
- `frontend/src/app/(main)/ai-dashboard/__tests__/workspace-pages.test.tsx`
- `docs/ops/tasks/2026-07-17-exclude-intentional-pipeline-failures.md`
- `docs/ops/tasks/2026-07-17-exclude-intentional-pipeline-failures.verification-manifest.json`

## Evidence

- `npx eslint 'src/app/api/documents/status/route.ts' 'src/app/api/admin/source-sync/_lifecycle.ts'`: pass
- `npm run test:unit -- --runInBand src/app/api/admin/source-sync/__tests__/intentional-skips.test.ts`: pass, 8 tests
- `node ../scripts/check-no-new-any.mjs`: pass
- `npm run test:unit -- --runInBand --runTestsByPath src/app/(main)/ai-dashboard/__tests__/workspace-pages.test.tsx`: pass, 8 tests
- `npx eslint src/app/(main)/ai-dashboard/rag-pipeline/rag-pipeline-preview.tsx src/app/(main)/ai-dashboard/__tests__/workspace-pages.test.tsx`: pass
- `npx tsc --noEmit --pretty false --incremental false`: pass
- Authenticated runtime readback: `GET /api/documents/status?type=meeting&source=fireflies&per_page=100` returned 98 rows, 0 `INTENTIONALLY_EXCLUDED:` rows, and 11 statement-timeout rows. The reported timeout titles remain present.
- Desktop recovery screenshot: `docs/ops/evidence/2026-07-17-exclude-intentional-pipeline-failures-recovery-clean.png` shows only statement-timeout rows, with no intentional interview exclusion.
- Tablet recovery screenshot: `docs/ops/evidence/2026-07-17-exclude-intentional-pipeline-failures-recovery-tablet.png` shows the recovery heading and timeout-only rows.
- Mobile recovery screenshot: `docs/ops/evidence/2026-07-17-exclude-intentional-pipeline-failures-recovery-mobile.png` shows the recovery heading without overflow.
- Compact desktop screenshot: `docs/ops/evidence/2026-07-17-compact-pipeline-recovery-desktop.png` shows the reduced row height, smaller bounded error text, and retained statement-timeout reason.

## Root cause and prevention

- Root cause: the recovery API classified every ingestion job with an error message as `Failed`, including intentional exclusion markers.
- Detection gap: the endpoint had no intentional-skip classification at its transformation boundary.
- Prevention: reuse `isIntentionalSkipJob` and retain the predicate regression suite.

## Remaining blocker

Independent evidence review and the publish/finish flow are still required before this task can be marked complete. The next action is to have a separate reviewer assess the three artifacts, then run the task-owned finish flow.
