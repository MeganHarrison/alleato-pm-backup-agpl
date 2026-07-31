---
name: prp-execute
description: Execute a completed PRP to implement a feature with progressive validation.
---

# PRP Execute

Use this skill when the user asks to execute, implement, or build from a completed PRP.

## Input

Expected argument:

```text
<path/to/prp.md>
```

Examples:

```text
docs/PRPs/submittals/prp-submittals.md
docs/PRPs/alleato-ai-intelligence-system/prp-alleato-ai-intelligence-system.md
```

## Mission

Transform the PRP into working code that passes the validation gates defined by the PRP and the repository rules.

PRPs are intended to provide:

- Complete implementation context
- Ordered implementation tasks
- Known pitfalls and prevention rules
- Validation commands and success criteria
- Existing code patterns to follow

## Required Process

1. Load the PRP completely.
2. Load companion files if present next to the PRP:
   - `AUDIT.md`
   - `TASKS.md`
   - `TEST-SCENARIOS.md`
   - `VALIDATION-REPORT.md`
3. Read repository instructions before coding:
   - `AGENTS.md`
   - Relevant nested `AGENTS.md` files for touched paths
4. Create an implementation plan from the PRP task order.
5. Verify referenced codebase patterns before editing.
6. Implement the PRP tasks in dependency order.
7. Update `TASKS.md` or the handoff evidence when task state changes.
8. Run short targeted checks in the main thread.
9. Delegate long-running verification to a cheaper verification sub-agent when available.
10. Final response must include:
   - What is done
   - What remains
   - Recommended next steps

## Supabase Gate

Before writing database code, migrations, RLS, Supabase API routes, or Supabase queries:

1. Generate fresh Supabase types:

```bash
npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts
```

2. Read `frontend/src/types/database.types.ts`.
3. Verify table, column, nullable, primary-key, and foreign-key types.
4. Confirm `projects.id` is treated as an integer, not a UUID.
5. Apply and verify any migration created or changed during execution.

## Validation Gates

Follow the PRP validation section first. If it is incomplete, use this default order:

1. Type and lint checks for touched areas.
2. Unit tests for changed components, hooks, or services.
3. Targeted API or route checks for changed endpoints.
4. Browser verification for user-visible workflows.
5. Full build, full predeploy, or long suites only through delegated verification unless the user asks to wait.

Each failed gate must be handled with:

- Cause
- Detection gap
- Prevention step
- Owner file(s)
- Whether it is related to the PRP task or unrelated repo debt

## Failure Rules

- Do not ship silent failures.
- Do not replace a specific error with a generic one.
- Do not guess around missing schema or route context.
- Do not mark a PRP task complete without evidence.
- Do not claim a migration-backed fix is done unless the migration is applied or explicitly deferred with the reason.

## Source Command

This skill mirrors the repo-local Claude slash command:

```text
.claude/commands/prp/prp-execute.md
```
