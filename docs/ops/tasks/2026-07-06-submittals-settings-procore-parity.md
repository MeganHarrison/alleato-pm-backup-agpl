# Task: Submittals Settings Procore Parity

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: N/A

## Objective

Capture the exact settings shown across all tabs on the Procore submittals settings page for the specified project, then update the Alleato submittals settings route for project `876` to match the verified Procore settings surface as closely as the product supports.

## Done Checklist

- [x] Exact Procore General settings captured from the provided live settings page.
- [x] Exact Procore settings captured across all visible settings tabs on the provided live settings page.
- [x] Alleato project `876` settings route reviewed tab-by-tab against the verified Procore settings surface.
- [x] Alleato project `876` settings route updated where it diverges from the verified Procore surface.
- [x] Saved-state read-back or browser proof confirms the Alleato settings route reflects the intended tab-by-tab parity changes.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Procore General capture | `agent-browser --session procore-submittals ...` | PASS | Verified saveable General values and copied exact General tab labels/copy from the live Procore route. |
| Procore all-tabs crawl | `/tmp/procore-submittals-tabs/e15.txt` through `/tmp/procore-submittals-tabs/e21.txt` | PASS | Captured exact visible content for General, Responses, Workflow Templates, Replace Workflow User, Imports, Custom Reports, and Permissions. |
| Alleato all-tabs crawl | `/tmp/alleato-submittals-tabs/e65.txt` through `/tmp/alleato-submittals-tabs/e71.txt` | PASS | Identified non-General tab copy and CTA divergence on the live production route. |
| Changed-file type guard | `cd frontend && npm run typecheck:changed` | PASS | No new changed-file `any` debt introduced by the submittals settings patch. |
| Production verification ledger | `docs/ops/evidence/2026-07-06-submittals-settings-tabs-verification/report.md` | PASS | Fresh-context production verification confirmed the updated content is live across all checked settings tabs with screenshot artifacts. |

## Risks / Gaps

- This patch aligns the settings surface copy and disabled CTA affordances more closely with Procore, but it does not implement the missing backend features behind custom response editing, workflow template creation, or import downloads.
- Non-General tab parity is verified live, but the disabled CTAs still intentionally represent unsupported product capabilities rather than functional feature completion.
