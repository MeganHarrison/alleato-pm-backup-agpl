# Task: Direct Cost Invoice Detail Design

Status: Complete
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-892 - https://linear.app/megankharrison/issue/AAI-892/quiet-direct-cost-invoice-detail-page-design
Related Handoff: N/A

## Objective

Fix the design of `/876/direct-costs/d93681ae-c645-47e3-881e-04aca2b72c7e` so the direct-cost invoice detail page reads as a quiet, scannable invoice inspection surface, not a noisy metadata grid.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: Direct-cost invoice detail page.
One purpose: Inspect one synced Acumatica direct-cost invoice and its line items.
Primary user job: Confirm invoice identity, vendor, amount, dates, status, and cost-code line items.
Primary action: Return to/directly compare against the Direct Costs list.
Secondary actions: Open the Acumatica source when a reference exists.
Next action after success: Back to Direct Costs or inspect the linked Acumatica record.
Correction path: Use Acumatica sync/list workflow; the detail page remains read-only.
Keyboard path: Header actions, property links, and table content are reachable through normal tab/focus order.
Information that belongs elsewhere: Audit timestamps should not compete with invoice facts.
Blessed pattern: Detail page + shared `DetailPropertyBar`/`DetailPropertyItem` + read-only `InlineTable`.
Complexity budget: Full detail page, no nested cards, no dashboard/stat-card treatment, no duplicate CTA.
Pass/fail: Current page fails; target page must pass before closeout.

## Noise Gate Brief

Primary user: Project/accounting user reviewing direct costs.
Primary job: Verify invoice cost data quickly.
Primary decision: Is this the expected invoice/cost and do the line items explain the amount?
Tier 1: Invoice number, total amount, vendor, status.
Tier 2: Invoice date, received/paid dates, Acumatica reference.
Tier 3: Description and line items.
Hide until requested: None in scope.
Remove: Generic subtitle, decorative status badge cluster, competing record-info rail.
Primary action: Back to Direct Costs.
Failure-loudly behavior: API load failure remains a toast/error state; missing source reference renders as synced state instead of a fake link.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Shared detail page/property primitives used instead of one-off layout.
- [x] Low-value metadata demoted or removed from primary focus.
- [x] User-facing copy/UI follows project noise gate and design-system rules.

## Integration Checklist

- [x] Existing direct-cost API contract remains unchanged.
- [x] Page still loads the requested invoice by `projectId` and `costId`.
- [x] Acumatica source link remains available when a reference exists.
- [x] Line item totals still match the visible line items.
- [x] Empty/not-found/loading states remain recoverable.

## Regression Guardrails

- [x] Surface complexity audit run on changed UI file.
- [x] Targeted lint/check run for changed UI file.
- [x] Browser evidence captured for the actual requested route or local authenticated equivalent.

## Verification Checklist

- [x] Static/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Design doctrine audit run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] Header/title focuses on the invoice identity instead of generic `Direct Cost Details`.
- [x] Total amount, vendor, status, and key dates are visible without badge/grid noise.
- [x] Record timestamps do not compete with the invoice facts.
- [x] Line items keep the shared read-only inline table pattern and right-aligned monetary totals.
- [x] No new one-off visual component is introduced.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Initial browser check | `agent-browser --session invoice-design --state frontend/tests/.auth/user.json open 'https://projects.alleatogroup.com/876/direct-costs/d93681ae-c645-47e3-881e-04aca2b72c7e'` | Redirected to login | Production state was not authenticated; direct login fallback will be attempted. |
| Production visual baseline | `docs/ops/evidence/2026-07-02-direct-cost-invoice-detail-design/direct-cost-production-before.png` | Pass | Direct login with env-backed test credentials succeeded; screenshot captured old noisy layout. |
| Design doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs 'frontend/src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx'` | Pass | Changed UI file passes surface complexity gate. |
| Static/lint check | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx'` from `frontend/` | Pass | Initial `npm --prefix frontend exec eslint -- 'src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx'` failed because the path was not resolved from `frontend/`; rerun passed from the correct cwd. |
| Whitespace check | `git diff --check -- 'frontend/src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx' docs/ops/tasks/2026-07-02-direct-cost-invoice-detail-design.md` | Pass | No whitespace errors. |
| Local visual proof | `docs/ops/evidence/2026-07-02-direct-cost-invoice-detail-design/direct-cost-local-after.png` | Pass | Local authenticated route shows `Invoice #1500`, compact property row, quiet invoice details, and read-only line-items table. |
| Source-link proof | `agent-browser --session invoice-design-local eval "Array.from(document.querySelectorAll('a')).filter(a => a.textContent?.includes('Bill 003649')).map(a => a.href)"` | Pass | Returned `https://alleatogroup.acumatica.com/Main?ScreenId=PM304000&RefNbr=003649`. |
| Navigation proof | `agent-browser --session invoice-design-local eval "document.querySelector('a[href=\"/876/direct-costs\"]')?.click()" && agent-browser --session invoice-design-local wait 1500 && agent-browser --session invoice-design-local get url` | Pass | Returned `http://localhost:3001/876/direct-costs`. |
| Publish proof | `npm run codex:finish -- --message "Quiet direct cost invoice detail" --files ...` | Pass | Published commit `6d877f3d02` to `origin/main`. |
| Production deploy check | `npx vercel inspect dpl_2KzaUsH5pebhapVL8Brp9wzdmNd3 --logs` | Failed | Vercel build failed because `@/components/ui/detail-property-bar` was untracked locally and omitted from the first scoped commit. Cause: local dev resolved an untracked shared primitive. Detection gap: the scoped finish command did not include that dependency. Prevention: add the shared primitive as a task-owned file and rerun publish/deploy verification. |
| Follow-up design audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs 'frontend/src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx' frontend/src/components/ui/detail-property-bar.tsx` | Pass | Page and shared primitive pass the design doctrine surface audit. |
| Follow-up static/lint check | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx' 'src/components/ui/detail-property-bar.tsx'` from `frontend/` | Pass | Page and shared primitive lint cleanly. |
| Follow-up publish proof | `npm run codex:finish -- --message "Add detail property bar primitive" --files frontend/src/components/ui/detail-property-bar.tsx docs/ops/tasks/2026-07-02-direct-cost-invoice-detail-design.md` | Pass | Published commit `bdca3704a` to `origin/main`. |
| Production deploy proof | `npx vercel inspect dpl_FHCaSArkSFAVgYcPw1uvrS8kGxSe` | Pass | Deployment is Ready and assigned to `https://projects.alleatogroup.com`. |
| Production visual proof | `docs/ops/evidence/2026-07-02-direct-cost-invoice-detail-design/direct-cost-production-after.png` | Pass | Exact production route shows `Invoice #1500`, compact property row, quiet invoice details, and the line-items table. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx` - direct-cost invoice detail UI owner.
- `frontend/src/components/ui/detail-property-bar.tsx` - shared compact detail-property row primitive required by the invoice detail page.
- `docs/ops/tasks/2026-07-02-direct-cost-invoice-detail-design.md` - task definition and evidence.

## Risks / Gaps

- First production deployment failed because the shared property-bar primitive was not included in the scoped commit; follow-up commit includes it and the production deployment is Ready.
- The page is read-only by product design because direct costs sync from Acumatica.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
