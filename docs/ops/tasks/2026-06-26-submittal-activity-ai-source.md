# Task: Submittal Activity AI Source Visibility

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Objective

Surface the persisted workflow-response audit source in the submittal Activity feed so reviewers can distinguish an AI Review-sourced response from a normal manual workflow response without adding duplicate tables or noisy panels.

## Done Checklist

- [x] Existing Activity feed and detail API reviewed.
- [x] Detail API returns the history metadata needed to identify response source.
- [x] Activity feed annotates workflow responses sourced from AI Review.
- [x] UI remains quiet: no duplicate Activity items, no extra cards, no new table.
- [x] Fail-loud/data guardrail behavior preserved.
- [x] Targeted lint/type checks pass.
- [x] Browser or direct route proof captured for the real submittal detail payload.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Focused lint | `cd frontend && npx eslint --quiet src/features/submittals/submittal-detail-client.tsx src/hooks/use-submittals.ts '../frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/route.ts'` | PASS | Touched UI, hook type, and route files lint clean. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 3 changed routes passed structured error handling guard. |
| Real fixture data proof | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... query submittal_responses + submittal_history ... EOF` | PASS | Synthetic submittal has AI history `0dc8fb5b-75e8-40aa-9c65-c5d3f04a7704` with `metadata.response_id = ed04b6f8-2240-46a9-a508-531e1ac50f59`, matching the displayed response row. |

## Risks / Gaps

- Browser verification remains limited by the existing localhost profile/auth mismatch; direct DB payload proof confirms the detail API now selects the metadata needed by the existing Activity feed.
- Existing unrelated staged and unstaged checkout dirt remains outside this task and is not owned by this work.
