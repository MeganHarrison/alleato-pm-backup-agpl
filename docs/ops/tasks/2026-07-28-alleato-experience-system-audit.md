# Task: Alleato Experience System Audit and Command

Status: Complete
Owner: Codex
Created: 2026-07-28
Task ID: local-design-system-audit
Linear Issue: N/A — Standard single-session documentation/skill change
Related Handoff: N/A

## Objective

Publish a slash-command-accessible Alleato Experience System that reconciles the strongest existing design guidance, makes contradictory authorities explicit, and prevents single-pass or ban-based redesign failures through visual calibration and rendered iteration.

## Scope

- `.claude/skills/alleato-experience-system/**`
- `.claude/commands/alleato-experience-system.md`
- `.agents/skills/source-command-alleato-experience-system/SKILL.md`
- `docs/ops/skills-routing.md`
- `docs/ops/reports/2026-07-28-design-skill-authority-audit.md`
- Explicit exclusion: product UI code and broad retirement of legacy documents

## Source of Truth

- Canonical runtime/data owner: repository skill discovery and command routing
- Existing shared primitives/services: `AGENTS.md`, `.agents/skills/impeccable`, `.agents/skills/alleato-design-doctrine`
- Deprecated or parallel paths: root `DESIGN.md`, generic cinematic design skills, stale table/design gates identified in the audit

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Requested behavior is represented by a discoverable skill and slash command.
- [x] Failure-loudly behavior is defined through an explicit usability and completion gate.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are classified and explicitly deferred in the audit.
- [x] A real failed design artifact is diagnosed and converted into reusable workflow guardrails.
- [x] Visual redesigns require calibrated targets, structural cleanliness, and screenshot iteration.
- [x] `gpt-taste`, `design-taste-frontend`, and `design-taste-frontend-v1` are audited and routed.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting design behavior.
- [x] Errors and review findings require specific, actionable evidence.
- [x] Database, provider, authentication, permission, or delivery contracts are N/A.

## Integration and Verification

- [x] Taste-adapter skill structure and references validate.
- [x] Updated design routing explicitly classifies all three taste skills.
- [x] Resource Library desktop/mobile evidence and case study are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and the exact task paths match `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing skill/command, unresolved reference, or contradictory authority is named explicitly.
- Detection path: skill validator, path-resolution checks, and audit report.
- Recovery path: correct the canonical skill or routing map rather than adding another competing design document.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The Experience System was untracked and multiple design documents competed without a clear authority model.
- Detection gap: Skill discovery did not test repo-local Claude skills or contradictory design instructions.
- Prevention: A canonical routing map, slash command, compatibility skill, and explicit authority stack.
- Guardrail evidence: `docs/ops/skills-routing.md` and the audit report.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Canonical skill validation | `quick_validate.py .claude/skills/alleato-experience-system` | Pass | `Skill is valid!` using a temporary PyYAML dependency because the bundled validator environment omitted it. |
| Compatibility skill validation | `quick_validate.py .agents/skills/source-command-alleato-experience-system` | Pass | `Skill is valid!` |
| Command/reference check | YAML parse plus local Markdown link and `$ARGUMENTS` assertions | Pass | All references resolve; command delegates to the canonical skill. |
| Whitespace check | `git diff --check` | Pass | No patch whitespace errors. |
| Publication | `npm run codex:finish -- --session Sdesign-system-audit --allow-staged --message "Publish Alleato Experience System" --files …` | Pass | Published to `origin/main` at `700c76db`; post-fetch path-scoped diff is empty. |
| Failed-design baseline | Original FireShot screenshot plus current HTML desktop/mobile renders | Pass | Confirmed noisy card-grid and flat override failure modes. |
| Updated canonical skill | `quick_validate.py .claude/skills/alleato-experience-system` | Pass | Calibration and visual-iteration workflow validates. |
| Updated compatibility skill | `quick_validate.py .agents/skills/source-command-alleato-experience-system` | Pass | Slash compatibility entrypoint validates. |
| Deterministic design scan | `npx impeccable --json alleato-resource-library.html` | Findings | 14 warnings; useful stale-style/accessibility detections plus documented product-context false positives. |
| Visual workflow calibration | Resource Library six-line target in audit report | Pass | Converted vague premium/modern/minimal feedback into observable criteria. |
| Visual-quality iteration publication | `npm run codex:finish -- --session Sdesign-system-audit --message "Add visual design quality workflow" --files …` | Pass | Exact task-owned paths published through the remote main publisher. |
| Taste-skill audit | Full reads of `gpt-taste`, `design-taste-frontend`, and `design-taste-frontend-v1` | Pass | Scope, conflicts, reusable guidance, and discovery collision documented. |
| Taste-adapter validation | Skill validators plus local-link, whitespace, EOF, audit, and routing assertions | Pass | All taste sources are classified and selected v2 ideas are incorporated. |
| Taste-audit publication | `npm run codex:finish -- --session Sdesign-system-audit --message "Audit frontend taste skills" --files …` | Pass | Exact task-owned paths published through the remote main publisher. |

## Remaining Risk

- The Resource Library HTML is owned by a separate active workspace and was not edited. This iteration improves the reusable design workflow rather than claiming the example page itself is fixed.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
