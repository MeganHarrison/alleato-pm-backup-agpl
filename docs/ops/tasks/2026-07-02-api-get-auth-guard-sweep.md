# Task: Sweep API GET routes for missing cookie-auth guards

Status: In Progress
Owner: Codex
Created: 2026-07-02
Related Handoff: Not yet created
Linear Issue: AAI-882 https://linear.app/megankharrison/issue/AAI-882/sweep-api-get-routes-for-missing-cookie-auth-guards

## Objective

1. Sweep the targeted `frontend/src/app/api/**/route.ts` GET handlers that use the cookie-based server Supabase client.
2. Add the canonical `getApiRouteUser()` -> `GuardrailError({ code: "AUTH_EXPIRED", ... })` guard before the first Supabase query anywhere the GET handler currently falls through to anon-role RLS behavior.
3. Tighten `scripts/api-smoke-contracts.mjs` for every fixed route from `[200, 401]` to `[401]`, using the production-smoke grace-window option so PR checks can pass before deploy.
4. Leave explicit evidence of what was fixed and what remains.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is completed, with evidence and outcomes.
If any item cannot be completed, mark status as `Blocked/Deferred` and document owner + next action.

## Scope Checklist

- [x] Canonical guard pattern identified from the previously fixed GET handlers.
- [x] Confirm at least one live class example (`/api/projects/[projectId]/change-events`) where unauthenticated GET can return `200` with silent empty data.
- [x] Build a concrete route set for this sweep from `frontend/src/app/api/**/route.ts`.
- [x] Confirm whether a pre-existing Linear issue already tracks this sweep, or create one if not.

## Implementation Checklist

- [x] Add the canonical GET auth guard to the confirmed missing routes in the change-management cluster.
- [x] Add the canonical GET auth guard to the confirmed missing routes in adjacent contract/commitment surfaces touched by the same class.
- [x] Keep guards ahead of the first Supabase query in each fixed route.
- [x] Avoid changing already-correct routes or intentionally public routes for this batch.

## Verification Checklist

- [x] Targeted route inspection confirms each fixed GET now calls `getApiRouteUser()` before its first query.
- [x] `scripts/api-smoke-contracts.mjs` is tightened to `[401]` for each route fixed in this task where a smoke entry exists, with grace-window fallback for current production behavior until deploy.
- [x] Narrow repo verification run completes for touched files/routes.

## Evidence

- [x] Root cause: GET handlers that call `createClient()` from `@/lib/supabase/server` before any auth/access guard can execute Supabase queries as the anon role, which silently returns empty data under RLS instead of failing loud with `401`.
- [x] Confirmed missing-guard examples before patching:
  - `frontend/src/app/api/projects/[projectId]/change-events/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/origin-options/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/next-number/route.ts`
  - `frontend/src/app/api/projects/[projectId]/commitment-change-orders/export/route.ts`
  - `frontend/src/app/api/projects/[projectId]/contracts/route.ts`
  - `frontend/src/app/api/projects/[projectId]/pcos/route.ts`
  - `frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/route.ts`
  - `frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/export/route.ts`
  - `frontend/src/app/api/projects/[projectId]/checklist/route.ts`
  - `frontend/src/app/api/projects/[projectId]/commitment-options/route.ts`
  - `frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/change-events/route.ts`
  - `frontend/src/app/api/projects/[projectId]/contracts/[contractId]/change-orders/route.ts`
  - `frontend/src/app/api/projects/[projectId]/contracts/settings/route.ts`
  - `frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/route.ts`
- [x] Additional same-class helper routes fixed in this batch:
  - `frontend/src/app/api/document-picker/types/route.ts`
  - `frontend/src/app/api/entity-links/route.ts`
  - `frontend/src/app/api/entity-links/search/route.ts`
  - `frontend/src/app/api/estimates/gc-templates/route.ts`
