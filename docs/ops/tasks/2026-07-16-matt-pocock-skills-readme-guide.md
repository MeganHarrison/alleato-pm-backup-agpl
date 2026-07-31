# Task: Publish Matt Pocock Skills Guide

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1083
Linear Issue: [AAI-1083](https://linear.app/megankharrison/issue/AAI-1083/document-matt-pocock-skills-for-codex-use)
Related Handoff: `docs/ops/handoffs/2026-07-16-S152-matt-pocock-skills-readme-guide.md`

## Objective

Publish one canonical ReadMe how-to page that explains when and how to use each
Matt Pocock skill available to Codex in this workspace.

## Scope

- Canonical docs owner: `/Users/meganharrison/Documents/alleato-os/apps/docs`.
- New curated guide: `apps/docs/skills/matt-pocock-skills.mdx`.
- Docs navigation: `apps/docs/navigation.config.mjs` and generated `apps/docs/docs.json`.
- Explicitly document this repo's Linear-Codex and verification rules as
  higher-priority overrides to upstream GitHub-oriented workflow defaults.
- Excludes altering any skill instructions or tracker policy.

Verification contract: Required — the published docs route is the requested
user-visible outcome.

## Acceptance Criteria

- [ ] The page gives a clear starting route and an explicit purpose / when-to-use
  entry for every installed Matt Pocock skill.
- [ ] It distinguishes interactive flows from model-invoked reference skills.
- [ ] It names project-specific overrides for tracking, task gates, verification,
  and publishing.
- [x] The page is included in the generated docs navigation and the navigation
  check passes in a clean `origin/main` worktree.
- [ ] A viewable screenshot of the published canonical page is attached to AAI-1083.

## Implementation Checklist

- [x] Canonical ReadMe docs repository and navigation owner identified.
- [x] Existing generated skills reference inspected; it remains the raw source
  reference while this page is the curated how-to guide.
- [x] Guide and navigation entry added through the docs repository's canonical path.
- [x] Docs repository publish boundary committed and pushed with task-owned files only.

## Integration and Verification

- [x] `bun --filter docs nav:check` passes in a clean worktree.
- [x] `bun --filter docs lint` failure is isolated to existing docs debt; the
  new guide is not named in its output.
- [ ] Published page is reachable and screenshot evidence is attached to Linear.
- [x] Handoff and Linear milestone evidence are recorded.

## Failure-Loudly Contract

- Cause surfaced as: native docs navigation/lint failure or unreachable published route.
- Detection path: docs navigation check, docs lint, and published-route browser proof.
- Recovery path: correct the owned guide/navigation file; if external docs-repo dirt
  blocks publish, retain the issue as In Progress with exact Git evidence.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: the guide will point to the raw generated reference and name the
  repo-governance precedence so future skill use cannot silently choose stale defaults.
- Guardrail evidence: native docs nav and link checks.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Canonical docs owner and scope recorded before editing. |
| Linear intake | AAI-1083 | Pass | Issue created before implementation. |
| Docs repo inspection | `git -C /Users/meganharrison/Documents/alleato-os status --short --branch` | Pass | Existing unrelated docs-repo dirt identified and will be preserved. |
| Navigation | `bun --filter docs nav`; `bun --filter docs nav:check` in `/tmp/alleato-os-aai-1083` | Pass | Generated `docs.json` with the new Agent Workflows page; 106 pages. |
| Content coverage | 22-name Node assertion | Pass | Every installed Matt Pocock skill is named in the guide. |
| Native link lint | `bun --filter docs lint` in `/tmp/alleato-os-aai-1083` | Blocked, unrelated | 2,570 pre-existing broken links across 35 files; no `matt-pocock-skills` result. |
| Docs publish | `git push origin HEAD:main` in clean worktree | Pass | Commit `3c0b580` pushed; `HEAD == origin/main`. |
| Canonical-route read-back | `https://meganharrisonconsulting.mintlify.site/skills/matt-pocock-skills` | Blocked | Still returns `Page Not Found` after source push and Vercel proxy deployment; screenshot intentionally not attached because it proves the wrong state. |

## Remaining Risk

- Mintlify has not deployed the source commit to the canonical route. The source
  commit is published, but no viewable canonical-route screenshot exists yet.
- The docs repository has extensive unrelated deletions and changes. The source
  change was published from a clean worktree; leave the dirty checkout untouched.

## Final Status

- [ ] All required checklist items are complete (blocked on Mintlify publication and screenshot evidence).
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
