# Task: Restore JobPlanner nightly sync

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: GitHub issue #29
Linear Issue: unavailable; GitHub issue #29 is the supplied source of truth
Related Handoff: `docs/ops/handoffs/2026-07-16-S-jobplanner-nightly-sync-29.md`

## Objective

Restore the scheduled JobPlanner sync so it can authenticate, run the safe
non-financial import and verification workflow, and fail loudly on real data
problems.

## Scope

- GitHub Actions secret configuration and workflow verification for JobPlanner nightly sync.
- Excludes financial imports and unrelated dirty worktree changes.

## Source of Truth

- Canonical runtime owner: `.github/workflows/jobplanner-nightly-sync.yml` and `scripts/jobplanner/nightly-sync.mjs`.
- Existing guardrail: workflow secret validation plus importer and field-by-field verification.
- Deprecated or parallel paths: none in scope.

Verification contract: Required

## Acceptance Criteria

- [x] Required workflow secrets are available to the scheduled job.
- [x] Workflow reaches the sync step and completes successfully, or reports the exact importer/project discrepancy.
- [x] Secret validation remains fail-loud and does not expose secret values.
- [x] Issue #29 receives the run result.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared workflow owner remains responsible for secret validation and sync execution.
- [x] Errors are specific and actionable.
- [x] Provider configuration is applied and read back without exposing values.

## Integration and Verification

- [x] Targeted workflow/static checks pass.
- [x] Actual GitHub Actions run proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing named secret or exact importer/project verification failure.
- Detection path: Validate secrets step and nightly sync run log.
- Recovery path: provision the missing secret through GitHub Actions secret storage, then rerun the workflow.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: missing GitHub Actions repository secrets.
- Detection gap: repository secret presence was not checked after workflow creation.
- Prevention: keep preflight validation and verify repository secret inventory during operational handoff.
- Guardrail evidence: `.github/workflows/jobplanner-nightly-sync.yml` Validate secrets step.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Root-cause localization | `gh run view 29403770794 --log-failed` | PASS | Failed at Validate secrets before importer execution. |
| Secret readback | `gh secret list --repo The-Alleato-Group/project-management` | PASS | Required secret names present; values were not printed. |
| Live workflow | [Run 29553836931](https://github.com/The-Alleato-Group/project-management/actions/runs/29553836931) | PASS | Validate secrets, dependency install, sync, and verification all completed. |
| Sync result | `gh run view 29553836931 --log` | PASS | `ALL 0 PROJECTS SYNCED & VERIFIED ✓`; no current mapped projects were selected. |

## Remaining Risk

- The current run selected zero current mapped projects. Confirm project mappings before relying on this as entity-level coverage.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
