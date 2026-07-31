# Handoff: 2026-07-06 — Commitment CCO delete failure-loud repair

## Intake Block

1) Session ID: S121
2) Task ID: AAI-980
3) Linear issue: AAI-980
4) Linear URL: https://linear.app/megankharrison/issue/AAI-980/fix-commitment-change-order-delete-failures-and-surface-exact-blockers
5) Current status: In Progress
6) Files changed (absolute paths):
- /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-06-commitment-change-order-delete-failure-loud.md
- /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-06-S121-commitment-cco-delete-failure-loud.md
- /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md
- /Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-07-06-commitment-cco-delete-failure-loud/delete-api-response.json
- /Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-07-06-commitment-cco-delete-failure-loud/localhost-route-loaded.png
- /Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-07-06-commitment-cco-delete-failure-loud/delete-attempt-after-confirm.png
- /Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/route.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx
- /Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/__tests__/route.test.ts
7) Commands run and outcome (pass/fail counts):
- Pass: `Linear issue AAI-980 created for exact delete-failure repair`
- Pass: service-role read-back for `aa35f3c3-5ec0-4568-b126-f8671b4791cc` showed status pending, `1` scoped line item, and `0` payment-application references
- Pass: `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/__tests__/route.test.ts'`
- Pass with existing warnings: `cd frontend && ./node_modules/.bin/eslint 'src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/route.ts' 'src/app/api/commitments/[commitmentId]/change-orders/[changeOrderId]/__tests__/route.test.ts' 'src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx' --no-warn-ignored`
- Pass: `agent-browser --state frontend/tests/.auth/user.json open 'http://localhost:3001/876/change-orders/commitment/aa35f3c3-5ec0-4568-b126-f8671b4791cc'`
- Pass: authenticated browser-side `fetch('/api/commitments/a0d9d40d-37c5-4739-872e-e5412cbc785b/change-orders/aa35f3c3-5ec0-4568-b126-f8671b4791cc',{method:'DELETE'})` returned `412 PRECONDITION_FAILED` with the draft-status blocker message
8) Evidence artifacts (screenshot/video/report/log paths):
- /Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-07-06-commitment-cco-delete-failure-loud/localhost-route-loaded.png
- /Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-07-06-commitment-cco-delete-failure-loud/delete-attempt-after-confirm.png
- /Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-07-06-commitment-cco-delete-failure-loud/delete-api-response.json
9) Top 3 findings (frontend-visible issues first):
10) Recommended next action (one line): Publish the scoped delete-path repair, then follow with a schema backstop for orphanable `commitment_change_order_lines`.
11) Handoff file path: docs/ops/handoffs/2026-07-06-S121-commitment-cco-delete-failure-loud.md
12) Migration ledger evidence: None

## Linear Updates

- Kickoff comment: `0cc42ffd-959c-417a-b891-de5b9f266e8e`
- Milestone comments: `436829e7-ca98-4053-b9d5-92dea4036312`
- Completion/blocker comment:

## Current Status

The canonical delete route now fails loudly on non-draft status and invoice
references, explicitly removes scoped commitment-CO line items before parent
delete, and the exact detail page now surfaces the server message in the delete
toast instead of `Failed to delete`.
