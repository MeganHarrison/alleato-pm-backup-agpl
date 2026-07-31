# Brandon Architecture Center

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1085
Linear Issue: [AAI-1085](https://linear.app/megankharrison/issue/AAI-1085/publish-brandon-facing-architecture-center-on-docs-site)
Related Handoff: `docs/ops/handoffs/2026-07-16-S-brandon-architecture-center.md`

## Objective

Publish a concise, Brandon-facing Architecture Center in the Alleato OS docs site that explains product architecture, codebase navigation, and AI ownership without duplicating technical source-of-truth documents.

## Scope

- Add `overview`, `codebase-map`, and `ai-platform` pages to the Alleato OS docs site.
- Add one Architecture Center navigation group.
- Link each page to the detailed, maintained source documents in `project-management`.
- Exclude the thin in-app architecture launch page and all unrelated existing docs-site changes.

## Source of Truth

- Product/runtime ownership: `docs/architecture/ALLEATO-SYSTEM-MAP.md`.
- AI agent/runtime architecture: `docs/architecture/AI-RAG-ARCHITECTURE.md`.
- Generated technical inventory: `docs/architecture/SYSTEM-MAP.md` and `docs/architecture/PROJECT-MAP.md`.
- Database semantics: `docs/architecture/tables.yaml`.

Verification contract: Required

## Acceptance Criteria

- [x] Brandon can open a single docs-site group and understand the platform, codebase map, and AI architecture.
- [x] Each page distinguishes presentation guidance from generated/source-of-truth artifacts.
- [x] Navigation contains only task-owned Architecture Center entries.
- [x] A rendered docs artifact and independent verification are recorded.

## Implementation Checklist

- [x] Create the three MDX pages under `apps/docs/architecture/`.
- [x] Add the Architecture Center group to `apps/docs/docs.json`.
- [x] Preserve unrelated docs-site deletions and modifications.
- [x] Add specific source links and maintenance commands.

## Integration and Verification

- [x] Task-owned docs navigation and page validation passes.
- [x] Touched pages pass targeted Markdown/MDX validation.
- [x] Rendered evidence artifact is recorded.
- [x] Independent review is recorded.
- [x] Task-owned files are published and local `HEAD` equals `origin/main` in both repositories.

## Failure-Loudly Contract

- Cause surfaced as: missing navigation entry, invalid MDX, or stale generated source link.
- Detection path: docs navigation check and the page-level evidence artifact.
- Recovery path: update the page/nav source, re-run validation, and republish only task-owned docs files.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Use a single docs-site group that links back to the generated source documents rather than hand-maintained duplicates.
- Guardrail evidence: Pending.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear kickoff | AAI-1085 | Pass | Task created before docs implementation. |
| Task setup | This task file | Pass | Scope and source boundaries recorded before implementation. |
| Targeted structure validation | Docs frontmatter/internal-link/navigation script | Pass | All three architecture pages and the Architecture Center group are present and ordered. |
| Docs preview | `http://localhost:3004/architecture/overview` | Pass | Architecture Overview rendered; the two companion routes returned their expected titles. |
| Viewable artifact | `docs/ops/evidence/2026-07-16-brandon-architecture-center/architecture-overview.png` | Pass | Screenshot captured from the local Mintlify route. |
| Full docs navigation check | `npm run nav:check` in `alleato-os/apps/docs` | Blocked/Unrelated | Existing missing/deleted help, integration, estimate, and training-doc pages fail the global check before task-owned pages can be evaluated. |
| Independent review | `docs/ops/evidence/2026-07-16-brandon-architecture-center/independent-review.md` | Pass | Content, source grounding, navigation, and visual artifact approved. |
| Verification contract | `docs/ops/evidence/2026-07-16-brandon-architecture-center/verification-result.json` | Pass | Contract passed with all declared artifact hashes present. |
| Docs-site publication | Alleato OS commit `dff1876711342f5752e2b815ae60409909ab4141` | Pass | Local `HEAD` equals `origin/main`; only the three pages and Architecture Center navigation hunk were committed. |
| Completion comment | `docs/ops/evidence/2026-07-16-brandon-architecture-center/TASK-COMMENT.md` | Pass | Durable task comment includes the viewable rendered screenshot. |

## Remaining Risk

- The docs site currently contains unrelated deletions/modifications. This task must stage only the architecture pages and the navigation hunk.
- The global navigation check remains blocked by existing missing/deleted non-task pages. It is detected by `npm run nav:check`; the owning docs-maintenance work must restore or remove those references before the global gate can pass.
- A preserved Alleato OS stash contains a pre-existing local version of `apps/docs/skills/matt-pocock-skills.mdx` that conflicted with the remote version during restoration. It is intentionally retained as `stash@{0}` for its owner to reconcile; it does not affect the published Architecture Center commit.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work names cause, detection gap, prevention, owner, and next action.
