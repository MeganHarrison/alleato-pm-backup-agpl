# Outlook Draft Feedback Empty Page

Date: 2026-06-27
Linear: Not created - current session exposes Linear comments only, not issue creation
Status: Ready for publish - allowed-user live proof blocked by auth state

## Objective

Make `/outlook-draft-feedback` render for the intended reviewers and fail loudly
when auth/data is unavailable, instead of showing a blank/empty surface.

## Scope

- Verify the production route response.
- Fix the route-level auth contradiction between the allow-listed owner layout
  and page-level admin-only guard.
- Fix the feedback promotion service import bug that can break the page render.
- Run focused checks for the touched page/service/tests.
- Record any remaining live proof gap separately from code verification.

## Done Checklist

- [x] Create task markdown before implementation.
- [x] Verify production route response without auth.
- [x] Inspect page, layout, API, and feedback service contracts.
- [x] Patch page auth to match the route layout's owner-or-Brandon contract.
- [x] Verify duplicate declaration in email voice promotion generation is absent
  in the current working tree.
- [x] Add/update focused regression coverage.
- [x] Run focused lint/unit/type checks.
- [x] Verify route behavior locally or document exact auth blocker.
- [x] Fill evidence and final status.

## Evidence

Production readback:

- `curl -I -L --max-time 20 https://projects.alleatogroup.com/outlook-draft-feedback` -
  redirected to `/auth/login?callbackUrl=%2Foutlook-draft-feedback` for
  unauthenticated requests.

Root causes found:

- `frontend/src/app/(admin)/outlook-draft-feedback/layout.tsx` allows the owner
  and `bclymer@alleatogroup.com`, but
  `frontend/src/app/(admin)/outlook-draft-feedback/page.tsx` immediately calls
  `requireAdmin`, blocking the non-admin allow-listed reviewer.
- `frontend/src/lib/ai/services/feedback-event-service.ts` contains a duplicate
  `const key = emailVoiceGroupKey(row);` declaration inside
  `generateEmailVoicePromotionCandidates`, which can break compilation for the
  imported route module.
  - Follow-up readback showed the duplicate declaration was already absent in
    the current working tree before this slice edited the file.

Command evidence:

- `curl -I -L --max-time 20 https://projects.alleatogroup.com/outlook-draft-feedback` -
  unauthenticated production request redirects to login.
- Supabase service readback from local env - PASS, `ai_feedback_events` contains
  `0` rows where `event_type = 'outlook_email_draft_feedback_recorded'`; latest
  row is `null`.
- Supabase service readback of recent `ai_feedback_events` event types - PASS,
  no adjacent Outlook draft feedback event type is present.
- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts' 'src/lib/ai/services/__tests__/feedback-event-service.test.ts' --testNamePattern='outlook draft feedback access contract|creates Brandon email voice profile candidates'` -
  PASS, 2 tests.
- `cd frontend && ./node_modules/.bin/eslint 'src/app/(admin)/outlook-draft-feedback/page.tsx' 'src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts' 'src/lib/ai/services/feedback-event-service.ts' --quiet` -
  PASS.
- `cd frontend && npm run typecheck:changed` - PASS, no new `any` type debt.
- `cd frontend && rm -rf .next && npm run dev` - PASS, local dev server ready
  and `/outlook-draft-feedback` compiled.
- `curl -I -L --max-time 15 http://localhost:3001/outlook-draft-feedback` -
  PASS for unauthenticated behavior, redirects to login.
- `agent-browser --state frontend/tests/.auth/user.json open http://localhost:3001/outlook-draft-feedback` -
  BLOCKED for allowed-user render proof; saved browser state is authenticated
  but not owner/Brandon, so layout redirects to `/access-denied?reason=owner-only`.

Changed files:

- `frontend/src/app/(admin)/outlook-draft-feedback/page.tsx`
- `frontend/src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts`

Remaining:

- Production will show rows only after Outlook draft feedback is actually
  recorded. Current production data has zero matching events.
- Allowed-user browser proof needs an owner or `bclymer@alleatogroup.com`
  browser session; the available saved auth state is neither.

## Prevention

Add focused tests that prove the page delegates access to its route layout and
that email voice candidate generation still groups feedback without a compile
or runtime failure.
