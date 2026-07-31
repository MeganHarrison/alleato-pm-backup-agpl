# Task: Improve form-field audit coverage and reduce non-form noise

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-984 https://linear.app/megankharrison/issue/AAI-984/improve-automated-form-field-audit-coverage-and-reduce-non-form-noise
Related Handoff: /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-06-S123-form-field-audit-coverage.md

## Objective

Turn the new repo-level form-field audit into a practical workflow by filtering out infrastructure noise, improving extraction for config-driven/controller-heavy forms, and making unsupported user-facing form surfaces fail loudly with useful output.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [ ] Database schema/types/migrations handled, if applicable.
- [ ] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [ ] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [ ] Source adapters or external dependencies return typed, inspectable results.
- [ ] Run/task/session ledger records every meaningful attempt.
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [ ] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [ ] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Initial audit baseline | `npm run audit:form-fields -- --summary` | Pass | Baseline before refinement: `114` candidates, `69` unsupported, `374` extracted fields, `14` missing labels, `22` missing types. |
| Prior repo context | `rg`/file review across `create-project`, purchase-order, subcontract, RFI, and invoicing form surfaces | Pass | Representative noisy and partially supported form patterns identified before patching the extractor. |
| Task + issue linkage | `AAI-984`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-06-form-field-audit-coverage.md` | Pass | Full-process tracking opened before continuing implementation. |
| Targeted extractor proof | `node scripts/audits/audit-form-field-inventory.mjs --match 'create-project/page.tsx'`; `--match 'purchase-order-address-fields.tsx'`; `--match 'CreatePurchaseOrderForm.tsx'`; `--match 'rfis/new/page.tsx'`; `--match 'budget/line-item/new/page.tsx'` | Pass | Create-project now inventories imported config fields, wrapper pages like new RFI can inherit fields from local form components, and the budget line-item page no longer shows as unsupported. |
| Current repo-wide result | `npm run audit:form-fields -- --summary` | Pass | Current state after refinement: `91` candidates, `18` unsupported, `618` extracted fields, `10` missing labels, `8` missing types. |
| Static-check limitation | `./node_modules/.bin/eslint scripts/audits/audit-form-field-inventory.mjs`; `CI=true pnpm --dir frontend exec eslint ../scripts/audits/audit-form-field-inventory.mjs` | Partial | Root ESLint binary is absent in this checkout; frontend fallback tried to recreate `frontend/node_modules`, so the lint path was intentionally stopped and documented. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-06-form-field-audit-coverage.md` - task ledger and verification plan.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-06-S123-form-field-audit-coverage.md` - worker handoff and evidence trail.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md` - ownership claim.
- `/Users/meganharrison/Documents/alleato-pm/scripts/audits/audit-form-field-inventory.mjs` - audit implementation.
- `/Users/meganharrison/Documents/alleato-pm/package.json` - command entrypoint.

## Risks / Gaps

- Some files with `<form>` tags are interactive chat/editor surfaces rather than business forms; the filter must remove that noise without hiding real forms.
- Config-driven and controller-heavy sections may require multiple extraction paths; one heuristic pass will not cover every custom pattern.
- Browser verification is not applicable because this task changes offline audit tooling, not end-user page behavior.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
