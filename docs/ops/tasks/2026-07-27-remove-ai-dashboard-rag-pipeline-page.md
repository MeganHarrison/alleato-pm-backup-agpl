# Task: Remove AI Dashboard RAG Pipeline Page

Status: Complete
Owner: Codex
Created: 2026-07-27
Task ID: local-rag-page-delete
Linear Issue: Unavailable; explicit user request
Related Handoff: N/A (single-session change)

## Objective

Remove `/ai-dashboard/rag-pipeline` from the product and leave remaining RAG operations and inline dashboard visualization behavior functional.

## Scope

- Dedicated AI dashboard RAG Pipeline route, navigation, generated app-surface index, and stale recovery links.
- Preserve `/api/ai-dashboard/rag-pipeline` and the shared inline dashboard visualization.

## Source of Truth

- Canonical page owner: `frontend/src/app/(main)/ai-dashboard/rag-pipeline/`
- Replacement operations surface: `/pipeline`

Delivery lane: Standard
Verification contract: Optional

## Acceptance Criteria

- [x] `/ai-dashboard/rag-pipeline` is no longer a registered page or navigation destination.
- [x] Remaining recovery links target `/pipeline`.
- [x] The RAG API remains available to the inline dashboard visualization.
- [x] Route checks pass; focused visualization tests pass. One unrelated existing workspace-shell padding assertion remains failing.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: deleted route returns the platform not-found response rather than a stale page.
- Detection path: route inventory, focused tests, and deployed URL check.
- Recovery path: use `/pipeline` for RAG operations.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Route guard | `npm run check:routes` | Pass | No route conflicts. |
| Generated inventory | `npm run map:project` | Pass | Page entry removed; API entry retained. |
| Focused tests | `npx jest --runTestsByPath ... --runInBand --silent` | Partial | Dashboard visualization suite: 4/4 pass; workspace suite: 6/7 pass. Existing canvas padding assertion is unrelated to this deletion. |
| Live route | `curl -L https://alleato-pm-backup.vercel.app/ai-dashboard/rag-pipeline` | Inconclusive | Current deployment redirects unauthenticated requests to login with the requested callback URL; authenticated route proof remains after this push. |

## Remaining Risk

- Authenticated deployed-route proof remains the follow-up because the public URL redirects to login before rendering protected routes.

## Final Status

- [x] All required checklist items are complete.
