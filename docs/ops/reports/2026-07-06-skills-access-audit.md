# Skills Access Audit

Date: 2026-07-06

Scope: audit the skills this project/session can see across repo-local, user-local, Claude, Codex, and bundled plugin skill surfaces. This is a registry and routing audit, not a line-by-line semantic review of every skill body.

## Executive Summary

The project has broad skill access, but the surface is noisy. The scan found 737 `SKILL.md` files when bundled plugin caches are included, with 451 unique `name:` values and 155 duplicate skill names. The main operational risk is not missing capability; it is ambiguous routing when the same skill name exists in multiple roots or when a visible slash/menu surface points at a stale or broken symlink.

For Alleato work, repo-local skills should be treated as canonical before generic user or plugin skills. The strongest project-specific surface is:

- `.codex/skills/` for Codex-native BMAD, PRP, RAG, Procore, Clerk, and workflow skills.
- `.agents/skills/` for Alleato design doctrine, Impeccable, Deep Agents, RAG, LangSmith, and web research.
- `.claude/skills/` for older Claude-native project skills, testing skills, Procore verification, and table/detail/page patterns.

## Source Inventory

| Source | `SKILL.md` count | Notes |
| --- | ---: | --- |
| `./.codex/skills` | 103 | Primary repo Codex skill surface; includes BMAD, PRP, RAG, Procore, Clerk, and symlinks to selected Claude/project skills. |
| `./.agents/skills` | 12 | Project-specific agent skills; includes Impeccable, Alleato design doctrine, Deep Agents, RAG, LangSmith, and web research. |
| `./.claude/skills` | 23 | Older repo-local Claude skill surface; still important for verify-feature, Procore/table/detail/testing skills. |
| `~/.codex/skills` | 43 direct `SKILL.md` files | Many entries are symlinks to `~/.agents/skills` or repo skills; this affects slash/menu discoverability. |
| `~/.agents/skills` | 141 | Broad user skill library; useful but lower precedence than repo-specific guidance. |
| `~/.claude/skills` | 10 direct `SKILL.md` files | Mostly symlink-heavy; several broken symlinks found. |
| `~/.codex/plugins/cache` | 405 | Bundled/plugin skills; includes many duplicate package versions and should be treated as provider/plugin capability, not project policy. |

## Primary Findings

1. Skill access is abundant, but duplicate names create ambiguity.

   Across all scanned roots there are 155 duplicate skill names. High-duplication examples include `ai-sdk`, `next-forge`, `shadcn`, `agent-browser`, `gh-address-comments`, `gh-fix-ci`, `linear`, `build-with-agent-team`, `e2e-test`, `extract-design-system`, `rag-implementation`, and several Clerk skills.

2. Repo-local policy should outrank generic skills.

   For Alleato work, use repo-local `.codex/skills`, `.agents/skills`, and `.claude/skills` first. User/global skills are useful for implementation technique, but they should not override `AGENTS.md`, Alleato design doctrine, Impeccable noise gates, Supabase gates, Render/Vercel ownership rules, or the repo testing process.

3. Broken symlinks existed in user discovery surfaces.

   Broken symlinks found during the audit:

   - `~/.codex/skills/test-scenario-run` -> missing repo target `./.claude/skills/testing/test-scenario-run`
   - `~/.codex/skills/web-design-reviewer`
   - `~/.codex/skills/local-action-verification`
   - `~/.codex/skills/audit`
   - `~/.agents/skills/agentation-self-driving/agentation-self-driving`
   - `~/.claude/skills/impeccable`
   - `~/.claude/skills/web-design-reviewer`
   - `~/.claude/skills/local-action-verification`
   - `~/.claude/skills/code-review-excellence`
   - `~/.claude/skills/audit`

   Follow-up cleanup removed the stale links with no live target, relinked `~/.claude/skills/impeccable` to the repo-local canonical Impeccable skill, and removed a stale nested `agentation-self-driving` internal symlink. A repeat scan of the repo/user skill roots returned no broken symlinks.

4. Several repo-local skills have weak metadata.

   Many repo `.claude/skills` entries have one-character descriptions, and several `.codex/skills` BMAD/project skills have very short descriptions. This weakens discovery and makes the skill list harder to route from. Examples include `procore-docs-rag`, `smoke-test`, `repeatable-training-docs`, `parity-audit`, `procore-verify`, `alleato-table-page`, `fk-audit`, and several BMAD agent wrappers.

