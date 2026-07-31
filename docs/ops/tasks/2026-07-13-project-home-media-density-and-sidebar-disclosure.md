# Task: Refine project home media density and sidebar disclosure

Status: In Progress
Owner: Codex
Created: 2026-07-13
Task ID: AAI-1060
Linear Issue: AAI-1060 — https://linear.app/megankharrison/issue/AAI-1060/refine-projectidhome-layout-aireporting-density-media-hover-and
Related Handoff: `N/A (single-session work)`

## Objective

Make `/67/home` read as a clearer command-center surface by widening the main layout, simplifying progress-report labeling, improving meetings/documents/photos presentation, and making subcontractor overflow explicit.

## Scope

- `frontend/src/app/(main)/[projectId]/home/project-home-command-center-v2.tsx`
- Shared project-home sidebar/media primitives only when needed for reuse
- Exact exclusions: unrelated home-page finance, AI insights copy, and comment-system work

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/[projectId]/home/project-home-command-center-v2.tsx`
- Existing shared primitives/services: `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx`, design-system primitives in `frontend/src/components/ui/*`
- Deprecated or parallel paths: `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx` older home surface remains out of scope unless a shared sidebar primitive must be improved there too

## Acceptance Criteria

- [ ] Requested behavior is observable end to end.
- [ ] Failure-loudly behavior is defined.
- [ ] Relevant existing guardrails are identified before implementation.
- [ ] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [ ] Files/modules to change are listed before edits.
- [ ] Shared abstraction owns cross-cutting behavior.
- [ ] Errors are specific and actionable.
- [ ] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned files/modules planned before edits:

- `frontend/src/app/(main)/[projectId]/home/project-home-command-center-v2.tsx`
- `frontend/src/app/(main)/[projectId]/home/project-command-center.tsx` if subcontractor sidebar behavior is shared there
- Shared media/lightbox primitive only if needed after inspection

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: Missing preview/lightbox affordance or truncated overflow without disclosure on `/67/home`
- Detection path: Local browser proof on `/67/home` plus targeted UI audit/lint commands
- Recovery path: Adjust the exact home-surface section or shared primitive and re-run targeted browser proof

## Incident Learning

Use `N/A` only for work that did not discover or address a failure. Significant
bugs and repeated problems must reference an ID in
`docs/ops/learning/recurring-failures.yaml`.

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

Before creating a new fingerprint, search existing lessons:

```bash
node scripts/ops/learning-registry.mjs lookup --symptom "<symptom>" --files <owned-paths>
```

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Linear kickoff | AAI-1060 comment | Pass | Kickoff scope and verification plan posted before implementation. |
| Surface audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs 'frontend/src/app/(main)/[projectId]/home/project-home-command-center-v2.tsx' 'frontend/src/app/(main)/[projectId]/home/project-command-center.tsx'` | Pass | Both changed home files passed the Alleato surface audit. |
| Targeted lint | `cd frontend && npx eslint 'src/app/(main)/[projectId]/home/project-home-command-center-v2.tsx' 'src/app/(main)/[projectId]/home/project-command-center.tsx' --cache --cache-strategy content` | Pass with unrelated warnings | Existing `no-raw-detail-field` warnings remain in `project-command-center.tsx` at lines 1745/1753/1754, unrelated to this slice. |
| Diff hygiene | `git diff --check -- 'frontend/src/app/(main)/[projectId]/home/project-home-command-center-v2.tsx' 'frontend/src/app/(main)/[projectId]/home/project-command-center.tsx' 'docs/ops/tasks/2026-07-13-project-home-media-density-and-sidebar-disclosure.md'` | Pass | No whitespace or patch-format issues. |
| Browser proof | `AGENT_BROWSER_DEFAULT_TIMEOUT=60000 agent-browser --state frontend/tests/.auth/user.json open 'http://localhost:3001/67/home' && ...` | Pass | Agent-browser stayed on `http://localhost:3001/67/home`, captured the exact route screenshot, and exposed the updated section controls/links in the snapshot output. |
| Browser artifact | `docs/ops/evidence/2026-07-13-home-media-density-and-sidebar-disclosure.png` | Pass | Exact `/67/home` page screenshot from agent-browser. |
| Document hover proof | `agent-browser hover @e76` + screenshot | Pass | Hover preview opened on the document row. Artifact: `docs/ops/evidence/2026-07-13-home-document-hover-preview.png`. |
| Photo lightbox proof | `agent-browser click @e84` + screenshot | Pass | Photo opened in an in-page lightbox instead of navigating away. Artifact: `docs/ops/evidence/2026-07-13-home-photo-lightbox.png`. |

## Remaining Risk

- The document hover preview falls back to a textual “Preview unavailable for this file type” state for non-previewable files, which is acceptable but means preview richness still depends on source file type and URL accessibility.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
