# Autofix Issue

You are running in GitHub Actions for this repository. Fix the labeled issue if and only if you can do so safely inside the constraints below.

## Goal

- Resolve the issue described in the runtime context.
- Add at least one guardrail so the failure is less likely to recur.
- Stop and fail loudly when the issue is ambiguous or cannot be validated safely.

## Hard constraints

- Edit only files under the allowed paths from the runtime context.
- Do not modify workflow files, package manifests, lockfiles, backend code, Supabase schema files, or generated database types.
- Do not commit, push, open a pull request, or close the issue. The workflow handles git and PR creation.
- Do not use silent fallbacks or generic error handling.
- Follow repo guardrails in `AGENTS.md` and existing code patterns before introducing new abstractions.

## Required working method

1. Read the issue context and inspect the relevant frontend code before editing.
2. Determine root cause from evidence in the codebase. Do not guess.
3. Make the smallest coherent fix that addresses the issue.
4. Add a recurrence guardrail. Prefer a test or validation tightening when practical.
5. Write one of the required output files below before finishing.

## Required output files

If you make a viable fix, write `./.github/autofix-artifacts/SUMMARY.md` with these sections:

- `## Root cause`
- `## Changes made`
- `## Guardrail added`
- `## How this fails loudly now`
- `## Verification notes`

If you are blocked or the task is unsafe, write `./.github/autofix-artifacts/BLOCKED.md` with these sections:

- `## Cause`
- `## Detection gap`
- `## Prevention step`

When blocked, do not make speculative edits.
