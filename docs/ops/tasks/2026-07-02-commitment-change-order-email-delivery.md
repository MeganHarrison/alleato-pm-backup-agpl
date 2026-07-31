# Task: Commitment Change Order Email Delivery

Status: Partial
Owner: Codex
Created: 2026-07-02
Linear Issue: Not linked in this session
Related Handoff: N/A

## Objective

Enable the exact commitment change order detail route to email its PDF through
the existing Resend-based send stack, while automatically BCCing the sender for
delivery confirmation.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing page/action surface reviewed.
- [x] Existing shared delivery/email helpers reviewed before adding new code.
- [x] Source-of-truth send stack chosen.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Shared Resend document email helper supports BCC.
- [x] Shared document-center send route auto-BCCs the sender when valid.
- [x] Commitment change order page exposes an email action.
- [x] Commitment change order recipients endpoint added.
- [x] Commitment change order email-send endpoint added.
- [x] Commitment change order PDF attachment reuses the canonical commitment CCO export contract.

## Integration Checklist

- [x] Exact route `/[projectId]/change-orders/commitment/[commitmentCoId]` can open the email dialog.
- [x] Dialog preloads scoped recipient suggestions from the linked commitment/vendor context.
- [x] Sending records project email history for the commitment change order.
- [x] Sender copy is BCC-only, not visible in `to_list`.

## Regression Guardrails

- [ ] Targeted tests added or updated for the new endpoint/helper surface.
- [x] Targeted lint/test checks run for changed files.
- [x] Exact failure path returns actionable errors instead of silent send failure.

## Verification Checklist

- [x] Static/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [x] End-to-end live send proof captured.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] A user on the exact commitment change order page can open an email dialog and send the current CCO PDF.
- [x] The recipient list defaults from the linked commitment/company context and still allows manual entry.
- [x] The outbound send uses Resend and automatically BCCs the sender when possible.
- [x] The send is logged against the project/change order in `project_emails`.
- [x] The attachment matches the canonical commitment CCO PDF export, not a second divergent template.

## Files Changed

- `frontend/src/lib/documents/email.ts`
- `frontend/next.config.ts`
- `frontend/src/lib/app-surface/app-surface.generated.json`
- `frontend/src/app/api/document-center/[recordType]/[recordId]/email/route.ts`
- `frontend/src/components/documents/DocumentDeliveryDialog.tsx`
- `frontend/src/lib/change-orders/commitment-change-order-pdf.ts`
- `frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx`
- `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/pdf/route.ts`
- `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/recipients/route.ts`
- `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/email/route.ts`
- `docs/architecture/PROJECT-MAP.md`
- `docs/ops/tasks/2026-07-02-commitment-change-order-email-delivery.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Shared send proof | Resend id `993fbcfc-9232-46ea-b630-2d292596497d` | Pass | Sent through shared Resend stack with BCC metadata recorded before exact-route wiring. |
| Exact record lookup | `commitment_change_orders_with_scope id=aa35f3c3-5ec0-4568-b126-f8671b4791cc` | Pass | Resolved to project `876`, contract `a0d9d40d-37c5-4739-872e-e5412cbc785b`, number `CCO-001`. |
| Targeted lint | `cd frontend && pnpm exec eslint 'src/components/documents/DocumentDeliveryDialog.tsx' 'src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx' 'src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/recipients/route.ts' 'src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/email/route.ts' 'src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/pdf/route.ts' 'src/lib/change-orders/commitment-change-order-pdf.ts' 'src/lib/documents/email.ts' 'src/app/api/document-center/[recordType]/[recordId]/email/route.ts'` | Pass | No errors after the route/dialog/helper changes. |
| Exact record live send | Resend id `fa04d15f-b54a-4233-a69c-87d943007b54` | Pass | Sent against commitment CCO `aa35f3c3-5ec0-4568-b126-f8671b4791cc` with attachment `CCO-001-CCO-for-1-change-event-000125.pdf`. |
| Exact record audit read-back | `email_events.resend_id = fa04d15f-b54a-4233-a69c-87d943007b54` | Pass | Row `22fd3fec-45d2-4258-b1b3-cb3e53cc070f` recorded `status=sent`, `record_type=commitment-change-order`, and `bcc_emails=[mharison@alleatogroup.com]`. |
| Exact record attachment failure found and fixed | `column projects.city does not exist` | Pass | Canonical commitment CCO PDF helper now reads `projects.state` plus `summary_metadata.postal_code` instead of nonexistent `projects.city` / `projects.zip_code`. |
| Pre-commit force-trace guardrail | `ERROR: PDF-rendering route(s) not force-traced in next.config.ts` | Pass | Added the new commitment CCO email route to `outputFileTracingIncludes` so Chromium is bundled for production PDF email rendering. |
| Project map guardrail | `npm run map:project` | Pass | Regenerated `docs/architecture/PROJECT-MAP.md` and `frontend/src/lib/app-surface/app-surface.generated.json` after the new API/email surface changed the project map. |

## Risks / Gaps

- Automated route/component tests were not added in this pass, so regression protection still leans on targeted lint plus the live send proof.