5. Design guidance has too many overlapping entries unless Impeccable is treated as canonical.

   Design-related skill names include `impeccable`, `alleato-design-doctrine`, `premium-frontend-design`, `interface-design`, `frontend-responsive-design-standards`, `web-design-guidelines`, `design-md`, `extract-design-system`, `building-components`, and plugin skills such as `shadcn` and `react-best-practices`. The project memory and current `AGENTS.md` both point to Impeccable/Alleato product noise gate as the canonical first pass.

6. Testing guidance is split across strategy, browser primitives, and scenario skills.

   Canonical project verification should start with `verify-feature` and `agent-browser` for user-flow proof, then use `e2e-test`, `smoke-test`, `procore-verify`, `procore-test-matrix`, or BMAD/TEA testing skills when the task needs formal regression coverage. The broken `test-scenario-run` symlink should be repaired or removed because it suggests a dispatcher that currently does not resolve.

7. AI/RAG/agent work has enough specialized skills, but routing needs to be explicit.

   Relevant skills include `alleato-rag-implementation`, `rag-implementation`, `rag-strategy-council`, `rag-stats`, `procore-docs-rag`, `deep-agents-core`, `deep-agents-orchestration`, `deep-agents-backend-module`, `deep-agents-memory`, `langsmith-*`, `ai-sdk`, and `ai-elements`. For AI SDK work, the user-level instruction requires the AISDK skill. For Alleato RAG, repo RAG skills should precede generic AI SDK guidance unless the task is specifically AI SDK implementation.

## Recommended Canonical Routing

Use this precedence for future tasks:

1. Project law: `AGENTS.md`, repo docs, and task-specific instructions.
2. Named skill from the user, if present and installed.
3. Repo-local domain skill:
   - Frontend/design: `impeccable`, `alleato-design-doctrine`, then `frontend-responsive-design-standards` or `building-components`.
   - User-flow verification: `verify-feature`, `agent-browser`, then `e2e-test` or `smoke-test`.
   - Procore parity: `procore-verify`, `procore-test-matrix`, `procore-docs-rag`, `parity-audit`, `fk-audit`.
   - RAG/AI: `alleato-rag-implementation`, `rag-implementation`, `rag-strategy-council`, `deep-agents-*`, `langsmith-*`, and `ai-sdk` when AI SDK implementation is involved.
   - Planning/spec: BMAD workflow/agent skills and `prp-execute`/`prp-quality`.
4. User-global implementation skills, such as Clerk, Supabase, Vercel, AI SDK, docs, or design system skills.
5. Plugin-provided skills and connectors for current external capability.

## Cleanup Backlog

1. Fix or remove broken discovery symlinks.

   Highest priority: `~/.codex/skills/test-scenario-run`, because past memory says testing slash discovery has already caused confusion. Either restore `./.claude/skills/testing/test-scenario-run` or remove the stale symlink and point users to `verify-feature`, `agent-browser`, and `e2e-test`.

2. Add real descriptions to weak repo-local skills.

   Focus first on skills users or agents are likely to invoke by name: `verify-feature`, `procore-verify`, `procore-test-matrix`, `procore-docs-rag`, `alleato-table-page`, `fk-audit`, `parity-audit`, `smoke-test`, and `repeatable-training-docs`.

3. Create a canonical skills map.

   Added `docs/ops/skills-routing.md` as the canonical routing map for recurring Alleato workflows: frontend noise gate, user-flow verification, Procore parity, RAG, AI SDK, BMAD planning, PRP, and docs capture.

4. Reduce design-skill ambiguity.

   Keep `impeccable` plus `alleato-design-doctrine` as canonical for Alleato UI/product noise. Treat generic design skills as implementation references only.

5. Separate plugin cache from project policy.

   Plugin cache contributes a lot of duplicate names and package versions. It should be documented as available external capability, not as part of the Alleato project skill canon.

## Failure-Loudly Guardrail

Before invoking a skill by inferred name, future agents should verify:

- the exact `name:` field,
- the exact `SKILL.md` path,
- whether the skill is repo-local, user-global, symlinked, or plugin-provided,
- whether the path resolves if it is a symlink,
- and whether a higher-priority Alleato-specific skill owns the workflow.

This prevents the recurring failure where a plausible skill name is treated as installed or canonical without checking the actual discovery surface.
