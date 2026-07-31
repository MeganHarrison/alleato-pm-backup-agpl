# Alleato Skills Routing

Date: 2026-07-06

Purpose: give future Codex and Claude sessions one practical routing map for choosing skills in this repo. This is the operational companion to `docs/ops/reports/2026-07-06-skills-access-audit.md`.

## Precedence

Use skills in this order:

1. `AGENTS.md`, repo docs, current user instructions, and task files.
2. A skill explicitly named by the user, after verifying its exact `name:` and `SKILL.md` path.
3. Repo-local Alleato skills under `.codex/skills`, `.agents/skills`, and `.claude/skills`.
4. User-global skills under `~/.codex/skills`, `~/.agents/skills`, or `~/.claude/skills`.
5. Plugin-provided skills and MCP/app tools.

If a generic user-global skill conflicts with an Alleato-specific skill, the Alleato-specific skill wins.

## Canonical Routes

| Work type                                                                           | Start with                                         | Then use when needed                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New implementation, bug fix, audit finding, or verification-only task               | `.codex/skills/qa-task`                            | `.claude/skills/verify-feature`, `.codex/skills/agent-browser`, domain-specific skills, and the verification contract                                                                                          |
| New frontend experience, page redesign, or UX architecture                          | `.claude/skills/alleato-experience-system`         | `.agents/skills/impeccable` for the required noise/refinement pass, `.codex/skills/frontend-conversation-feedback`, `.codex/skills/frontend-responsive-design-standards`, `.claude/skills/building-components` |
| Focused visual polish or product-noise review                                       | `.agents/skills/impeccable`                        | `.claude/skills/alleato-experience-system` when the problem requires a new page archetype, information architecture, or interaction model                                                                      |
| Table/list page work                                                                | `.claude/skills/alleato-table-page`                | `.codex/skills/verify-feature`, `.claude/skills/testing/agent-browser`                                                                                                                                         |
| User-visible feature verification                                                   | `.claude/skills/verify-feature`                    | `.claude/skills/testing/agent-browser`, `.codex/skills/e2e-test`, `.codex/skills/smoke-test`                                                                                                                   |
| Procore behavior or parity                                                          | `.claude/skills/procore-verify`                    | `.claude/skills/procore-test-matrix`, `.codex/skills/procore-docs-rag`, `.codex/skills/parity-audit`                                                                                                           |
| Form dropdown or FK mismatch                                                        | `.claude/skills/fk-audit`                          | Supabase generated types and route/browser proof                                                                                                                                                               |
| RAG strategy or implementation                                                      | `.codex/skills/alleato-rag-implementation`         | `.agents/skills/rag-implementation`, `.codex/skills/rag-strategy-council`, `.codex/skills/rag-stats`, `.codex/skills/procore-docs-rag`                                                                         |
| Deep agent/backend orchestration                                                    | `.agents/skills/deep-agents-core`                  | `.agents/skills/deep-agents-orchestration`, `.agents/skills/deep-agents-backend-module`, `.agents/skills/deep-agents-memory`                                                                                   |
| AI SDK implementation                                                               | `~/.agents/skills/ai-sdk`                          | `~/.agents/skills/ai-elements`, repo AI/RAG skills if the task touches Alleato retrieval                                                                                                                       |
| Evaluation or tracing                                                               | `.agents/skills/langsmith-evaluator`               | `.agents/skills/langsmith-dataset`, `.agents/skills/langsmith-trace`                                                                                                                                           |
| BMAD planning, story, or review                                                     | `.codex/skills/bmad-*` matching the named workflow | `_bmad/` agent/workflow files referenced by `AGENTS.md`                                                                                                                                                        |
| PRP execution or quality                                                            | `.codex/skills/prp-execute`                        | `.codex/skills/prp-quality`                                                                                                                                                                                    |
| Repeatable docs or SOP capture                                                      | `.codex/skills/repeatable-training-docs`           | `.agents/skills/web-research` only when live external research is required                                                                                                                                     |
| Interactive visual explainer, cheat sheet, workflow, mental model, or decision tree | `.agents/skills/visual-docs`                       | `.agents/skills/testing/agent-browser` for rendered proof and `.agents/skills/impeccable` when the output represents Alleato product UI                                                                        |

## Design Rule

For new or substantially redesigned Alleato UI, `alleato-experience-system` owns positive composition: user/job/decision, page archetype, information architecture, interaction, evidence, responsive recomposition, and the Design/UX 101 gate. `impeccable` owns mandatory product-noise control and visual refinement. Use them in that order.

For a focused cleanup or polish request, start with `impeccable` and invoke the Experience System only if the correction changes the page's underlying experience model. `alleato-design-doctrine` is a compatibility alias/reference loader, not a competing authority.

Generic cinematic or “make it memorable” skills—including `premium-frontend-design`, `/design/designer`, `gpt-taste`, `design-taste-frontend`, and `design-taste-frontend-v1`—are not valid authorities for Alleato application UI. `design-taste-frontend` v2 may contribute selected calibration and redesign techniques to an explicitly requested marketing/brand artifact. `gpt-taste` is limited to explicitly requested Awwwards-style promotional experiments. `design-taste-frontend-v1` is legacy-only. Stitch-oriented `design-md` output must remain scoped to the named Stitch artifact and must not overwrite root `DESIGN.md`.

Invoke the Experience System directly with:

```text
/alleato-experience-system plan <feature or route>
/alleato-experience-system implement <feature or route>
/alleato-experience-system review <route or artifact>
```

For frontend work that is responding to user comments in Codex or Claude, consult the repo-local conversation feedback ledger before implementation or audit work:

```bash
node scripts/ops/frontend-feedback-ledger.mjs lookup --text "<request>" --files <owned-paths>
node scripts/ops/frontend-feedback-ledger.mjs validate
```

## Testing Rule

For "make it work" requests, use user-flow verification first. `agent-browser` is the browser automation primitive, not the testing strategy by itself. `verify-feature` owns the evidence standard; `e2e-test`, `smoke-test`, Procore skills, and BMAD/TEA testing skills add regression depth after the user flow is understood.

## Discovery Guardrail

Before invoking a skill by inferred name:

- verify the exact `name:` field,
- verify the `SKILL.md` path resolves,
- check whether it is a real directory or a symlink,
- prefer repo-local Alleato skills over global duplicates,
- and say plainly when a plausible skill name is not installed.

Run this quick broken-link check when slash/menu discovery looks wrong:

```bash
find .codex/skills .agents/skills .claude/skills ~/.codex/skills ~/.agents/skills ~/.claude/skills \
  -type l ! -exec test -e {} \; -print 2>/dev/null
```
