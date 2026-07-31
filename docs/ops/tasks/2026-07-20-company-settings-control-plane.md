# Task: Company Settings Control Plane

Status: In Progress
Owner: Codex
Created: 2026-07-20
Task ID: AAI-1197
Linear Issue: [AAI-1197 Company Settings: build governed configuration control plane](https://linear.app/megankharrison/issue/AAI-1197/company-settings-build-governed-configuration-control-plane)
Related Handoff: Pending session-board claim.

## Objective

Provide a company-wide settings control plane at `/company-settings` that routes administrators to canonical configuration owners and establishes safe, consistent configuration management patterns.

## Scope

- Add the `/company-settings` admin route and canonical navigation entry.
- Create a settings workbench that groups configuration by Access & Organization, Directory Catalogs, Meetings, Financial Codebooks, and Workflow Policy.
- Reuse canonical owners for User Management, permission templates, Meeting Templates, company/directory data, and cost-code data rather than duplicating CRUD or making an unrestricted database editor.
- Establish a durable configuration registry and safety contract for add, rename, archive, order, merge, where-used, and project-override behavior.
- Exclude arbitrary editing of system workflow states and direct database mutations without a validated owner/API contract.

## Source of Truth

- Canonical runtime/data owner: existing admin routes and their APIs, including `/user-management`, `/meeting-templates`, `/api/permissions/**`, `/api/admin/meeting-templates/**`, and their domain data owners.
- Existing shared primitives/services: `frontend/src/components/layout`, `frontend/src/components/tables/unified`, `frontend/src/lib/navigation-config.ts`.
- Deprecated or parallel paths: a generic page-local database editor is explicitly prohibited.

Verification contract: Required

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: settings that cannot be retired show their dependent record count and the named configuration owner; unauthorized access uses the standard admin access state.
- Detection path: route-level authorization, configuration-registry tests, and browser evidence of archive/where-used states.
- Recovery path: open the owning configuration surface or resolve dependent records before attempting archive.

## Incident Learning

- Failure fingerprint: authenticated `is_admin` user redirected with `reason=admin-dashboard-allowlist`.
- Root cause: the `(admin)` layout, Meeting Templates pages, and `/api/admin` middleware disagreed on access model; the middleware did not parse the signed app-admin claim and blocked the API before its `requireAppAdmin` handler ran.
- Detection gap: the page-level guard was tested in isolation; the enclosing layout and edge-middleware access boundaries were not covered.
- Prevention: `frontend/src/lib/auth/admin-page-access.ts` owns page/API access prefixes, while `auth-cookie.test.ts` proves the parser accepts signed app metadata and ignores user-editable metadata.
- Guardrail evidence: focused Jest suite passed 4 suites / 8 tests; authenticated browser proof for both the workbench and Meeting Templates owner is attached to AAI-1197.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Design preflight | `node .agents/skills/impeccable/scripts/load-context.mjs` | Passed | PRODUCT.md and DESIGN.md are present. |
| Design brief | User approval in this Codex task | Passed | Shape approved on 2026-07-20. |
| Visual direction | `/Users/meganharrison/.codex/generated_images/019f76e4-8517-73e3-aa50-60cfeb06c267/exec-017816ef-1c46-45aa-bdfe-54784b0da9c2.png` | Passed | Restrained two-column settings workbench selected. |
| Linear ownership | Linear plugin `get_user("me")` and issue creation | Passed | Authenticated as Megan Harrison; AAI-1197 created in Alleato AI. |
| Targeted lint | `pnpm exec eslint src/app/(admin)/company-settings/page.tsx src/app/(admin)/company-settings/company-settings-client.tsx src/lib/company-settings/registry.ts src/lib/company-settings/__tests__/registry.test.ts src/lib/navigation-config.ts` | Passed | No warnings or errors after shared primitive fixes. |
| Registry guardrail | `pnpm exec jest src/lib/company-settings/__tests__/registry.test.ts --runInBand` | Passed | Available entries require canonical routes; protected entries require a reason. |
| Settings interaction | `pnpm exec jest --runTestsByPath 'src/app/(admin)/company-settings/__tests__/company-settings-client.test.tsx' 'src/lib/company-settings/__tests__/registry.test.ts' --runInBand` | Passed | Category navigation changes content without exposing protected entries as editable. |
| Route guardrail | `npm run check:routes` | Passed | No dynamic route conflicts. |
| Noise gate | `audit-surface-complexity.mjs` and `audit-split-page-consistency.mjs` | Passed | No nested-card, wrapper, or split-page violations. |
| Browser route | `agent-browser auth login alleato-test`, then `agent-browser open http://localhost:3000/company-settings` | Passed | Authenticated `test1@mail.com` loaded the canonical route. Desktop and mobile Meetings-state screenshots are attached and embedded in Linear comment `52881e82-f63e-4466-93ab-b7ae49306fa1`. |
| Shared access-model guardrail | `pnpm exec jest --runTestsByPath 'src/lib/auth/__tests__/admin-page-access.test.ts' --runInBand` | Passed | `/company-settings` uses the `is_admin` access model while unrelated Admin Dashboard routes retain their narrow allowlist. |
| Canonical owner handoff | `agent-browser open http://localhost:3000/meeting-templates` | Passed | The authenticated app-admin route exposed the Meeting Templates table and `New Template` action. Screenshot attached and embedded in Linear comment `ca2db933-4931-4403-8d04-da94daaa0591`. |
| Connected access guardrails | Focused Company Settings, registry, access-model, and auth-cookie Jest suites | Passed | 4 suites / 8 tests pass; Meeting Templates API route tests additionally pass 17 tests for `is_admin` authorization and failure states. |

## Remaining Risk

- The first database-backed catalog needs a separate typed contract and consumer integration. Owner: AAI-1200. Next action: define and apply the meeting-type catalog migration only after its canonical consumer is selected.
- The orchestration board currently has unrelated unresolved merge conflicts. Owner: active sessions that own the conflicted entries. Next action: create the required worker claim and handoff once the board is writable without resolving unrelated work.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