- [x] Additional route families fixed after the initial batch:
  - `frontend/src/app/api/commitments/[commitmentId]/route.ts`
  - `frontend/src/app/api/commitments/[commitmentId]/change-orders/route.ts`
  - `frontend/src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/route.ts`
  - `frontend/src/app/api/commitments/[commitmentId]/history/route.ts`
  - `frontend/src/app/api/commitments/[commitmentId]/invoices/route.ts`
  - `frontend/src/app/api/commitments/[commitmentId]/related-items/route.ts`
  - `frontend/src/app/api/commitments/[commitmentId]/rfqs/route.ts`
  - `frontend/src/app/api/commitments/[commitmentId]/advanced-settings/route.ts`
  - `frontend/src/app/api/document-picker/linked/route.ts`
  - `frontend/src/app/api/directory/vendors/route.ts`
  - `frontend/src/app/api/directory/vendors/[vendorId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/rfis/route.ts`
  - `frontend/src/app/api/projects/[projectId]/rfis/[rfiId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittals/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittals/packages/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittals/export/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittals/specs/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittal-packages/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittal-spec-sections/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittal-types/route.ts`
  - `frontend/src/app/api/projects/[projectId]/transmittals/route.ts`
  - `frontend/src/app/api/projects/[projectId]/transmittals/[transmittalId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/vendors/route.ts`
  - `frontend/src/app/api/projects/[projectId]/directory/people/route.ts`
  - `frontend/src/app/api/projects/[projectId]/budget-codes/route.ts`
  - `frontend/src/app/api/projects/[projectId]/budget-changes/route.ts`
  - `frontend/src/app/api/projects/[projectId]/pcos/[pcoId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/pcos/[pcoId]/line-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/pcos/[pcoId]/change-events/route.ts`
  - `frontend/src/app/api/projects/[projectId]/commitment-change-orders/route.ts`
  - `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/line-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/photos/route.ts`
  - `frontend/src/app/api/projects/[projectId]/photos/[photoId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/attachments/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/attachments/[attachmentId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/related-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/related-items/options/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/prime-contract-change-orders/route.ts`
  - `frontend/src/app/api/projects/[projectId]/contracts/[contractId]/attachments/route.ts`
  - `frontend/src/app/api/projects/[projectId]/contracts/[contractId]/line-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/contracts/[contractId]/related-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/photo-albums/route.ts`
  - `frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/related-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/related-items/options/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/related-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/revisions/route.ts`
  - `frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/workflow-steps/route.ts`
- [x] Verification evidence:
  - `git diff --check`
  - `node --check scripts/api-smoke-contracts.mjs`
  - `cd frontend && ./node_modules/.bin/eslint -c eslint.config.mjs <targeted touched route files>` -> no errors; only pre-existing `@typescript-eslint/no-explicit-any` warnings remain in legacy files.
  - `node scripts/check-changed-route-guardrails.mjs` -> `routes=70`, `without_structured_handling=0`, `raw_error_routes=0`
- [x] Smoke-contract evidence:
  - added grace-window handling to `scripts/api-smoke-contracts.mjs` via `AUTH_401_GRACE = { graceUntil: "2026-07-05", graceStatuses: [200] }`.
  - tightened `scripts/api-smoke-contracts.mjs` entries for `change-events`, `change-events/[id]`, `change-events/origin-options`, `pcos`, `prime-contract-change-orders`, `prime-contract-change-orders/[id]`, `prime-contract-change-orders/export`, `commitment-change-orders`, `commitment-change-orders/export`, `contracts`, `contracts/settings`, `directory/vendors`, `rfis`, `submittals`, `submittals/packages`, `submittals/specs`, `checklist`, `transmittals`, `budget-codes`, `directory/people`, `vendors`, `photos`, and `photo-albums`.
- [ ] Remaining broader-sweep evidence:
  - Static heuristics still surface additional GET candidates outside this batch. Remaining inventory is now concentrated in `contracts/[contractId]/payment-applications*`, `contracts/[contractId]/payments`, `contracts/[contractId]/change-orders/[changeOrderId]`, `commitments/[commitmentId]/payments`, `change-events/rfqs/*`, `invoicing/subcontractor/invoices/*`, and clearly non-production `dev-panel/*` and `testing/*` routes, so repo-wide exhaustion is not yet proven.

## Files Expected To Change

- frontend/src/app/api/projects/[projectId]/change-events/route.ts
- frontend/src/app/api/projects/[projectId]/change-events/origin-options/route.ts
- frontend/src/app/api/projects/[projectId]/change-events/next-number/route.ts
- frontend/src/app/api/projects/[projectId]/commitment-change-orders/export/route.ts
- frontend/src/app/api/projects/[projectId]/contracts/route.ts
- frontend/src/app/api/projects/[projectId]/pcos/route.ts
- frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/route.ts
- frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/export/route.ts
- frontend/src/app/api/projects/[projectId]/checklist/route.ts
- frontend/src/app/api/projects/[projectId]/commitment-options/route.ts
- frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/change-events/route.ts
- frontend/src/app/api/projects/[projectId]/contracts/[contractId]/change-orders/route.ts
- frontend/src/app/api/projects/[projectId]/contracts/settings/route.ts
- frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/route.ts
- frontend/src/app/api/document-picker/types/route.ts
- frontend/src/app/api/entity-links/route.ts
- frontend/src/app/api/entity-links/search/route.ts
- frontend/src/app/api/estimates/gc-templates/route.ts
- scripts/api-smoke-contracts.mjs
- additional route files listed in Evidence as the sweep expanded

## Final Status

- [ ] All checklist items complete.
- [x] Known unrelated failures documented with owner and next action.

## Remaining Work

- Continue the broader repo-wide sweep tracked in `AAI-882` for the remaining static GET candidates not included in this batch.
