# Task: Outlook draft feedback emails parity

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-30
Linear Issue: Not created - available Linear connector exposes comment tools but no issue creation/update-state tool in this session.
Related Handoff: N/A

## Objective

Make `/outlook-draft-feedback` use the same global Emails page format while showing Brandon Clymer's Outlook mailbox rows.

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
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `npm run lint:changed:debt -- --files ...` from `frontend/`; `npm run typecheck:changed -- --files ...` from `frontend/`; `git diff --check -- ...` | Pass | No new ESLint debt; no new `any` type debt; no whitespace errors. Root-level lint invocation failed because the script only exists in `frontend/package.json`. |
| Targeted tests        | `npm run test:unit -- --runInBand --runTestsByPath 'src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts' 'src/app/api/emails/__tests__/route.test.ts' 'src/app/api/email-assistant/reviews/__tests__/route.test.ts'` | Pass | 3 suites, 7 tests passed. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/outlook-draft-feedback`; Playwright with `frontend/config/.auth/user.json` | Blocked/Deferred | Both attempts redirected to `/auth/login?callbackUrl=%2Foutlook-draft-feedback`; saved auth state is stale. Screenshot: `.codex-artifacts/outlook-draft-feedback/login-redirect.png`. |
| DB/provider read-back | Read-only Supabase query from `frontend/` against `outlook_email_intake` filtered to `mailbox_user_id='bclymer@alleatogroup.com'` | Pass | 851 Brandon mailbox rows found; 3-row sample all had Brandon mailbox ID. Newest sampled `received_at`: `2026-06-17T13:29:08+00:00`. No schema, migration, or provider config changes. |
| End-to-end proof      | Same as browser/user-flow | Blocked/Deferred | Cause: no fresh authenticated browser session available. Detection gap: saved auth state existed but was stale. Prevention step: refresh the local auth fixture before authenticated route visual checks. |

## Files Changed

- `frontend/src/app/(admin)/outlook-draft-feedback/page.tsx` - render the same global Emails surface for Brandon's mailbox.
- `frontend/src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts` - guard the route contract.
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx` - pass mailbox scope to the shared global email hook.
- `frontend/src/hooks/use-emails.ts` - add optional mailbox scope to global email fetching.
- `frontend/src/app/api/emails/route.ts` - filter the live Outlook intake source by mailbox when requested.
- `frontend/src/app/api/emails/__tests__/route.test.ts` - prove the mailbox filter applies to the live intake query.
- `frontend/src/features/emails/project-emails-workspace.tsx` - add reusable assistant-feedback details panel mode for categorization, rule evidence, review ledger, and draft display.
- `frontend/src/app/api/email-assistant/reviews/route.ts` - expose latest assistant review rows through a read-only guarded API.
- `frontend/src/app/api/email-assistant/reviews/__tests__/route.test.ts` - prove latest-review mapping and non-admin mailbox scoping.

## Risks / Gaps

- Authenticated browser proof is deferred because the available browser and Playwright auth states redirect to login.
- Brandon mailbox source freshness may need separate investigation if newer-than-2026-06-17 mail is expected in `outlook_email_intake`.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
