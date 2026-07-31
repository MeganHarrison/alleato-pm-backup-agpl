# Handoff: 2026-07-01 — Subcontractor invoice percent autofill

## Intake Block

1) Session ID: S105
2) Task ID: `docs/ops/tasks/2026-07-01-subcontractor-invoice-percent-autofill.md`
3) Linear issue: AAI-843
4) Linear URL: https://linear.app/megankharrison/issue/AAI-843/subcontractor-invoice-auto-populate-amount-from-percent-input
5) Current status: In Progress - Reopened after regression report
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-01-subcontractor-invoice-percent-autofill.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-01-S105-subcontractor-invoice-percent-autofill.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/review-queue.md`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/invoicing/subcontractor/new/page.tsx`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/forms/NumberField.tsx`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/forms/fields/RHFNumberField.tsx`; `/Users/meganharrison/Documents/alleato-pm/frontend/eslint-plugin-design-system/rules/require-approved-form-components.js`; `/Users/meganharrison/Documents/alleato-pm/frontend/eslint-plugin-design-system/rules/require-approved-form-components.test.cjs`; `/Users/meganharrison/Documents/alleato-pm/frontend/eslint.config.mjs`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/invoicing/subcontractor-percent-autofill.ts`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/invoicing/__tests__/subcontractor-percent-autofill.test.ts`
7) Commands run and outcome (pass/fail counts): previous published-slice commands retained from first pass; rework commands: `cd frontend && npx jest --runInBand src/lib/invoicing/__tests__/subcontractor-percent-autofill.test.ts` pass 4/4; `cd frontend && npx eslint src/app/'(main)'/'[projectId]'/invoicing/subcontractor/new/page.tsx src/components/forms/NumberField.tsx src/components/forms/fields/RHFNumberField.tsx` pass with pre-existing warnings only; `node frontend/eslint-plugin-design-system/rules/require-approved-form-components.test.cjs` pass; `cd frontend && npx eslint --rule 'design-system/require-approved-form-components:error' src/components/daily-log/DailyLogFormClient.tsx` fail as expected with 5 raw numeric-input violations; `cd frontend && npm run audit:forms:components` pass with 514 total violations reported; `agent-browser --state frontend/tests/.auth/user.json --session aai843percent2 ...` pass with exact-route focus/typing proof; publish pending
8) Evidence artifacts (screenshot/video/report/log paths): `/tmp/aai843-subcontractor-percent-autofill.png`; `/tmp/aai843-percent-focus-fix.png`; `/tmp/aai843-jest.json`; GitHub issue `#595`; Linear issue `AAI-843`
9) Top 3 findings (frontend-visible issues first):
- The invoice-create grid now uses shared approved primitives for all editable numeric cells: `NumberInput` for percent and `MoneyField inline` for currency.
- Shared `NumberField` and `RHFNumberField` wrappers now inherit the same `NumberInput` focus/select/clear-zero behavior instead of rendering raw numeric `<Input>` controls.
- The tightened `design-system/require-approved-form-components` rule now fails loudly on raw numeric `Input` usage and exposes a repo-wide backlog of 514 form-component violations, including 5 numeric violations in `DailyLogFormClient.tsx`.
10) Recommended next action (one line): Accept the handoff, then fold the remaining page-level design-system debt on this invoice-create screen into a separate cleanup slice instead of mixing it into issue `#595`.
11) Handoff file path: `docs/ops/handoffs/2026-07-01-S105-subcontractor-invoice-percent-autofill.md`
12) Migration ledger evidence: N/A.

## Linear Updates

- Kickoff comment: `b7710c04-d7d6-4e92-96c5-5ac17ec8a895`.
- Milestone comments: `5ae2ecdf-55dc-4b49-a281-fd53ca97e5bc`.
- Completion/blocker comment: `5ae2ecdf-55dc-4b49-a281-fd53ca97e5bc`.

## Current Status

The initial issue was published to `origin/main` at `93293ab83`, then reopened
locally after a user-reported focus/typing regression. Rework is implemented
and re-verified locally; updated direct-to-main publish is still pending.

## Exact Next Step

Publish the reopened fix to `origin/main` with scoped files, then update Linear
and this handoff with the final commit/push evidence.

## Known Pitfalls

- The page still has pre-existing table/page design-system warnings unrelated
  to this numeric-input regression; keep those out of this scope.
- The browser proof depended on granting the test user active membership to
  project `876` and restarting the local Next server to clear cached
  authorization state.
- Do not reintroduce raw numeric `Input` usage in app code; the approved
  component path plus ESLint rule are now the guardrail seam.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
sed -n '1,260p' frontend/src/app/'(main)'/'[projectId]'/invoicing/subcontractor/new/page.tsx
sed -n '1,320p' frontend/src/app/api/commitments/'[commitmentId]'/invoices/route.ts
git show --stat 93293ab83
gh issue view 595 --repo MeganHarrison/alleato-pm
```

## Evidence

- GitHub issue `#595`
- Linear issue `AAI-843`
- `frontend/src/app/(main)/[projectId]/invoicing/subcontractor/new/page.tsx`
- `/tmp/aai843-subcontractor-percent-autofill.png`
